#!/bin/bash

# Скрипт для остановки MongoDB в Docker

echo "🛑 Остановка MongoDB..."

# Перейти в корневую директорию проекта
cd "$(dirname "$0")/.."

# Остановить контейнеры
docker-compose down

echo "✅ MongoDB остановлена!"
echo "💡 Для запуска базы данных выполните: npm run db:start"
