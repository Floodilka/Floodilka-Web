#!/bin/bash

# Скрипт для переноса Boltushka на новый сервер
# Запускать на СТАРОМ сервере (Digital Ocean)

set -e

echo "🚀 Начинаем миграцию Boltushka на новый сервер..."

# Переменные (ЗАМЕНИТЕ НА ВАШИ ДАННЫЕ!)
OLD_SERVER_IP="159.89.110.44"  # Ваш текущий Digital Ocean IP
NEW_SERVER_IP="YOUR_NEW_IP"    # IP нового сервера
NEW_SERVER_USER="root"         # Пользователь на новом сервере

echo "📋 Текущая конфигурация:"
echo "Старый сервер: $OLD_SERVER_IP"
echo "Новый сервер: $NEW_SERVER_IP"
echo ""

# Проверка подключения к новому серверу
echo "🔍 Проверка подключения к новому серверу..."
if ! ssh -o ConnectTimeout=10 $NEW_SERVER_USER@$NEW_SERVER_IP "echo 'Подключение успешно'"; then
    echo "❌ Не удается подключиться к новому серверу!"
    echo "Убедитесь что:"
    echo "1. Новый сервер запущен"
    echo "2. SSH доступ настроен"
    echo "3. IP адрес правильный"
    exit 1
fi

echo "✅ Подключение к новому серверу успешно!"

# Создание backup базы данных
echo "💾 Создание backup MongoDB..."
cd /var/www/boltushka
mongodump --db boltushka --out ./backup/mongodb

# Создание backup загруженных файлов
echo "📁 Создание backup загруженных файлов..."
mkdir -p ./backup/uploads
cp -r ./backend/uploads/* ./backup/uploads/ 2>/dev/null || echo "Нет загруженных файлов"

# Создание backup .env файла
echo "🔐 Создание backup .env файла..."
cp ./backend/.env ./backup/.env 2>/dev/null || echo "⚠️ .env файл не найден"

# Создание архива для переноса
echo "📦 Создание архива для переноса..."
tar -czf boltushka-migration-backup.tar.gz \
    backup/ \
    deployment/ \
    backend/package.json \
    backend/server.js \
    frontend/package.json

echo "✅ Backup создан: boltushka-migration-backup.tar.gz"

# Копирование на новый сервер
echo "🚚 Копирование данных на новый сервер..."
scp boltushka-migration-backup.tar.gz $NEW_SERVER_USER@$NEW_SERVER_IP:/tmp/

echo "✅ Данные скопированы на новый сервер!"
echo ""
echo "🎯 Следующие шаги на НОВОМ сервере:"
echo ""
echo "1. Подключитесь к новому серверу:"
echo "   ssh $NEW_SERVER_USER@$NEW_SERVER_IP"
echo ""
echo "2. Распакуйте архив:"
echo "   cd /var/www/boltushka"
echo "   tar -xzf /tmp/boltushka-migration-backup.tar.gz"
echo ""
echo "3. Восстановите MongoDB:"
echo "   mongorestore --db boltushka backup/mongodb/boltushka"
echo ""
echo "4. Восстановите загруженные файлы:"
echo "   cp -r backup/uploads/* backend/uploads/"
echo ""
echo "5. Восстановите .env файл:"
echo "   cp backup/.env backend/.env"
echo ""
echo "6. Обновите конфигурацию nginx:"
echo "   nano /etc/nginx/sites-available/boltushka"
echo "   # Замените server_name на ваш новый IP/домен"
echo ""
echo "7. Перезапустите сервисы:"
echo "   sudo systemctl restart nginx"
echo "   sudo -u boltushka pm2 restart boltushka-backend"
echo ""
echo "8. Протестируйте работу:"
echo "   curl http://$NEW_SERVER_IP"
echo ""
echo "📚 Подробная инструкция в файле: deployment/MIGRATION-GUIDE.md"

# Создание инструкции для нового сервера
cat > migration-instructions.txt << EOF
# Инструкция по настройке Boltushka на новом сервере

## 1. Подключение к серверу
ssh $NEW_SERVER_USER@$NEW_SERVER_IP

## 2. Установка базового ПО
sudo bash /var/www/boltushka/deployment/setup.sh

## 3. Установка MongoDB
sudo bash /var/www/boltushka/deployment/setup-mongodb.sh

## 4. Распаковка данных
cd /var/www/boltushka
tar -xzf /tmp/boltushka-migration-backup.tar.gz

## 5. Восстановление данных
mongorestore --db boltushka backup/mongodb/boltushka
cp -r backup/uploads/* backend/uploads/ 2>/dev/null || true
cp backup/.env backend/.env

## 6. Настройка production
sudo bash /var/www/boltushka/deployment/setup-production.sh

## 7. Обновление nginx конфигурации
sudo cp /var/www/boltushka/deployment/nginx-http.conf /etc/nginx/sites-available/boltushka
# Отредактируйте server_name в файле:
sudo nano /etc/nginx/sites-available/boltushka

## 8. Активация nginx
sudo ln -sf /etc/nginx/sites-available/boltushka /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

## 9. Деплой приложения
sudo bash /var/www/boltushka/deployment/update.sh

## 10. Проверка
curl http://$NEW_SERVER_IP
sudo -u boltushka pm2 status
sudo systemctl status nginx
sudo systemctl status mongod
EOF

echo "📝 Инструкция сохранена в: migration-instructions.txt"
echo ""
echo "🎉 Миграция подготовлена! Следуйте инструкциям выше."


