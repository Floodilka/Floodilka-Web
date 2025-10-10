#!/bin/bash

# Деплой backend на сервер

set -e

APP_DIR="/var/www/floodilka/backend"
USER="floodilka"

echo "🚀 Деплой floodilka Backend..."

# Переход в директорию
cd $APP_DIR

# Установка зависимостей
echo "📦 Установка зависимостей..."
sudo -u $USER npm install --production

# Перезапуск или запуск приложения через PM2
echo "🔄 Перезапуск приложения..."
if sudo -u $USER pm2 list | grep -q "floodilka-backend"; then
  # Если процесс существует - graceful reload
  echo "♻️  Graceful reload (минимальный downtime)..."
  sudo -u $USER pm2 reload floodilka-backend --update-env
else
  # Если не существует - запускаем
  echo "🚀 Первый запуск..."
  sudo -u $USER pm2 start server.js \
    --name floodilka-backend \
    --env production \
    --max-memory-restart 500M
fi

# Сохранение конфигурации PM2
sudo -u $USER pm2 save

# Настройка автозапуска
pm2 startup systemd -u $USER --hp /home/$USER

echo "✅ Backend успешно развернут!"
echo "📊 Проверка статуса: pm2 status"
echo "📜 Логи: pm2 logs floodilka-backend"

