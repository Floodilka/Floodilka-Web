#!/bin/bash

# Скрипт для запуска всего проекта в режиме разработки
# Убивает все процессы на портах 3000 и 5000, затем запускает backend и frontend

echo "🚀 Запуск проекта Floodilka в режиме разработки..."

# Переходим в корневую папку проекта
cd "$(dirname "$0")/.."

# Убиваем все процессы на портах разработки
echo "🧹 Очистка портов..."
./scripts/kill-dev-ports.sh

# Запускаем MongoDB если нужно
echo "🗄️  Запуск MongoDB..."
./scripts/start-db.sh

# Ждем немного чтобы MongoDB запустился
sleep 2

# Запускаем backend в фоне
echo "🔧 Запуск backend..."
cd backend
npm run start:clean &
BACKEND_PID=$!

# Ждем немного чтобы backend запустился
sleep 3

# Запускаем frontend
echo "📱 Запуск frontend..."
cd ../frontend
npm run start:clean &
FRONTEND_PID=$!

echo ""
echo "🎉 Проект запущен!"
echo "📱 Frontend: http://localhost:3000"
echo "🔧 Backend: http://localhost:5000"
echo ""
echo "Для остановки нажмите Ctrl+C"

# Функция для корректного завершения процессов
cleanup() {
    echo ""
    echo "🛑 Остановка проекта..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    echo "✅ Проект остановлен"
    exit 0
}

# Перехватываем сигнал завершения
trap cleanup SIGINT SIGTERM

# Ждем завершения процессов
wait
