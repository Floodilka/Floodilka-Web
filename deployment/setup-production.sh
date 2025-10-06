#!/bin/bash

echo "🚀 Настройка production окружения для Boltushka..."

# Создание .env файла для production
echo "📝 Создание .env для production..."
cd /var/www/boltushka/backend

# Генерация случайного JWT секрета
JWT_SECRET=$(openssl rand -base64 32)

cat > .env << EOF
PORT=3001
FRONTEND_URL=https://boltushka.fitronyx.com
NODE_ENV=production
MONGODB_URI=mongodb://localhost:27017/boltushka
JWT_SECRET=${JWT_SECRET}
EOF

echo "✅ .env файл создан с уникальным JWT секретом"

# Установка зависимостей
echo "📦 Установка зависимостей backend..."
npm install --omit=dev

# Перезапуск backend
echo "🔄 Перезапуск backend..."
sudo -u boltushka pm2 restart boltushka-backend --update-env
sudo -u boltushka pm2 save

echo ""
echo "✅ Production окружение настроено!"
echo "📊 Проверка статуса: sudo -u boltushka pm2 status"
echo "📜 Логи backend: sudo -u boltushka pm2 logs boltushka-backend"
echo "🔐 JWT Secret сохранен в /var/www/boltushka/backend/.env"

