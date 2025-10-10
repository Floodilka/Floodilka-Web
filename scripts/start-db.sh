#!/bin/bash

# Скрипт для запуска MongoDB в Docker для локальной разработки

echo "🐳 Запуск MongoDB в Docker..."

# Проверить, установлен ли Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker не установлен. Установите Docker и попробуйте снова."
    exit 1
fi

# Проверить, установлен ли docker-compose
if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose не установлен. Установите docker-compose и попробуйте снова."
    exit 1
fi

# Перейти в корневую директорию проекта
cd "$(dirname "$0")/.."

# Остановить существующие контейнеры
echo "🛑 Остановка существующих контейнеров..."
docker-compose down

# Запустить MongoDB и Mongo Express
echo "🚀 Запуск MongoDB и Mongo Express..."
docker-compose up -d

# Ждать, пока MongoDB запустится
echo "⏳ Ожидание запуска MongoDB..."
sleep 10

# Проверить статус контейнеров
echo "📊 Статус контейнеров:"
docker-compose ps

echo ""
echo "✅ MongoDB запущена!"
echo "📊 Mongo Express (веб-интерфейс): http://localhost:8081"
echo "🔑 Логин: admin / admin123"
echo "🔌 Строка подключения: mongodb://floodilka_user:floodilka_pass@localhost:27017/floodilka"
echo ""
echo "💡 Для остановки базы данных выполните: npm run db:stop"
echo "💡 Для просмотра логов выполните: npm run db:logs"
