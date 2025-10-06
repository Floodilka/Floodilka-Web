#!/bin/bash

# Быстрое обновление Boltushka на сервере
# Использование: bash update.sh

set -e

echo "🚀 Обновление Boltushka..."

# Переход в корень проекта
cd /var/www/boltushka

# Сохранение локальных изменений
echo "💾 Сохранение локальных изменений..."
git stash

# Подтягивание обновлений
echo "📥 Подтягивание обновлений из Git..."
git pull

# Возврат локальных изменений
echo "📝 Восстановление локальных изменений..."
git stash pop || true

# Деплой backend
echo "🔧 Обновление backend..."
cd deployment
bash deploy-backend.sh

# Деплой frontend
echo "🎨 Обновление frontend..."
bash deploy-frontend.sh

echo ""
echo "✅ Обновление завершено!"
echo "📊 Проверка: sudo -u boltushka pm2 status"
echo "📜 Логи: sudo -u boltushka pm2 logs boltushka-backend"

