#!/bin/bash

# Настройка SSL сертификата через Let's Encrypt
# Требуется домен!

set -e

# УКАЖИТЕ ВАШ ДОМЕН
DOMAIN="your-domain.com"
EMAIL="your-email@example.com"

echo "🔐 Настройка SSL для $DOMAIN..."

# Установка certbot
echo "📦 Установка Certbot..."
apt install -y certbot python3-certbot-nginx

# Получение сертификата
echo "📜 Получение SSL сертификата..."
certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email $EMAIL

# Автообновление сертификата
echo "🔄 Настройка автообновления..."
systemctl enable certbot.timer
systemctl start certbot.timer

# Проверка автообновления
certbot renew --dry-run

echo "✅ SSL успешно настроен!"
echo "🔒 Сертификат находится в /etc/letsencrypt/live/$DOMAIN/"
echo "🔄 Автообновление настроено через systemd timer"

