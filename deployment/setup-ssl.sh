#!/bin/bash

# Настройка SSL сертификатов через Let's Encrypt для Floodilka
# Поддержка обоих доменов: floodilka.com и floodilka.ru

set -e

# Домены
DOMAIN_COM="floodilka.com"
DOMAIN_RU="floodilka.ru"
EMAIL="eldar.teng@gmail.com"

echo "🔐 Настройка SSL для $DOMAIN_COM и $DOMAIN_RU..."

# Установка certbot (если еще не установлен)
echo "📦 Проверка установки Certbot..."
if ! command -v certbot &> /dev/null; then
    echo "Установка Certbot..."
    apt update
    apt install -y certbot python3-certbot-nginx
else
    echo "✓ Certbot уже установлен"
fi

# Создание директории для ACME challenge
echo ""
echo "📁 Создание директории для challenge файлов..."
mkdir -p /var/www/floodilka/public/.well-known/acme-challenge
chmod -R 755 /var/www/floodilka/public/.well-known
echo "✅ Директория создана"

# Тестовый файл для проверки доступности
echo "test" > /var/www/floodilka/public/.well-known/acme-challenge/test.txt
echo ""
echo "🧪 Проверка доступности через веб..."
echo "   Попробуйте открыть: http://$DOMAIN_COM/.well-known/acme-challenge/test.txt"
echo "   Должен вернуться текст 'test'"
echo ""
read -p "Файл доступен через браузер? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "⚠️  Проверьте nginx конфигурацию и DNS записи"
    echo "   DNS для $DOMAIN_COM должен указывать на этот сервер"
    exit 1
fi
rm /var/www/floodilka/public/.well-known/acme-challenge/test.txt

# Получение сертификата для .com домена (сначала без www)
echo ""
echo "📜 Получение SSL сертификата для $DOMAIN_COM..."
certbot certonly --webroot \
    -w /var/www/floodilka/public \
    -d $DOMAIN_COM \
    --non-interactive \
    --agree-tos \
    --email $EMAIL

echo "✅ Сертификат для $DOMAIN_COM получен!"

# Расширяем сертификат .com для включения www
echo ""
echo "📜 Добавление www.$DOMAIN_COM к сертификату..."
certbot certonly --webroot \
    -w /var/www/floodilka/public \
    -d $DOMAIN_COM \
    -d www.$DOMAIN_COM \
    --expand \
    --non-interactive \
    --agree-tos \
    --email $EMAIL

echo "✅ www.$DOMAIN_COM добавлен к сертификату!"

# Получение сертификата для .ru домена (сначала без www)
echo ""
echo "📜 Получение SSL сертификата для $DOMAIN_RU..."
certbot certonly --webroot \
    -w /var/www/floodilka/public \
    -d $DOMAIN_RU \
    --non-interactive \
    --agree-tos \
    --email $EMAIL

echo "✅ Сертификат для $DOMAIN_RU получен!"

# Расширяем сертификат .ru для включения www
echo ""
echo "📜 Добавление www.$DOMAIN_RU к сертификату..."
certbot certonly --webroot \
    -w /var/www/floodilka/public \
    -d $DOMAIN_RU \
    -d www.$DOMAIN_RU \
    --expand \
    --non-interactive \
    --agree-tos \
    --email $EMAIL

echo "✅ www.$DOMAIN_RU добавлен к сертификату!"

# Автообновление сертификатов
echo ""
echo "🔄 Настройка автообновления сертификатов..."
systemctl enable certbot.timer
systemctl start certbot.timer

# Проверка автообновления
echo ""
echo "🧪 Проверка автообновления (dry run)..."
certbot renew --dry-run

echo ""
echo "✅ SSL успешно настроен для обоих доменов!"
echo ""
echo "📁 Сертификаты находятся в:"
echo "   - /etc/letsencrypt/live/$DOMAIN_COM/"
echo "   - /etc/letsencrypt/live/$DOMAIN_RU/"
echo ""
echo "🔄 Автообновление настроено через systemd timer"
echo "   Проверить статус: systemctl status certbot.timer"
echo ""
echo "🔥 Следующий шаг:"
echo "   Перезапустите nginx: systemctl restart nginx"

