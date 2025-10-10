#!/bin/bash

# Деплой frontend на сервер

set -e

FRONTEND_DIR="/var/www/floodilka/frontend"
BUILD_DIR="/var/www/floodilka/frontend/build"
NGINX_DIR="/var/www/floodilka/public"
USER="floodilka"

echo "🚀 Деплой floodilka Frontend..."

# Переход в директорию
cd $FRONTEND_DIR

# Установка зависимостей
echo "📦 Установка зависимостей..."
sudo -u $USER npm install

# Сборка production версии
echo "🔨 Сборка production версии..."
sudo -u $USER npm run build

# Создание директории для nginx
echo "📁 Копирование файлов..."
mkdir -p $NGINX_DIR
rm -rf $NGINX_DIR/*
cp -r $BUILD_DIR/* $NGINX_DIR/
chown -R www-data:www-data $NGINX_DIR

echo "✅ Frontend успешно развернут!"
echo "📁 Файлы находятся в: $NGINX_DIR"

