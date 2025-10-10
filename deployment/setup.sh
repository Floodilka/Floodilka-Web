#!/bin/bash

# Скрипт для настройки floodilka на Ubuntu/Debian сервере
# Запускать с sudo: sudo bash setup.sh

set -e

echo "🚀 Начинаем установку floodilka..."

# Обновление системы
echo "📦 Обновление системы..."
apt update
apt upgrade -y

# Установка Node.js 18.x
echo "📦 Установка Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Установка PM2 для управления процессами
echo "📦 Установка PM2..."
npm install -g pm2

# Установка Nginx
echo "📦 Установка Nginx..."
apt install -y nginx

# Создание пользователя для приложения
echo "👤 Создание пользователя floodilka..."
if ! id -u floodilka > /dev/null 2>&1; then
    useradd -m -s /bin/bash floodilka
fi

# Создание директории для приложения
echo "📁 Создание директорий..."
mkdir -p /var/www/floodilka
chown -R floodilka:floodilka /var/www/floodilka

echo "✅ Базовая настройка завершена!"
echo ""
echo "Следующие шаги:"
echo "1. Скопируйте код на сервер в /var/www/floodilka"
echo "2. Запустите deploy-backend.sh для деплоя backend"
echo "3. Запустите deploy-frontend.sh для деплоя frontend"
echo "4. Настройте Nginx (см. nginx-config.conf)"

