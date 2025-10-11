#!/bin/bash

# Graceful обновление floodilka с минимальным downtime
# Использование: sudo bash update-graceful.sh

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Graceful обновление floodilka...${NC}"
echo ""

# Проверка прав
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Этот скрипт требует прав root${NC}"
    echo "Запустите: sudo bash update-graceful.sh"
    exit 1
fi

# Переход в корень проекта
cd /var/www/floodilka

# Проверка активных пользователей
echo -e "${YELLOW}📊 Проверка активных пользователей...${NC}"
ACTIVE_CONNECTIONS=$(sudo -u floodilka pm2 describe floodilka-backend 2>/dev/null | grep -c "online" || echo "0")

if [ "$ACTIVE_CONNECTIONS" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Backend активен. Пользователи могут быть онлайн.${NC}"
    echo ""
    echo -e "${YELLOW}Во время обновления:${NC}"
    echo "  • WebSocket соединения будут разорваны (~2-5 сек)"
    echo "  • Голосовые звонки прервутся"
    echo "  • Пользователи автоматически переподключатся"
    echo ""
    read -p "Продолжить обновление? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}❌ Обновление отменено${NC}"
        exit 1
    fi
fi

# Сохранение хеша конфигурации nginx
NGINX_HTTPS_HASH_BEFORE=$(md5sum deployment/nginx-https.conf 2>/dev/null | cut -d' ' -f1)
NGINX_HTTP_HASH_BEFORE=$(md5sum deployment/nginx-http.conf 2>/dev/null | cut -d' ' -f1)

# Git операции
echo ""
echo -e "${GREEN}📥 Подтягивание обновлений...${NC}"
git stash
git pull --rebase
git stash pop || true

# Проверка изменений в nginx
NGINX_HTTPS_HASH_AFTER=$(md5sum deployment/nginx-https.conf 2>/dev/null | cut -d' ' -f1)
NGINX_HTTP_HASH_AFTER=$(md5sum deployment/nginx-http.conf 2>/dev/null | cut -d' ' -f1)

NGINX_CHANGED=false
if [ "$NGINX_HTTPS_HASH_BEFORE" != "$NGINX_HTTPS_HASH_AFTER" ] || [ "$NGINX_HTTP_HASH_BEFORE" != "$NGINX_HTTP_HASH_AFTER" ]; then
    NGINX_CHANGED=true
fi

# Backend обновление
echo ""
echo -e "${GREEN}🔧 Обновление backend...${NC}"
cd backend
sudo -u floodilka npm install --production

# Проверка синтаксиса перед рестартом
echo -e "${YELLOW}🔍 Проверка синтаксиса backend...${NC}"
if ! node -c server.js; then
    echo -e "${RED}❌ Синтаксическая ошибка в backend!${NC}"
    echo -e "${RED}Обновление прервано. Откатитесь к предыдущей версии.${NC}"
    exit 1
fi

# Graceful reload backend
echo -e "${GREEN}🔄 Graceful reload backend...${NC}"
sudo -u floodilka pm2 reload floodilka-backend --update-env

# Проверка что backend запустился
sleep 3
if ! sudo -u floodilka pm2 list | grep -q "floodilka-backend.*online"; then
    echo -e "${RED}❌ Backend не запустился!${NC}"
    echo -e "${YELLOW}Смотрите логи: sudo -u floodilka pm2 logs floodilka-backend${NC}"
    exit 1
fi

cd ..

# Frontend обновление
echo ""
echo -e "${GREEN}🎨 Обновление frontend...${NC}"
cd frontend

# Попытка обновления с обработкой ошибки ENOTEMPTY
echo -e "${YELLOW}📦 Установка зависимостей frontend...${NC}"
if ! sudo -u floodilka npm install 2>&1 | tee /tmp/npm-install.log; then
    if grep -q "ENOTEMPTY" /tmp/npm-install.log; then
        echo -e "${YELLOW}⚠️  Обнаружена ошибка ENOTEMPTY, очистка node_modules...${NC}"
        sudo -u floodilka rm -rf node_modules
        sudo -u floodilka npm cache clean --force
        echo -e "${YELLOW}🔄 Повторная установка зависимостей...${NC}"
        sudo -u floodilka npm install
    else
        echo -e "${RED}❌ Ошибка установки зависимостей frontend!${NC}"
        cat /tmp/npm-install.log
        exit 1
    fi
fi

echo -e "${YELLOW}🏗️  Сборка frontend...${NC}"
sudo -u floodilka npm run build

# Атомарная замена файлов frontend
echo -e "${GREEN}📁 Обновление frontend файлов...${NC}"
NGINX_DIR="/var/www/floodilka/public"
BUILD_DIR="/var/www/floodilka/frontend/build"
BACKUP_DIR="/var/www/floodilka/public.backup"

# Бэкап старой версии
if [ -d "$NGINX_DIR" ]; then
    rm -rf "$BACKUP_DIR"
    mv "$NGINX_DIR" "$BACKUP_DIR"
fi

# Копирование новой версии
mkdir -p "$NGINX_DIR"
cp -r "$BUILD_DIR"/* "$NGINX_DIR/"
chown -R www-data:www-data "$NGINX_DIR"

cd ..

# Nginx обновление если нужно
if [ "$NGINX_CHANGED" = true ]; then
    echo ""
    echo -e "${GREEN}🔧 Обновление nginx конфигурации...${NC}"
    cd deployment
    bash update-nginx.sh
    cd ..
fi

# Сохранение PM2
sudo -u floodilka pm2 save

echo ""
echo -e "${GREEN}✅ Обновление завершено!${NC}"
echo ""
echo -e "${GREEN}📊 Статус:${NC}"
sudo -u floodilka pm2 status

echo ""
echo -e "${YELLOW}💡 Рекомендации для пользователей:${NC}"
echo "  • Обновить страницу (F5 или Ctrl+R)"
echo "  • Переподключиться к голосовым каналам если были активны"
echo ""
echo -e "${GREEN}📜 Проверить логи:${NC}"
echo "  sudo -u floodilka pm2 logs floodilka-backend --lines 20"

