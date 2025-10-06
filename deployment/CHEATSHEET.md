# 🚀 Шпаргалка по командам Boltushka

## Быстрые команды

### 🔄 Обновление
```bash
# На сервере
ssh root@your-server
cd /var/www/boltushka

# ⭐ Graceful обновление (РЕКОМЕНДУЕТСЯ, минимальный downtime)
sudo bash deployment/update-graceful.sh

# Стандартное обновление (с nginx если нужно)
sudo bash deployment/update.sh

# Только nginx
sudo bash deployment/update-nginx.sh
```

**Разница между graceful и стандартным:**
- `update-graceful.sh` - PM2 reload (graceful), проверки, backup (~2-5 сек downtime)
- `update.sh` - PM2 restart (hard), быстрее но больше downtime (~5-10 сек)

### 📊 Проверка статуса
```bash
# Backend
sudo -u boltushka pm2 status

# Мониторинг ресурсов
sudo -u boltushka pm2 monit

# Nginx
sudo systemctl status nginx

# MongoDB
sudo systemctl status mongod
```

### 📜 Логи
```bash
# Backend (в реальном времени)
sudo -u boltushka pm2 logs boltushka-backend

# Backend (последние 50 строк)
sudo -u boltushka pm2 logs boltushka-backend --lines 50

# Nginx ошибки
sudo tail -f /var/log/nginx/boltushka-error.log

# Nginx доступ
sudo tail -f /var/log/nginx/boltushka-access.log

# MongoDB
sudo journalctl -u mongod -n 50
```

### 🔄 Перезапуск
```bash
# Backend
sudo -u boltushka pm2 restart boltushka-backend

# Nginx
sudo systemctl reload nginx  # без разрыва соединений
sudo systemctl restart nginx # полный рестарт

# MongoDB
sudo systemctl restart mongod
```

### 🛠️ Отладка

```bash
# Проверить переменные окружения backend
sudo -u boltushka pm2 env boltushka-backend

# Проверить .env файл
cat /var/www/boltushka/backend/.env

# Проверить права файлов
ls -la /var/www/boltushka/backend/
ls -la /var/www/boltushka/public/

# Проверить конфигурацию nginx
sudo nginx -t

# Посмотреть активную конфигурацию
cat /etc/nginx/sites-available/boltushka
```

### 🗄️ MongoDB
```bash
# Подключиться
mongosh

# В mongosh:
show dbs                  # список баз
use boltushka            # выбрать базу
show collections         # список коллекций
db.users.find()          # посмотреть пользователей
db.users.countDocuments() # количество пользователей
```

### 🔐 Безопасность
```bash
# Firewall статус
sudo ufw status

# SSL сертификаты
sudo certbot certificates

# Продлить SSL
sudo certbot renew
```

### 📦 NPM и зависимости
```bash
# Backend
cd /var/www/boltushka/backend
sudo -u boltushka npm install

# Frontend
cd /var/www/boltushka/frontend
sudo -u boltushka npm install

# Очистить кеш npm
sudo -u boltushka npm cache clean --force
```

### 🧹 Очистка
```bash
# Очистить логи PM2
sudo -u boltushka pm2 flush

# Очистить старые логи nginx
sudo find /var/log/nginx -name "*.gz" -type f -delete

# Очистить npm кеш
sudo -u boltushka npm cache clean --force
```

### 🔧 Срочные исправления (Hotfix)

```bash
# 1. На локальной машине
git add .
git commit -m "hotfix: описание"
git push

# 2. На сервере
ssh root@your-server
cd /var/www/boltushka
sudo bash deployment/update.sh

# 3. Проверить
sudo -u boltushka pm2 logs --lines 50
```

### 📊 Мониторинг производительности
```bash
# Процессы
htop

# Диск
df -h

# Память
free -h

# Сеть
sudo netstat -tulpn | grep LISTEN

# PM2 мониторинг
sudo -u boltushka pm2 monit
```

### 🔙 Откат изменений
```bash
cd /var/www/boltushka

# Посмотреть историю
git log --oneline -10

# Откатиться к конкретному коммиту
git reset --hard <commit-hash>

# Пересобрать
sudo bash deployment/update.sh
```

## Полезные алиасы

Добавьте в `~/.bashrc`:

```bash
# Boltushka shortcuts
alias b-update='cd /var/www/boltushka && sudo bash deployment/update-graceful.sh'
alias b-update-fast='cd /var/www/boltushka && sudo bash deployment/update.sh'
alias b-logs='sudo -u boltushka pm2 logs boltushka-backend'
alias b-status='sudo -u boltushka pm2 status'
alias b-restart='sudo -u boltushka pm2 reload boltushka-backend'
alias b-restart-hard='sudo -u boltushka pm2 restart boltushka-backend'
alias b-monit='sudo -u boltushka pm2 monit'
alias b-nginx-logs='sudo tail -f /var/log/nginx/boltushka-error.log'
alias b-nginx-reload='sudo nginx -t && sudo systemctl reload nginx'
```

Активировать:
```bash
source ~/.bashrc
```

Использование:
```bash
b-update         # graceful обновление (рекомендуется)
b-update-fast    # быстрое обновление
b-logs           # посмотреть логи
b-status         # статус
b-restart        # graceful перезапуск
b-restart-hard   # жесткий перезапуск (только для отладки)
b-monit          # мониторинг
b-nginx-logs     # логи nginx
b-nginx-reload   # перезагрузить nginx
```

## SOS - Что-то сломалось!

### 1. Backend не отвечает
```bash
# Смотрим логи
sudo -u boltushka pm2 logs --lines 100

# Перезапускаем
sudo -u boltushka pm2 restart boltushka-backend

# Если не помогло - полный перезапуск
cd /var/www/boltushka/backend
sudo -u boltushka pm2 delete boltushka-backend
sudo -u boltushka pm2 start server.js --name boltushka-backend
```

### 2. Nginx не работает
```bash
# Проверяем конфигурацию
sudo nginx -t

# Смотрим логи
sudo tail -f /var/log/nginx/error.log

# Перезапускаем
sudo systemctl restart nginx
```

### 3. MongoDB не подключается
```bash
# Проверяем статус
sudo systemctl status mongod

# Смотрим логи
sudo journalctl -u mongod -n 50

# Перезапускаем
sudo systemctl restart mongod
```

### 4. Frontend не обновился
```bash
# Очищаем кеш браузера: Ctrl+Shift+R (или Cmd+Shift+R)

# Пересобираем frontend
cd /var/www/boltushka
bash deployment/deploy-frontend.sh

# Проверяем файлы
ls -la /var/www/boltushka/public/
```

### 5. Ошибки 502 Bad Gateway
```bash
# 1. Проверяем backend
sudo -u boltushka pm2 status

# 2. Если backend down - рестартим
sudo -u boltushka pm2 restart boltushka-backend

# 3. Проверяем логи
sudo -u boltushka pm2 logs
sudo tail -f /var/log/nginx/boltushka-error.log
```

## 📖 Дополнительная документация

- [DEPLOYMENT-BEST-PRACTICES.md](./DEPLOYMENT-BEST-PRACTICES.md) - ⭐ Best practices для деплоя
- [QUICK-UPDATE.md](./QUICK-UPDATE.md) - Быстрое обновление
- [DEPLOY.md](./DEPLOY.md) - Полная инструкция по деплою
- [HOTFIX-UPLOADS.md](./HOTFIX-UPLOADS.md) - Hotfix для аватаров

## 💡 Совет

**Для продакшена всегда используйте graceful обновление:**
```bash
sudo bash deployment/update-graceful.sh
```

Это минимизирует влияние на активных пользователей!

