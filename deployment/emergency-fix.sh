#!/bin/bash

# Экстренное восстановление при зависании сборки/обновления
# Использование: sudo bash emergency-fix.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🚨 Экстренное восстановление Floodilka...${NC}"
echo ""

# Проверка прав
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Требуются права root${NC}"
    echo "Запустите: sudo bash emergency-fix.sh"
    exit 1
fi

echo -e "${YELLOW}1️⃣  Убиваем зависшие процессы сборки...${NC}"
pkill -9 -f "react-scripts build" 2>/dev/null || echo "  Нет процессов react-scripts"
pkill -9 -f "npm install" 2>/dev/null || echo "  Нет процессов npm install"

# Не трогаем PM2 процессы!
ps aux | grep node | grep -v PM2 | grep -v grep | awk '{print $2}' | while read pid; do
    cmdline=$(ps -p $pid -o command --no-headers)
    if [[ ! "$cmdline" =~ "PM2" ]] && [[ ! "$cmdline" =~ "server.js" ]]; then
        echo "  Убиваю зависший процесс: $pid"
        kill -9 $pid 2>/dev/null || true
    fi
done

echo -e "${GREEN}✓ Зависшие процессы очищены${NC}"
echo ""

echo -e "${YELLOW}2️⃣  Проверяем backend...${NC}"
if ! sudo -u floodilka pm2 list | grep -q "floodilka-backend.*online"; then
    echo -e "${YELLOW}  Backend не запущен, запускаю...${NC}"
    cd /var/www/floodilka/backend
    sudo -u floodilka pm2 start server.js --name floodilka-backend 2>/dev/null || sudo -u floodilka pm2 restart floodilka-backend
    sudo -u floodilka pm2 save
else
    echo -e "${GREEN}  Backend работает${NC}"
fi
echo ""

echo -e "${YELLOW}3️⃣  Проверяем swap...${NC}"
if ! swapon --show | grep -q "/swapfile"; then
    echo -e "${YELLOW}  Swap не настроен, создаю 2GB swap...${NC}"
    if [ ! -f /swapfile ]; then
        fallocate -l 2G /swapfile
        chmod 600 /swapfile
        mkswap /swapfile
    fi
    swapon /swapfile
    if ! grep -q "/swapfile" /etc/fstab; then
        echo '/swapfile none swap sw 0 0' >> /etc/fstab
    fi
    echo -e "${GREEN}  Swap активирован${NC}"
else
    echo -e "${GREEN}  Swap уже настроен${NC}"
fi
echo ""

echo -e "${YELLOW}4️⃣  Очищаем проблемные файлы frontend...${NC}"
cd /var/www/floodilka/frontend
if [ -d "node_modules" ]; then
    echo -e "${YELLOW}  Удаляю node_modules...${NC}"
    sudo -u floodilka rm -rf node_modules
fi
sudo -u floodilka npm cache clean --force
echo -e "${GREEN}✓ node_modules очищен${NC}"
echo ""

echo -e "${YELLOW}5️⃣  Проверяем память...${NC}"
free -h
echo ""

echo -e "${GREEN}✅ Экстренное восстановление завершено!${NC}"
echo ""
echo -e "${YELLOW}🚀 Запускаю graceful update...${NC}"
echo ""

cd /var/www/floodilka
bash deployment/update-graceful.sh

