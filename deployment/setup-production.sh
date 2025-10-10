#!/bin/bash

echo "🚀 Настройка production окружения для floodilka..."

# Создание .env файла для production
echo "📝 Создание .env для production..."
cd /var/www/floodilka/backend

# Генерация случайного JWT секрета
JWT_SECRET=$(openssl rand -base64 32)

cat > .env << EOF
PORT=3001
FRONTEND_URL=https://floodilka.com
NODE_ENV=production
MONGODB_URI=mongodb://localhost:27017/floodilka
JWT_SECRET=${JWT_SECRET}
EOF

echo "✅ .env файл создан с уникальным JWT секретом"

# Установка зависимостей
echo "📦 Установка зависимостей backend..."
npm install --omit=dev

# Перезапуск backend
echo "🔄 Перезапуск backend..."
sudo -u floodilka pm2 restart floodilka-backend --update-env
sudo -u floodilka pm2 save

echo ""
echo "✅ Production окружение настроено!"
echo "📊 Проверка статуса: sudo -u floodilka pm2 status"
echo "📜 Логи backend: sudo -u floodilka pm2 logs floodilka-backend"
echo "🔐 JWT Secret сохранен в /var/www/floodilka/backend/.env"

