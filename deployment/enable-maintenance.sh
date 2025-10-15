#!/bin/bash

# Включение режима технических работ для Floodilka
# Использование: sudo bash enable-maintenance.sh

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

NGINX_CONFIG="/etc/nginx/sites-available/floodilka"
NGINX_BACKUP="/etc/nginx/sites-available/floodilka.backup.$(date +%Y%m%d-%H%M%S)"

echo -e "${BLUE}🔧 Включение режима технических работ...${NC}"

# Проверка прав
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Этот скрипт требует прав root${NC}"
    echo "Запустите: sudo bash enable-maintenance.sh"
    exit 1
fi

# Создание директории для maintenance страницы
mkdir -p /var/www/floodilka/maintenance
cp /var/www/floodilka/deployment/maintenance.html /var/www/floodilka/maintenance/
chown -R www-data:www-data /var/www/floodilka/maintenance

# Создание резервной копии конфигурации nginx
if [ -f "$NGINX_CONFIG" ]; then
    cp "$NGINX_CONFIG" "$NGINX_BACKUP"
    echo -e "${GREEN}✓ Резервная копия создана: $NGINX_BACKUP${NC}"
fi

# Включение maintenance режима
echo "maintenance" > /var/www/floodilka/maintenance.flag
chown www-data:www-data /var/www/floodilka/maintenance.flag
echo -e "${GREEN}✓ Maintenance режим включен${NC}"

# Проверка конфигурации nginx
if nginx -t 2>/dev/null; then
    echo -e "${GREEN}✓ Конфигурация nginx корректна${NC}"

    # Перезагрузка nginx
    systemctl reload nginx
    echo -e "${GREEN}✓ Nginx перезагружен${NC}"

    echo ""
    echo -e "${YELLOW}⚠️  Режим технических работ АКТИВЕН${NC}"
    echo -e "${YELLOW}   Пользователи видят страницу технических работ${NC}"
    echo ""
    echo -e "${BLUE}💡 Для отключения используйте:${NC}"
    echo "   sudo bash disable-maintenance.sh"
else
    echo -e "${RED}❌ Ошибка в конфигурации nginx!${NC}"
    echo "Удаляю флаг maintenance..."

    rm -f /var/www/floodilka/maintenance.flag
    echo -e "${GREEN}✓ Флаг maintenance удален${NC}"

    exit 1
fi
