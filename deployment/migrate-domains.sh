#!/bin/bash

# Скрипт миграции с floodilka.fitronyx.com на floodilka.com/floodilka.ru
# Выполняется на продакшн сервере (DigitalOcean droplet)

set -e

echo "🚀 Начинаем миграцию на новые домены floodilka.com и floodilka.ru"
echo ""

# Проверка, что запущено от root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Пожалуйста, запустите скрипт с sudo"
    exit 1
fi

# Переменные
OLD_DOMAIN="floodilka.fitronyx.com"
NEW_DOMAIN_COM="floodilka.com"
NEW_DOMAIN_RU="floodilka.ru"
NGINX_SITES="/etc/nginx/sites-available"
NGINX_ENABLED="/etc/nginx/sites-enabled"
APP_DIR="/var/www/floodilka"

echo "📋 Шаги миграции:"
echo "  1. Обновление Git репозитория"
echo "  2. Создание бэкапа текущей конфигурации nginx"
echo "  3. Установка новой конфигурации nginx"
echo "  4. Настройка SSL сертификатов для новых доменов"
echo "  5. Обновление переменных окружения backend"
echo "  6. Перезапуск сервисов"
echo ""
read -p "Продолжить? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Отменено"
    exit 1
fi

# Шаг 1: Обновление репозитория
echo ""
echo "📦 Шаг 1/6: Обновление Git репозитория..."
cd $APP_DIR
git stash
git pull origin main
echo "✅ Репозиторий обновлен"

# Шаг 2: Бэкап старой конфигурации
echo ""
echo "💾 Шаг 2/6: Создание бэкапа конфигурации nginx..."
if [ -f "$NGINX_SITES/floodilka" ]; then
    cp $NGINX_SITES/floodilka $NGINX_SITES/floodilka.backup.$(date +%Y%m%d_%H%M%S)
    echo "✅ Бэкап создан: $NGINX_SITES/floodilka.backup.$(date +%Y%m%d_%H%M%S)"
else
    echo "⚠️  Старая конфигурация не найдена, пропускаем бэкап"
fi

# Шаг 3: Установка временной HTTP конфигурации
echo ""
echo "🔧 Шаг 3/6: Установка временной HTTP конфигурации nginx..."

# Удаляем старый симлинк
if [ -L "$NGINX_ENABLED/floodilka" ]; then
    rm $NGINX_ENABLED/floodilka
    echo "✅ Старый симлинк удален"
fi

# Копируем временную HTTP конфигурацию (для получения SSL)
cp $APP_DIR/deployment/nginx-http-temp.conf $NGINX_SITES/floodilka-temp

# Создаем симлинк на временную конфигурацию
ln -sf $NGINX_SITES/floodilka-temp $NGINX_ENABLED/floodilka-temp

# Проверяем и перезапускаем nginx
nginx -t && systemctl reload nginx
echo "✅ Временная HTTP конфигурация установлена"

# Шаг 4: Настройка SSL сертификатов
echo ""
echo "🔐 Шаг 4/6: Настройка SSL сертификатов..."
echo "⚠️  ВАЖНО: Убедитесь, что DNS записи для floodilka.com и floodilka.ru указывают на этот сервер!"
echo ""
read -p "DNS записи настроены? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Пожалуйста, настройте DNS записи и запустите скрипт снова"
    exit 1
fi

bash $APP_DIR/deployment/setup-ssl-standalone.sh

# Шаг 5: Обновление .env файла backend
echo ""
echo "⚙️  Шаг 5/6: Обновление переменных окружения backend..."

BACKEND_ENV="$APP_DIR/backend/.env"

if [ -f "$BACKEND_ENV" ]; then
    # Бэкап .env
    cp $BACKEND_ENV $BACKEND_ENV.backup.$(date +%Y%m%d_%H%M%S)

    # Обновляем FRONTEND_URL
    sed -i "s|FRONTEND_URL=https://$OLD_DOMAIN|FRONTEND_URL=https://$NEW_DOMAIN_COM|g" $BACKEND_ENV

    echo "✅ Переменные окружения обновлены"
    echo "   FRONTEND_URL=https://$NEW_DOMAIN_COM"
else
    echo "⚠️  Файл .env не найден в $BACKEND_ENV"
    echo "   Создайте его вручную с FRONTEND_URL=https://$NEW_DOMAIN_COM"
fi

# Шаг 6: Установка финальной HTTPS конфигурации и перезапуск
echo ""
echo "🔄 Шаг 6/6: Установка HTTPS конфигурации и перезапуск..."

# Удаляем временную конфигурацию
rm $NGINX_ENABLED/floodilka-temp
rm $NGINX_SITES/floodilka-temp
echo "✅ Временная конфигурация удалена"

# Копируем финальную HTTPS конфигурацию
cp $APP_DIR/deployment/nginx-https.conf $NGINX_SITES/floodilka

# Создаем симлинк на HTTPS конфигурацию
ln -sf $NGINX_SITES/floodilka $NGINX_ENABLED/floodilka

# Проверка конфигурации nginx
echo "  Проверка конфигурации nginx..."
nginx -t

# Перезапуск nginx
echo "  Перезапуск nginx..."
systemctl restart nginx
echo "✅ Nginx перезапущен с HTTPS конфигурацией"

# Перезапуск backend
echo "  Перезапуск backend..."
sudo -u floodilka pm2 restart floodilka-backend
echo "✅ Backend перезапущен"

echo ""
echo "✅ Миграция завершена успешно!"
echo ""
echo "🌐 Новые домены:"
echo "   - https://$NEW_DOMAIN_COM"
echo "   - https://$NEW_DOMAIN_RU"
echo ""
echo "📊 Проверьте работу:"
echo "   - Откройте браузер и перейдите на новые домены"
echo "   - Проверьте логи: sudo -u floodilka pm2 logs"
echo "   - Проверьте логи nginx: tail -f /var/log/nginx/floodilka-error.log"
echo ""
echo "🗑️  Очистка (опционально):"
echo "   После проверки можете удалить старые файлы:"
echo "   - rm $NGINX_SITES/floodilka"
echo "   - rm $NGINX_SITES/floodilka.backup.*"
echo ""

