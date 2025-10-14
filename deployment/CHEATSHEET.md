# 🚀 Шпаргалка по командам floodilka

## Быстрые команды

### 🔄 Обновление
```bash
# На сервере
ssh root@your-server
cd /var/www/floodilka

# ⭐⭐⭐ ZERO-DOWNTIME обновление (САМОЕ ЛУЧШЕЕ!)
sudo bash deployment/update-zero-downtime.sh

# ⭐ Graceful обновление (минимальный downtime)
sudo bash deployment/update-graceful.sh

# Стандартное обновление (с nginx если нужно)
sudo bash deployment/update.sh

# Только nginx
sudo bash deployment/update-nginx.sh
```

**Разница между методами обновления:**
- `update-zero-downtime.sh` - ✅ PM2 cluster mode, БЕЗ простоя, автоматический rollback
- `update-graceful.sh` - PM2 reload (graceful), проверки, backup (~2-5 сек downtime)
- `update.sh` - PM2 restart (hard), быстрее но больше downtime (~5-10 сек)

**При первом использовании zero-downtime будет простой ~2-3 сек (один раз) для настройки cluster mode**

### 📊 Проверка статуса
```bash
# Backend
sudo -u floodilka pm2 status

# Мониторинг ресурсов
sudo -u floodilka pm2 monit

# Nginx
sudo systemctl status nginx

# MongoDB
sudo systemctl status mongod
```

### 📜 Логи
```bash
# Backend (в реальном времени)
sudo -u floodilka pm2 logs floodilka-backend

# Backend (последние 50 строк)
sudo -u floodilka pm2 logs floodilka-backend --lines 50

# Nginx ошибки
sudo tail -f /var/log/nginx/floodilka-error.log

# Nginx доступ
sudo tail -f /var/log/nginx/floodilka-access.log

# MongoDB
sudo journalctl -u mongod -n 50
```

### 🔄 Перезапуск
```bash
# Backend
sudo -u floodilka pm2 restart floodilka-backend

# Nginx
sudo systemctl reload nginx  # без разрыва соединений
sudo systemctl restart nginx # полный рестарт

# MongoDB
sudo systemctl restart mongod
```

### 🛠️ Отладка

```bash
# Проверить переменные окружения backend
sudo -u floodilka pm2 env floodilka-backend

# Проверить .env файл
cat /var/www/floodilka/backend/.env

# Проверить права файлов
ls -la /var/www/floodilka/backend/
ls -la /var/www/floodilka/public/

# Проверить конфигурацию nginx
sudo nginx -t

# Посмотреть активную конфигурацию
cat /etc/nginx/sites-available/floodilka
```

### 🗄️ MongoDB
```bash
# Подключиться
mongosh

# В mongosh:
show dbs                  # список баз
use floodilka            # выбрать базу
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
cd /var/www/floodilka/backend
sudo -u floodilka npm install

# Frontend
cd /var/www/floodilka/frontend
sudo -u floodilka npm install

# Очистить кеш npm
sudo -u floodilka npm cache clean --force
```

### 🧹 Очистка
```bash
# Очистить логи PM2
sudo -u floodilka pm2 flush

# Очистить старые логи nginx
sudo find /var/log/nginx -name "*.gz" -type f -delete

# Очистить npm кеш
sudo -u floodilka npm cache clean --force
```

### 🔧 Срочные исправления (Hotfix)

```bash
# 1. На локальной машине
git add .
git commit -m "hotfix: описание"
git push

# 2. На сервере
ssh root@your-server
cd /var/www/floodilka
sudo bash deployment/update.sh

# 3. Проверить
sudo -u floodilka pm2 logs --lines 50
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
sudo -u floodilka pm2 monit
```

### 🔙 Откат изменений
```bash
cd /var/www/floodilka

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
# floodilka shortcuts
alias b-update='cd /var/www/floodilka && sudo bash deployment/update-zero-downtime.sh'
alias b-update-graceful='cd /var/www/floodilka && sudo bash deployment/update-graceful.sh'
alias b-update-fast='cd /var/www/floodilka && sudo bash deployment/update.sh'
alias b-logs='sudo -u floodilka pm2 logs floodilka-backend'
alias b-status='sudo -u floodilka pm2 status'
alias b-restart='sudo -u floodilka pm2 reload floodilka-backend'
alias b-restart-hard='sudo -u floodilka pm2 restart floodilka-backend'
alias b-monit='sudo -u floodilka pm2 monit'
alias b-nginx-logs='sudo tail -f /var/log/nginx/floodilka-error.log'
alias b-nginx-reload='sudo nginx -t && sudo systemctl reload nginx'
alias b-health='curl -s http://localhost:3001/health | jq'
```

Активировать:
```bash
source ~/.bashrc
```

Использование:
```bash
b-update           # ZERO-DOWNTIME обновление (лучший способ!)
b-update-graceful  # graceful обновление (минимальный простой)
b-update-fast      # быстрое обновление
b-logs             # посмотреть логи
b-status           # статус
b-restart          # graceful перезапуск
b-restart-hard     # жесткий перезапуск (только для отладки)
b-monit            # мониторинг
b-nginx-logs       # логи nginx
b-nginx-reload     # перезагрузить nginx
b-health           # проверить здоровье backend
```

## SOS - Что-то сломалось!

### 1. Backend не отвечает
```bash
# Смотрим логи
sudo -u floodilka pm2 logs --lines 100

# Перезапускаем
sudo -u floodilka pm2 restart floodilka-backend

# Если не помогло - полный перезапуск
cd /var/www/floodilka/backend
sudo -u floodilka pm2 delete floodilka-backend
sudo -u floodilka pm2 start server.js --name floodilka-backend
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
cd /var/www/floodilka
bash deployment/deploy-frontend.sh

# Проверяем файлы
ls -la /var/www/floodilka/public/
```

### 5. Ошибки 502 Bad Gateway
```bash
# 1. Проверяем backend
sudo -u floodilka pm2 status

# 2. Если backend down - рестартим
sudo -u floodilka pm2 restart floodilka-backend

# 3. Проверяем логи
sudo -u floodilka pm2 logs
sudo tail -f /var/log/nginx/floodilka-error.log
```

## 📖 Дополнительная документация

- [ZERO-DOWNTIME.md](./ZERO-DOWNTIME.md) - ⭐⭐⭐ Zero-downtime deployment (БЕЗ простоя!)
- [DEPLOYMENT-BEST-PRACTICES.md](./DEPLOYMENT-BEST-PRACTICES.md) - ⭐ Best practices для деплоя
- [QUICK-UPDATE.md](./QUICK-UPDATE.md) - Быстрое обновление
- [DEPLOY.md](./DEPLOY.md) - Полная инструкция по деплою
- [HOTFIX-UPLOADS.md](./HOTFIX-UPLOADS.md) - Hotfix для аватаров

## 💡 Совет

**Для продакшена всегда используйте zero-downtime обновление:**
```bash
sudo bash deployment/update-zero-downtime.sh
```

Это гарантирует отсутствие простоя для активных пользователей! 🚀

