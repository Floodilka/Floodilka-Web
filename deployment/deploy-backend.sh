#!/bin/bash

# Деплой backend на сервер

set -e

APP_DIR="/var/www/boltushka/backend"
USER="boltushka"

echo "🚀 Деплой Boltushka Backend..."

# Переход в директорию
cd $APP_DIR

# Установка зависимостей
echo "📦 Установка зависимостей..."
sudo -u $USER npm install --production

# Остановка предыдущей версии если запущена
echo "🛑 Остановка предыдущей версии..."
pm2 stop boltushka-backend || true
pm2 delete boltushka-backend || true

# Запуск приложения через PM2
echo "▶️ Запуск приложения..."
sudo -u $USER pm2 start server.js \
  --name boltushka-backend \
  --env production \
  --max-memory-restart 500M

# Сохранение конфигурации PM2
sudo -u $USER pm2 save

# Настройка автозапуска
pm2 startup systemd -u $USER --hp /home/$USER

echo "✅ Backend успешно развернут!"
echo "📊 Проверка статуса: pm2 status"
echo "📜 Логи: pm2 logs boltushka-backend"

