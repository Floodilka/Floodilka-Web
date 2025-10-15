#!/bin/bash

# Отключение режима технических работ для Floodilka
# Использование: sudo bash disable-maintenance.sh

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

NGINX_CONFIG="/etc/nginx/sites-available/floodilka"

echo -e "${BLUE}🚀 Отключение режима технических работ...${NC}"

# Проверка прав
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Этот скрипт требует прав root${NC}"
    echo "Запустите: sudo bash disable-maintenance.sh"
    exit 1
fi

# Проверка что backend работает
echo -e "${BLUE}🔍 Проверка статуса backend...${NC}"
if pm2 list | grep -q "floodilka-backend.*online"; then
    echo -e "${GREEN}✓ Backend работает${NC}"
else
    echo -e "${YELLOW}⚠️  Backend не запущен!${NC}"
    echo -e "${YELLOW}   Рекомендуется запустить backend перед отключением maintenance режима${NC}"
    echo ""
    read -p "Продолжить отключение maintenance режима? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}ℹ️  Отключение отменено${NC}"
        exit 0
    fi
fi

# Отключение maintenance режима
rm -f /var/www/floodilka/maintenance.flag
echo -e "${GREEN}✓ Maintenance режим отключен${NC}"

# Проверка конфигурации nginx
if nginx -t 2>/dev/null; then
    echo -e "${GREEN}✓ Конфигурация nginx корректна${NC}"

    # Перезагрузка nginx
    systemctl reload nginx
    echo -e "${GREEN}✓ Nginx перезагружен${NC}"

    echo ""
    echo -e "${GREEN}✅ Сайт снова доступен!${NC}"
    echo -e "${GREEN}   Пользователи могут использовать Floodilka${NC}"
    echo ""
    echo -e "${BLUE}💡 Для включения maintenance режима используйте:${NC}"
    echo "   sudo bash enable-maintenance.sh"
else
    echo -e "${RED}❌ Ошибка в конфигурации nginx!${NC}"
    exit 1
fi
