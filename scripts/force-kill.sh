#!/bin/bash

# Скрипт для принудительного завершения всех процессов Node.js
# Используйте только в крайнем случае!

echo "🔍 Поиск процессов Node.js..."

# Найти все процессы Node.js
NODE_PIDS=$(pgrep -f "node.*server.js")

if [ -z "$NODE_PIDS" ]; then
    echo "✅ Процессы Node.js не найдены"
    exit 0
fi

echo "📋 Найдены процессы Node.js:"
ps -p $NODE_PIDS -o pid,ppid,cmd

echo ""
echo "⚠️  ВНИМАНИЕ: Это принудительно завершит ВСЕ процессы Node.js!"
read -p "Продолжить? (y/N): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "💀 Принудительное завершение процессов..."
    kill -9 $NODE_PIDS
    echo "✅ Процессы завершены"
else
    echo "❌ Отменено"
fi
