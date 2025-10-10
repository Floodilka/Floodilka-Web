#!/bin/bash

# Альтернативный способ получения SSL через standalone метод
# Использует встроенный веб-сервер certbot (более надёжно)

set -e

# Домены
DOMAIN_COM="floodilka.com"
DOMAIN_RU="floodilka.ru"
EMAIL="eldar.teng@gmail.com"

echo "🔐 Настройка SSL для $DOMAIN_COM и $DOMAIN_RU (standalone метод)..."

# Установка certbot (если еще не установлен)
echo "📦 Проверка установки Certbot..."
if ! command -v certbot &> /dev/null; then
    echo "Установка Certbot..."
    apt update
    apt install -y certbot
else
    echo "✓ Certbot уже установлен"
fi

# Остановка nginx для освобождения портов 80 и 443
echo ""
echo "⏸️  Временная остановка nginx..."
systemctl stop nginx
echo "✅ Nginx остановлен"

# Получение сертификата для .com домена
echo ""
echo "📜 Получение SSL сертификата для $DOMAIN_COM и www.$DOMAIN_COM..."
certbot certonly --standalone \
    -d $DOMAIN_COM \
    -d www.$DOMAIN_COM \
    --non-interactive \
    --agree-tos \
    --email $EMAIL \
    --preferred-challenges http

if [ $? -eq 0 ]; then
    echo "✅ Сертификат для $DOMAIN_COM получен!"
else
    echo "❌ Ошибка получения сертификата для $DOMAIN_COM"
    echo "   Проверьте DNS записи: dig $DOMAIN_COM +short"
    systemctl start nginx
    exit 1
fi

# Получение сертификата для .ru домена
echo ""
echo "📜 Получение SSL сертификата для $DOMAIN_RU и www.$DOMAIN_RU..."
certbot certonly --standalone \
    -d $DOMAIN_RU \
    -d www.$DOMAIN_RU \
    --non-interactive \
    --agree-tos \
    --email $EMAIL \
    --preferred-challenges http

if [ $? -eq 0 ]; then
    echo "✅ Сертификат для $DOMAIN_RU получен!"
else
    echo "❌ Ошибка получения сертификата для $DOMAIN_RU"
    echo "   Проверьте DNS записи: dig $DOMAIN_RU +short"
    systemctl start nginx
    exit 1
fi

# Запуск nginx обратно
echo ""
echo "▶️  Запуск nginx..."
systemctl start nginx
echo "✅ Nginx запущен"

# Автообновление сертификатов
echo ""
echo "🔄 Настройка автообновления сертификатов..."
systemctl enable certbot.timer
systemctl start certbot.timer

# Создание hook для перезапуска nginx при обновлении сертификатов
mkdir -p /etc/letsencrypt/renewal-hooks/deploy
cat > /etc/letsencrypt/renewal-hooks/deploy/nginx-reload.sh << 'EOF'
#!/bin/bash
systemctl reload nginx
EOF
chmod +x /etc/letsencrypt/renewal-hooks/deploy/nginx-reload.sh

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
echo "   Установите HTTPS конфигурацию nginx и перезапустите: systemctl restart nginx"

