# 🚀 Быстрое обновление floodilka

## Процесс деплоя минорных обновлений

### ⭐ Вариант 1: Graceful Update (РЕКОМЕНДУЕТСЯ)

**Используйте когда:** Есть активные пользователи онлайн

```bash
# Войти на сервер
ssh root@your-server

# Перейти в проект
cd /var/www/floodilka

# Graceful обновление с минимальным downtime
sudo bash deployment/update-graceful.sh
```

**Преимущества:**
- ✅ Проверка активных пользователей перед обновлением
- ✅ Graceful reload backend (PM2 reload вместо restart)
- ✅ Проверка синтаксиса перед применением
- ✅ Атомарная замена frontend файлов
- ✅ Автоматический backup старой версии
- ✅ Минимальный downtime (~2-5 сек)

**Что происходит:**
- WebSocket соединения разрываются на 2-5 секунд
- Пользователи автоматически переподключаются
- Голосовые звонки прервутся (пользователи должны переподключиться)

### Вариант 2: Стандартное обновление

**Используйте когда:** Нет активных пользователей или срочный hotfix

```bash
# Войти на сервер
ssh root@your-server

# Перейти в проект
cd /var/www/floodilka

# Стандартное обновление
sudo bash deployment/update.sh
```

Этот скрипт автоматически:
- ✅ Сохранит локальные изменения (git stash)
- ✅ Подтянет обновления (git pull)
- ✅ Восстановит локальные изменения
- ✅ Обнаружит изменения в nginx (если есть)
- ✅ Обновит backend (npm install + PM2 restart)
- ✅ Соберет и задеплоит frontend

### Вариант 3: Только nginx

Если нужно обновить только конфигурацию nginx:

```bash
sudo bash /var/www/floodilka/deployment/update-nginx.sh
```

## ⏰ Когда деплоить?

### 🟢 Лучшее время (минимум пользователей):
- 🌙 02:00 - 06:00 МСК (ночь)
- 📊 Проверить активность: `sudo -u floodilka pm2 logs --lines 20`

### 🟡 Приемлемое время:
- 🌅 09:00 - 11:00 МСК (утро)
- 🌃 22:00 - 00:00 МСК (поздний вечер)

### 🔴 Избегать:
- 🔥 18:00 - 22:00 МСК (пик активности)
- 🎉 Выходные/праздники (если есть активность)

📖 Подробнее: [DEPLOYMENT-BEST-PRACTICES.md](./DEPLOYMENT-BEST-PRACTICES.md)

## Проверка после обновления

```bash
# Проверить статус приложения
sudo -u floodilka pm2 status

# Посмотреть логи backend
sudo -u floodilka pm2 logs floodilka-backend --lines 50

# Посмотреть логи nginx
sudo tail -f /var/log/nginx/floodilka-error.log

# Проверить статус nginx
sudo systemctl status nginx
```

## Типичный workflow

### На локальной машине:
```bash
# 1. Внести изменения
# 2. Протестировать локально
npm start  # frontend
npm start  # backend

# 3. Закоммитить
git add .
git commit -m "Описание изменений"
git push
```

### На сервере:
```bash
# 1. Подключиться к серверу
ssh root@your-server

# 2. Обновить
cd /var/www/floodilka

# Если есть изменения в nginx:
sudo bash deployment/update.sh

# Если нет изменений в nginx:
bash deployment/update.sh

# 3. Проверить
sudo -u floodilka pm2 logs floodilka-backend
```

## Откат изменений

Если что-то пошло не так:

```bash
# Откатить к предыдущему коммиту
cd /var/www/floodilka
git log --oneline  # посмотреть историю
git reset --hard <commit-hash>  # откатиться

# Перезапустить
sudo bash deployment/update.sh
```

## Частые ошибки

### Ошибка: "Please commit your changes or stash them"
```bash
# Сбросить локальные изменения
git reset --hard HEAD
bash deployment/update.sh
```

### Backend не запускается после обновления
```bash
# Посмотреть логи
sudo -u floodilka pm2 logs floodilka-backend

# Проверить env переменные
sudo -u floodilka pm2 env floodilka-backend

# Перезапустить вручную
cd /var/www/floodilka/backend
sudo -u floodilka pm2 restart floodilka-backend
```

### Frontend не обновился
```bash
# Очистить кеш браузера (Ctrl+Shift+R или Cmd+Shift+R)
# Или проверить файлы:
ls -la /var/www/floodilka/public/

# Пересобрать вручную:
cd /var/www/floodilka
bash deployment/deploy-frontend.sh
```

## Мониторинг

```bash
# Статус всех сервисов
sudo systemctl status nginx
sudo systemctl status mongodb
sudo -u floodilka pm2 status

# Использование ресурсов
sudo -u floodilka pm2 monit

# Логи в реальном времени
sudo -u floodilka pm2 logs --lines 100
```

## Redis / Socket.IO адаптер

- Используете `REDIS_URL`? Перед деплоем убедитесь, что Redis доступен: `redis-cli -u "$REDIS_URL" ping` должен вернуть `PONG`.
- После обновления проверьте логи backend — строка `Socket.IO Redis adapter активирован` подтверждает, что все инстансы синхронизируются через Redis.
- При ошибке подключения приложение продолжит работу с локальным адаптером, но presence будет ограничен текущим процессом.

## Полезные алиасы

Добавьте в `~/.bashrc` для удобства:

```bash
alias floodilka-update='cd /var/www/floodilka && sudo bash deployment/update.sh'
alias floodilka-logs='sudo -u floodilka pm2 logs floodilka-backend'
alias floodilka-status='sudo -u floodilka pm2 status'
alias floodilka-restart='sudo -u floodilka pm2 restart floodilka-backend'
```

После добавления выполните:
```bash
source ~/.bashrc
```

Теперь можно просто писать:
```bash
floodilka-update    # обновить
floodilka-logs      # посмотреть логи
floodilka-status    # статус
```
