#!/bin/bash

# Быстрый деплой - используйте после первой настройки
# Использование: ./quick-deploy.sh YOUR_SERVER_IP

set -e

if [ -z "$1" ]; then
    echo "❌ Укажите IP сервера: ./quick-deploy.sh YOUR_SERVER_IP"
    exit 1
fi

SERVER_IP=$1
echo "🚀 Быстрый деплой на $SERVER_IP..."

# Синхронизация кода
echo "📦 Синхронизация кода..."
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude 'build' \
  ../backend ../frontend ../deployment \
  root@$SERVER_IP:/var/www/boltushka/

# Деплой на сервере
echo "⚙️ Деплой приложения..."
ssh root@$SERVER_IP << 'ENDSSH'
cd /var/www/boltushka/deployment
bash deploy-backend.sh
bash deploy-frontend.sh
ENDSSH

echo "✅ Деплой завершен!"
echo "📊 Проверка: ssh root@$SERVER_IP 'pm2 status'"

