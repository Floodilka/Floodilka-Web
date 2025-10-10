#!/bin/bash

# Быстрое обновление floodilka на сервере
# Использование: bash update.sh или sudo bash update.sh (если нужно обновить nginx)

set -e

echo "🚀 Обновление floodilka..."

# Проверка, запущен ли скрипт с sudo
NEED_SUDO=false
if [ "$EUID" -eq 0 ]; then
    NEED_SUDO=true
    echo "✅ Скрипт запущен с правами root (nginx будет обновлен при необходимости)"
else
    echo "⚠️  Скрипт запущен без sudo (nginx не будет обновлен)"
fi

# Переход в корень проекта
cd /var/www/floodilka

# Сохранение хеша конфигурации nginx до обновления
NGINX_HTTPS_HASH_BEFORE=$(md5sum deployment/nginx-https.conf 2>/dev/null | cut -d' ' -f1)
NGINX_HTTP_HASH_BEFORE=$(md5sum deployment/nginx-http.conf 2>/dev/null | cut -d' ' -f1)

# Сохранение локальных изменений
echo "💾 Сохранение локальных изменений..."
git stash

# Подтягивание обновлений
echo "📥 Подтягивание обновлений из Git..."
git pull

# Возврат локальных изменений
echo "📝 Восстановление локальных изменений..."
git stash pop || true

# Проверка изменений в nginx конфигурации
NGINX_HTTPS_HASH_AFTER=$(md5sum deployment/nginx-https.conf 2>/dev/null | cut -d' ' -f1)
NGINX_HTTP_HASH_AFTER=$(md5sum deployment/nginx-http.conf 2>/dev/null | cut -d' ' -f1)

NGINX_CHANGED=false
if [ "$NGINX_HTTPS_HASH_BEFORE" != "$NGINX_HTTPS_HASH_AFTER" ] || [ "$NGINX_HTTP_HASH_BEFORE" != "$NGINX_HTTP_HASH_AFTER" ]; then
    NGINX_CHANGED=true
fi

# Обновление nginx конфигурации если изменилась
if [ "$NGINX_CHANGED" = true ]; then
    echo ""
    echo "⚠️  Обнаружены изменения в конфигурации nginx!"
    if [ "$NEED_SUDO" = true ]; then
        echo "🔧 Обновление nginx конфигурации..."
        cd deployment
        bash update-nginx.sh
        cd ..
    else
        echo "❌ Для обновления nginx нужны права root"
        echo "   Запустите: sudo bash deployment/update-nginx.sh"
    fi
fi

# Деплой backend
echo ""
echo "🔧 Обновление backend..."
cd deployment
bash deploy-backend.sh

# Деплой frontend
echo ""
echo "🎨 Обновление frontend..."
bash deploy-frontend.sh

echo ""
echo "✅ Обновление завершено!"
echo ""
echo "📊 Полезные команды:"
echo "   Статус: sudo -u floodilka pm2 status"
echo "   Логи backend: sudo -u floodilka pm2 logs floodilka-backend"
echo "   Логи nginx: sudo tail -f /var/log/nginx/floodilka-error.log"
if [ "$NGINX_CHANGED" = true ] && [ "$NEED_SUDO" = false ]; then
    echo ""
    echo "⚠️  ВНИМАНИЕ: Не забудьте обновить nginx!"
    echo "   Запустите: sudo bash deployment/update-nginx.sh"
fi

