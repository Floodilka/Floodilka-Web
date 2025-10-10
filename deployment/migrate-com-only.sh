#!/bin/bash

# Скрипт миграции только на floodilka.com
# Временная версия для миграции только с .com доменом

set -e

echo "🚀 Начинаем миграцию на floodilka.com (временно без .ru)"
echo ""

# Проверка, что запущено от root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Пожалуйста, запустите скрипт с sudo"
    exit 1
fi

# Переменные
OLD_DOMAIN="boltushka.fitronyx.com"
NEW_DOMAIN_COM="floodilka.com"
NGINX_SITES="/etc/nginx/sites-available"
NGINX_ENABLED="/etc/nginx/sites-enabled"
APP_DIR="/var/www/boltushka"

echo "📋 Шаги миграции:"
echo "  1. Обновление Git репозитория"
echo "  2. Создание бэкапа текущей конфигурации nginx"
echo "  3. Установка новой конфигурации nginx (только .com)"
echo "  4. Настройка SSL сертификата для floodilka.com"
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
if [ -f "$NGINX_SITES/boltushka" ]; then
    cp $NGINX_SITES/boltushka $NGINX_SITES/boltushka.backup.$(date +%Y%m%d_%H%M%S)
    echo "✅ Бэкап создан: $NGINX_SITES/boltushka.backup.$(date +%Y%m%d_%H%M%S)"
else
    echo "⚠️  Старая конфигурация не найдена, пропускаем бэкап"
fi

# Шаг 3: Установка новой конфигурации nginx (только .com)
echo ""
echo "🔧 Шаг 3/6: Установка конфигурации nginx для floodilka.com..."

# Удаляем старый симлинк
if [ -L "$NGINX_ENABLED/boltushka" ]; then
    rm $NGINX_ENABLED/boltushka
    echo "✅ Старый симлинк удален"
fi

# Копируем конфигурацию только для основного домена .com
cp $APP_DIR/deployment/nginx-https-main-only.conf $NGINX_SITES/floodilka

# Создаем симлинк
ln -sf $NGINX_SITES/floodilka $NGINX_ENABLED/floodilka

# Проверяем конфигурацию
nginx -t && systemctl reload nginx
echo "✅ Конфигурация nginx установлена"

# Шаг 4: Настройка SSL сертификата
echo ""
echo "🔐 Шаг 4/6: Настройка SSL сертификата для floodilka.com..."
echo "⚠️  ВАЖНО: Убедитесь, что DNS записи для floodilka.com указывают на этот сервер!"
echo ""
read -p "DNS записи настроены? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Пожалуйста, настройте DNS записи и запустите скрипт снова"
    exit 1
fi

bash $APP_DIR/deployment/setup-ssl-com-main-only.sh

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

# Шаг 6: Перезапуск сервисов
echo ""
echo "🔄 Шаг 6/6: Перезапуск сервисов..."

# Проверка конфигурации nginx
echo "  Проверка конфигурации nginx..."
nginx -t

# Перезапуск nginx
echo "  Перезапуск nginx..."
systemctl restart nginx
echo "✅ Nginx перезапущен"

# Перезапуск backend
echo "  Перезапуск backend..."
sudo -u boltushka pm2 restart boltushka-backend
echo "✅ Backend перезапущен"

echo ""
echo "✅ Миграция на floodilka.com завершена успешно!"
echo ""
echo "🌐 Новый домен:"
echo "   - https://floodilka.com"
echo "   - https://www.floodilka.com (редирект на floodilka.com)"
echo ""
echo "📊 Проверьте работу:"
echo "   - Откройте браузер и перейдите на https://floodilka.com"
echo "   - Проверьте логи: sudo -u boltushka pm2 logs"
echo "   - Проверьте логи nginx: tail -f /var/log/nginx/floodilka-error.log"
echo ""
echo "🔄 Добавление .ru домена позже:"
echo "   Когда DNS для floodilka.ru распространится, запустите:"
echo "   sudo bash deployment/add-ru-domain.sh"
echo ""

