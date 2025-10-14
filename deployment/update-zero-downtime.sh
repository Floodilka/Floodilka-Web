#!/bin/bash

# Zero-downtime обновление floodilka
# Использование: sudo bash update-zero-downtime.sh
#
# Особенности:
# - Backend обновляется через PM2 cluster mode без простоя
# - Frontend собирается отдельно и заменяется атомарно
# - Nginx показывает maintenance page только при критических ошибках
# - Автоматический rollback при проблемах

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Конфигурация
PROJECT_DIR="/var/www/floodilka"
BACKUP_DIR="/var/www/floodilka-backup-$(date +%Y%m%d-%H%M%S)"
FRONTEND_BUILD_DIR="/var/www/floodilka/frontend/build"
FRONTEND_PUBLIC_DIR="/var/www/floodilka/public"
LOGS_DIR="/var/www/floodilka/logs"
USER="floodilka"

# Создание директории для логов если её нет
mkdir -p "$LOGS_DIR"
chown -R $USER:$USER "$LOGS_DIR"

echo -e "${BLUE}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  🚀 Zero-Downtime Deployment для Floodilka        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════╝${NC}"
echo ""

# Проверка прав
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Этот скрипт требует прав root${NC}"
    echo "Запустите: sudo bash update-zero-downtime.sh"
    exit 1
fi

# Функция для отката
rollback() {
    echo ""
    echo -e "${RED}❌ Произошла ошибка! Выполняю откат...${NC}"

    if [ -d "$BACKUP_DIR/backend" ]; then
        echo -e "${YELLOW}🔄 Откат backend...${NC}"
        cd "$PROJECT_DIR/backend"
        rm -rf node_modules package-lock.json
        cp -r "$BACKUP_DIR/backend/"* .
        sudo -u $USER pm2 reload floodilka-backend
    fi

    if [ -d "$BACKUP_DIR/frontend/build" ]; then
        echo -e "${YELLOW}🔄 Откат frontend...${NC}"
        rm -rf "$FRONTEND_PUBLIC_DIR"
        cp -r "$BACKUP_DIR/frontend/build" "$FRONTEND_PUBLIC_DIR"
        chown -R www-data:www-data "$FRONTEND_PUBLIC_DIR"
    fi

    echo -e "${RED}❌ Откат завершен. Проверьте логи для диагностики.${NC}"
    exit 1
}

# Установка trap для автоматического отката
trap rollback ERR

# ============================================================================
# ЭТАП 1: Подготовка и валидация
# ============================================================================

echo -e "${GREEN}📋 Этап 1/5: Подготовка и валидация${NC}"
echo ""

# Проверка что мы в правильной директории
cd "$PROJECT_DIR"

# Проверка активных соединений
echo -e "${BLUE}📊 Проверка статуса сервера...${NC}"
if sudo -u $USER pm2 list | grep -q "floodilka-backend.*online"; then
    CURRENT_CONNECTIONS=$(sudo -u $USER pm2 describe floodilka-backend 2>/dev/null | grep -c "online" || echo "0")
    echo -e "${BLUE}   Backend активен (инстансов: $CURRENT_CONNECTIONS)${NC}"
else
    echo -e "${YELLOW}⚠️  Backend не запущен!${NC}"
fi

# Создание бэкапа
echo ""
echo -e "${BLUE}💾 Создание резервной копии...${NC}"
mkdir -p "$BACKUP_DIR/backend"
mkdir -p "$BACKUP_DIR/frontend"

# Бэкап backend
cp -r "$PROJECT_DIR/backend/server.js" "$BACKUP_DIR/backend/" 2>/dev/null || true
cp -r "$PROJECT_DIR/backend/package.json" "$BACKUP_DIR/backend/" 2>/dev/null || true
cp -r "$PROJECT_DIR/backend/.env" "$BACKUP_DIR/backend/" 2>/dev/null || true

# Бэкап frontend build
if [ -d "$FRONTEND_PUBLIC_DIR" ]; then
    cp -r "$FRONTEND_PUBLIC_DIR" "$BACKUP_DIR/frontend/build"
fi

echo -e "${GREEN}✓ Резервная копия создана: $BACKUP_DIR${NC}"

# ============================================================================
# ЭТАП 2: Git обновление
# ============================================================================

echo ""
echo -e "${GREEN}📥 Этап 2/5: Получение обновлений из Git${NC}"
echo ""

# Проверка на локальные изменения
if ! git diff-index --quiet HEAD --; then
    echo -e "${YELLOW}⚠️  Обнаружены локальные изменения:${NC}"
    git status --short
    echo ""
    read -p "Сбросить локальные изменения и продолжить? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}ℹ️  Обновление отменено${NC}"
        exit 0
    fi
