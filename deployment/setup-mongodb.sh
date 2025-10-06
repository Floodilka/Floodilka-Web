#!/bin/bash

echo "📦 Установка MongoDB на Ubuntu..."

# Импорт публичного ключа MongoDB
echo "🔑 Импорт ключа MongoDB..."
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
   sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg \
   --dearmor

# Добавление репозитория MongoDB
echo "📝 Добавление репозитория..."
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | \
   sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Обновление списка пакетов
echo "🔄 Обновление списка пакетов..."
sudo apt-get update

# Установка MongoDB
echo "💾 Установка MongoDB..."
sudo apt-get install -y mongodb-org

# Запуск MongoDB
echo "▶️ Запуск MongoDB..."
sudo systemctl start mongod
sudo systemctl enable mongod

# Проверка статуса
echo "✅ Проверка статуса MongoDB..."
sudo systemctl status mongod --no-pager

# Проверка версии
echo ""
echo "📊 Версия MongoDB:"
mongod --version | head -n 1

echo ""
echo "✅ MongoDB успешно установлена и запущена!"
echo "📝 Статус: sudo systemctl status mongod"
echo "📜 Логи: sudo journalctl -u mongod"

