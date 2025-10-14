#!/bin/bash

# Единоразовая настройка PM2 cluster mode для zero-downtime deployment
# Использование: sudo bash setup-cluster.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  ⚙️  Настройка PM2 Cluster Mode                   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════╝${NC}"
echo ""

# Проверка прав
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Этот скрипт требует прав root${NC}"
    echo "Запустите: sudo bash setup-cluster.sh"
    exit 1
fi

PROJECT_DIR="/var/www/floodilka"
USER="floodilka"

# Проверка что проект существует
if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${RED}❌ Проект не найден в $PROJECT_DIR${NC}"
    exit 1
fi

cd "$PROJECT_DIR"

echo -e "${GREEN}📋 Шаг 1/4: Проверка текущего статуса${NC}"
echo ""

# Проверка текущего режима PM2
if sudo -u $USER pm2 list | grep -q "floodilka-backend"; then
    CURRENT_MODE=$(sudo -u $USER pm2 describe floodilka-backend 2>/dev/null | grep "exec mode" | awk '{print $4}' || echo "unknown")
    echo -e "${BLUE}Текущий режим: ${CURRENT_MODE}${NC}"

    if [ "$CURRENT_MODE" = "cluster_mode" ]; then
        echo -e "${GREEN}✓ Backend уже работает в cluster mode!${NC}"
        echo ""
        sudo -u $USER pm2 status
        echo ""
        echo -e "${GREEN}✅ Всё готово! Можете использовать update-zero-downtime.sh${NC}"
        exit 0
    fi
else
    echo -e "${YELLOW}⚠️  Backend не запущен${NC}"
fi

echo ""
echo -e "${YELLOW}⚠️  Для настройки cluster mode потребуется перезапуск backend${NC}"
echo -e "${YELLOW}   Простой составит примерно 2-3 секунды${NC}"
echo ""
read -p "Продолжить? (y/N): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}ℹ️  Настройка отменена${NC}"
    exit 0
fi

echo ""
echo -e "${GREEN}📦 Шаг 2/4: Подготовка конфигурации${NC}"
echo ""

# Создаем директорию для логов
mkdir -p "$PROJECT_DIR/logs"
chown -R $USER:$USER "$PROJECT_DIR/logs"

# Копируем ecosystem config
if [ ! -f "$PROJECT_DIR/deployment/ecosystem.config.js" ]; then
    echo -e "${RED}❌ Файл ecosystem.config.js не найден!${NC}"
    exit 1
fi

cp "$PROJECT_DIR/deployment/ecosystem.config.js" "$PROJECT_DIR/backend/"
chown $USER:$USER "$PROJECT_DIR/backend/ecosystem.config.js"

echo -e "${GREEN}✓ Конфигурация подготовлена${NC}"

echo ""
echo -e "${GREEN}🔄 Шаг 3/4: Переключение в cluster mode${NC}"
echo ""

cd "$PROJECT_DIR/backend"

# Останавливаем старый процесс
echo -e "${BLUE}Остановка старого процесса...${NC}"
sudo -u $USER pm2 delete floodilka-backend 2>/dev/null || true
sleep 1

# Запускаем через ecosystem (cluster mode)
echo -e "${BLUE}Запуск в cluster mode...${NC}"
sudo -u $USER pm2 start ecosystem.config.js --env production

# Ждем стабилизации
sleep 3

# Сохраняем конфигурацию
sudo -u $USER pm2 save

echo ""
echo -e "${GREEN}🏥 Шаг 4/4: Проверка здоровья${NC}"
echo ""

# Проверка что все инстансы запустились
for i in {1..10}; do
    ONLINE_COUNT=$(sudo -u $USER pm2 list | grep "floodilka-backend.*online" | wc -l)

    if [ "$ONLINE_COUNT" -ge 2 ]; then
        echo -e "${GREEN}✓ Cluster mode активен: $ONLINE_COUNT инстансов online${NC}"
        break
    fi

    if [ $i -eq 10 ]; then
        echo -e "${RED}❌ Не удалось запустить cluster mode!${NC}"
        echo -e "${YELLOW}Логи:${NC}"
        sudo -u $USER pm2 logs floodilka-backend --lines 30 --nostream
        exit 1
    fi

    echo -e "${YELLOW}Ожидание запуска... попытка $i/10${NC}"
    sleep 2
done

# Healthcheck
echo -e "${BLUE}Проверка доступности API...${NC}"
sleep 2

if curl -f -s http://localhost:3001/health >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend отвечает на запросы${NC}"
else
    echo -e "${YELLOW}⚠️  Backend не отвечает на /health (это может быть нормально)${NC}"
fi

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  ✅ Cluster Mode настроен!                         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${GREEN}📊 Статус PM2:${NC}"
sudo -u $USER pm2 status
echo ""

echo -e "${GREEN}✨ Что дальше:${NC}"
echo "  • Теперь можете использовать zero-downtime deployment"
echo "  • Команда: sudo bash deployment/update-zero-downtime.sh"
echo "  • Все обновления будут БЕЗ простоя!"
echo ""

echo -e "${BLUE}📜 Документация:${NC}"
echo "  cat deployment/ZERO-DOWNTIME.md"
echo ""

echo -e "${GREEN}🎉 Готово!${NC}"