fi

# Получение обновлений
echo -e "${BLUE}🔄 Получение изменений...${NC}"
git fetch origin
CURRENT_COMMIT=$(git rev-parse HEAD)
LATEST_COMMIT=$(git rev-parse origin/main)

if [ "$CURRENT_COMMIT" == "$LATEST_COMMIT" ]; then
    echo -e "${GREEN}✓ Репозиторий уже актуален${NC}"
    echo ""
    read -p "Продолжить обновление зависимостей и rebuild? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}ℹ️  Обновление отменено${NC}"
        exit 0
    fi
else
    echo -e "${BLUE}📦 Найдены обновления:${NC}"
    git log --oneline $CURRENT_COMMIT..$LATEST_COMMIT | head -5
    echo ""
fi

git reset --hard origin/main
git clean -fd

echo -e "${GREEN}✓ Код обновлен${NC}"

# ============================================================================
# ЭТАП 3: Backend обновление (ZERO DOWNTIME)
# ============================================================================

echo ""
echo -e "${GREEN}🔧 Этап 3/5: Обновление Backend (zero downtime)${NC}"
echo ""

cd "$PROJECT_DIR/backend"

# Проверка .env
echo -e "${BLUE}🔍 Проверка конфигурации...${NC}"
if [ ! -f .env ]; then
    echo -e "${RED}❌ Файл .env не найден!${NC}"
    exit 1
fi

# Установка зависимостей БЕЗ остановки сервера
echo -e "${BLUE}📦 Обновление зависимостей backend...${NC}"
sudo -u $USER npm install --production --no-audit --no-fund --prefer-offline

# Валидация синтаксиса
echo -e "${BLUE}🔍 Проверка синтаксиса...${NC}"
if ! node -c server.js; then
    echo -e "${RED}❌ Синтаксическая ошибка в server.js!${NC}"
    rollback
fi

# Проверка что все необходимые модули есть
if ! node -e "require('./server.js')" 2>/dev/null; then
    echo -e "${YELLOW}⚠️  Предупреждение: Не удалось загрузить server.js для проверки${NC}"
fi

# Проверка/настройка PM2 cluster mode
echo -e "${BLUE}🔄 Настройка PM2 cluster mode...${NC}"

# Копируем ecosystem config
cp "$PROJECT_DIR/deployment/ecosystem.config.js" "$PROJECT_DIR/backend/"
chown $USER:$USER "$PROJECT_DIR/backend/ecosystem.config.js"

# Проверяем текущий режим PM2
CURRENT_MODE=$(sudo -u $USER pm2 describe floodilka-backend 2>/dev/null | grep "exec mode" | awk '{print $4}' || echo "unknown")

if [ "$CURRENT_MODE" != "cluster_mode" ]; then
    echo -e "${YELLOW}⚠️  Backend работает не в cluster mode. Переключаю...${NC}"
    echo -e "${YELLOW}   Это вызовет кратковременный простой (~2-3 сек)${NC}"

    # Останавливаем старый инстанс
    sudo -u $USER pm2 delete floodilka-backend 2>/dev/null || true

    # Запускаем через ecosystem
    sudo -u $USER pm2 start ecosystem.config.js --env production
    sudo -u $USER pm2 save

    echo -e "${GREEN}✓ PM2 cluster mode настроен${NC}"
else
    # Graceful reload в cluster mode
    # PM2 запустит новые инстансы, дождется их готовности,
    # и только потом убьет старые - ZERO DOWNTIME!
    echo -e "${BLUE}♻️  Graceful reload (zero downtime)...${NC}"
    sudo -u $USER pm2 reload ecosystem.config.js --env production --update-env
fi

# Ждем стабилизации
echo -e "${BLUE}⏳ Ожидание стабилизации backend...${NC}"
sleep 5

# Healthcheck
echo -e "${BLUE}🏥 Проверка здоровья backend...${NC}"
for i in {1..10}; do
    if sudo -u $USER pm2 list | grep -q "floodilka-backend.*online"; then
        # Проверяем что backend отвечает
        if curl -f -s http://localhost:3001/api/health >/dev/null 2>&1 || \
           curl -f -s http://localhost:3001/ >/dev/null 2>&1; then
            echo -e "${GREEN}✓ Backend работает корректно${NC}"
            break
        fi
    fi

    if [ $i -eq 10 ]; then
        echo -e "${RED}❌ Backend не отвечает после reload!${NC}"
        echo -e "${YELLOW}Логи:${NC}"
        sudo -u $USER pm2 logs floodilka-backend --lines 30 --nostream
        rollback
    fi

    echo -e "${YELLOW}   Попытка $i/10...${NC}"
    sleep 2
