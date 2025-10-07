#!/bin/bash

# Скрипт для сброса базы данных

echo "⚠️  Сброс базы данных MongoDB..."

# Перейти в корневую директорию проекта
cd "$(dirname "$0")/.."

# Остановить контейнеры
echo "🛑 Остановка контейнеров..."
docker-compose down

# Удалить volumes (данные)
echo "🗑️  Удаление данных..."
docker-compose down -v

# Удалить образы (опционально)
read -p "Удалить образы MongoDB? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🗑️  Удаление образов..."
    docker rmi mongo:7.0 mongo-express:1.0.0 2>/dev/null || true
fi

echo "✅ База данных сброшена!"
echo "💡 Для запуска базы данных выполните: npm run db:start"
