#!/bin/bash

# Обновление nginx конфигурации для floodilka
# Использование: sudo bash update-nginx.sh

set -e

echo "🔧 Обновление конфигурации nginx..."

# Проверка прав
if [ "$EUID" -ne 0 ]; then
    echo "❌ Этот скрипт требует прав root"
    echo "Запустите: sudo bash update-nginx.sh"
    exit 1
fi

# Путь к проекту
PROJECT_DIR="/var/www/floodilka"

# Определяем, какую конфигурацию использовать (HTTP или HTTPS)
if [ -f "/etc/letsencrypt/live/floodilka.fitronyx.com/fullchain.pem" ]; then
    CONFIG_FILE="nginx-https.conf"
    echo "✅ Найден SSL сертификат, используем HTTPS конфигурацию"
else
    CONFIG_FILE="nginx-http.conf"
    echo "⚠️  SSL сертификат не найден, используем HTTP конфигурацию"
fi

# Копируем конфигурацию
echo "📝 Копируем конфигурацию..."
cp "$PROJECT_DIR/deployment/$CONFIG_FILE" /etc/nginx/sites-available/floodilka

# Проверяем синтаксис nginx
echo "🔍 Проверка конфигурации nginx..."
if nginx -t; then
    echo "✅ Конфигурация корректна"

    # Перезагружаем nginx
    echo "🔄 Перезагрузка nginx..."
    systemctl reload nginx

    echo ""
    echo "✅ Конфигурация nginx успешно обновлена!"
else
    echo "❌ Ошибка в конфигурации nginx"
    exit 1
fi

