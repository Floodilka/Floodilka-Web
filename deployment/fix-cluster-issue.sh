#!/bin/bash

echo "🔧 Исправление проблемы 'разных миров' в PM2 cluster mode..."
echo ""

# Переключение на fork mode (1 процесс)
echo "1️⃣ Остановка текущего PM2 процесса..."
sudo -u floodilka pm2 delete floodilka-backend 2>/dev/null || true

echo ""
echo "2️⃣ Запуск в fork mode (1 процесс)..."
cd /var/www/floodilka/backend
sudo -u floodilka pm2 start /var/www/floodilka/deployment/ecosystem.config.js --env production

echo ""
echo "3️⃣ Сохранение конфигурации PM2..."
sudo -u floodilka pm2 save

echo ""
echo "4️⃣ Проверка статуса..."
sudo -u floodilka pm2 status

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Backend перезапущен в fork mode!"
echo ""
echo "📝 Что изменилось:"
echo "   - БЫЛО: 2 процесса (cluster mode) → каждый со своими комнатами"
echo "   - СТАЛО: 1 процесс (fork mode) → все в одних комнатах"
echo ""
echo "🧪 Проверьте:"
echo "   1. Откройте 2 вкладки браузера"
echo "   2. Отправьте сообщение в одной"
echo "   3. Должно появиться в другой БЕЗ обновления"
echo "   4. Обновите страницу несколько раз"
echo "   5. Пользователи в голосовом канале должны быть видны стабильно"
echo ""
echo "📊 Логи: sudo -u floodilka pm2 logs floodilka-backend"
echo ""