done

cd "$PROJECT_DIR"

# ============================================================================
# ЭТАП 4: Frontend обновление
# ============================================================================

echo ""
echo -e "${GREEN}🎨 Этап 4/5: Обновление Frontend${NC}"
echo ""

cd "$PROJECT_DIR/frontend"

# Установка зависимостей
echo -e "${BLUE}📦 Установка зависимостей frontend...${NC}"
sudo -u $USER npm install --no-audit --no-fund --prefer-offline 2>&1 | tee /tmp/npm-frontend-install.log
NPM_EXIT_CODE=${PIPESTATUS[0]}

if [ $NPM_EXIT_CODE -ne 0 ]; then
    if grep -q "ENOTEMPTY" /tmp/npm-frontend-install.log; then
        echo -e "${YELLOW}⚠️  Ошибка ENOTEMPTY, очистка...${NC}"
        sudo -u $USER rm -rf node_modules package-lock.json
        sudo -u $USER npm cache clean --force
        sudo -u $USER npm install --no-audit --no-fund
    else
        echo -e "${RED}❌ Ошибка установки зависимостей frontend!${NC}"
        rollback
    fi
fi

# Сборка frontend
echo -e "${BLUE}🏗️  Сборка frontend (2-5 минут)...${NC}"
sudo -u $USER NODE_OPTIONS="--max-old-space-size=2048" npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Ошибка сборки frontend!${NC}"
    rollback
fi

# Проверка что build создан
if [ ! -d "$FRONTEND_BUILD_DIR" ] || [ ! -f "$FRONTEND_BUILD_DIR/index.html" ]; then
    echo -e "${RED}❌ Сборка frontend не содержит index.html!${NC}"
    rollback
fi

# Атомарная замена frontend файлов
echo -e "${BLUE}📦 Замена frontend файлов...${NC}"

# Создаем временную директорию для новой версии
TEMP_DIR="/var/www/floodilka-frontend-new"
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR"

# Копируем новую версию
cp -r "$FRONTEND_BUILD_DIR/"* "$TEMP_DIR/"
chown -R www-data:www-data "$TEMP_DIR"

# Атомарная замена (rename is atomic operation)
OLD_DIR="${FRONTEND_PUBLIC_DIR}.old"
rm -rf "$OLD_DIR"

if [ -d "$FRONTEND_PUBLIC_DIR" ]; then
    mv "$FRONTEND_PUBLIC_DIR" "$OLD_DIR"
fi

mv "$TEMP_DIR" "$FRONTEND_PUBLIC_DIR"

echo -e "${GREEN}✓ Frontend обновлен${NC}"

cd "$PROJECT_DIR"

# ============================================================================
# ЭТАП 5: Финализация
# ============================================================================

echo ""
echo -e "${GREEN}🏁 Этап 5/5: Финализация${NC}"
echo ""

# Проверка изменений nginx
echo -e "${BLUE}🔍 Проверка конфигурации nginx...${NC}"
if ! sudo nginx -t 2>/dev/null; then
    echo -e "${YELLOW}⚠️  Конфигурация nginx требует проверки${NC}"
else
    # Reload nginx для подхвата возможных изменений
    echo -e "${BLUE}🔄 Обновление nginx...${NC}"
    sudo systemctl reload nginx
fi

# Сохранение PM2 конфигурации
sudo -u $USER pm2 save

# Очистка старых файлов (опционально)
echo -e "${BLUE}🧹 Очистка...${NC}"
rm -rf "${FRONTEND_PUBLIC_DIR}.old"

# Удаляем старые бэкапы (оставляем только последние 3)
ls -dt /var/www/floodilka-backup-* 2>/dev/null | tail -n +4 | xargs rm -rf 2>/dev/null || true

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  ✅ Обновление завершено успешно!                 ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}📊 Статус сервера:${NC}"
sudo -u $USER pm2 status
echo ""
echo -e "${GREEN}🎉 Zero-downtime deployment выполнен!${NC}"
echo ""
echo -e "${YELLOW}💡 Что дальше:${NC}"
echo "  • Пользователи могут продолжать работу без перезагрузки"
echo "  • Frontend обновится автоматически при следующем переходе"
echo "  • Для немедленного обновления UI: Ctrl+F5 или Cmd+Shift+R"
echo ""
echo -e "${BLUE}📜 Проверить логи:${NC}"
echo "  sudo -u $USER pm2 logs floodilka-backend --lines 50"
echo ""
echo -e "${BLUE}💾 Резервная копия сохранена:${NC}"
echo "  $BACKUP_DIR"
echo ""
echo -e "${GREEN}✨ Готово!${NC}"

