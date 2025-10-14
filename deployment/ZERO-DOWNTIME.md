# 🚀 Zero-Downtime Deployment для Floodilka

Руководство по обновлению сервера без простоя для пользователей.

## 📋 Содержание

- [Что это такое](#что-это-такое)
- [Как это работает](#как-это-работает)
- [Быстрый старт](#быстрый-старт)
- [Первоначальная настройка](#первоначальная-настройка)
- [Использование](#использование)
- [Troubleshooting](#troubleshooting)

## Что это такое

Zero-downtime deployment - это процесс обновления приложения без прерывания обслуживания пользователей.

### Проблемы старого подхода:
- ❌ Backend перезапускается и недоступен 2-5 секунд
- ❌ WebSocket соединения рвутся
- ❌ Голосовые звонки прерываются
- ❌ Пользователи видят ошибки 500/502

### Преимущества нового подхода:
- ✅ Backend работает постоянно (cluster mode)
- ✅ Существующие соединения не рвутся
- ✅ Новые инстансы запускаются до остановки старых
- ✅ Автоматический rollback при ошибках
- ✅ Healthcheck перед переключением

## Как это работает

### 1. PM2 Cluster Mode

```
Было:
[Backend] → pm2 reload → [простой 2-5 сек] → [Backend]
          ❌ пользователи видят ошибки

Стало:
[Backend Instance 1] ────────────────────────> [работает]
[Backend Instance 2] ────────────────────────> [работает]
                     ↓
          [New Instance 1] запускается
          [New Instance 2] запускается
                     ↓
          healthcheck ✓
                     ↓
          [Old Instance 1] остановлен
          [Old Instance 2] остановлен

✅ Всегда минимум 2 инстанса онлайн
```

### 2. Graceful Reload Process

```bash
1. git pull                    # получаем новый код
2. npm install                 # обновляем зависимости (backend работает)
3. pm2 reload (cluster mode)   # ZERO DOWNTIME:
   ├─ Запуск новых инстансов
   ├─ Ожидание ready signal
   ├─ Healthcheck
   ├─ Остановка старых инстансов (graceful shutdown)
   └─ Готово! Пользователи ничего не заметили
4. npm run build               # собираем frontend
5. Атомарная замена файлов    # mv старые → новые (мгновенно)
```

### 3. Автоматический Rollback

При любой ошибке скрипт автоматически откатывается к предыдущей версии:

```bash
try {
  обновление
} catch {
  rollback к бэкапу
  уведомление админа
}
```

## Быстрый старт

### Если у вас уже настроен старый deployment:

```bash
# На сервере
cd /var/www/floodilka
sudo bash deployment/update-zero-downtime.sh
```

При первом запуске скрипт автоматически:
1. Переключит PM2 в cluster mode (кратковременный простой ~2-3 сек один раз)
2. Создаст бэкап
3. Выполнит обновление
4. Сохранит конфигурацию

Все последующие обновления будут **без простоя**!

## Первоначальная настройка

### 1. Загрузить новые файлы на сервер

```bash
# Локально: закоммитить и запушить изменения
git add deployment/
git commit -m "Add zero-downtime deployment"
git push origin main

# На сервере: получить изменения
cd /var/www/floodilka
sudo git pull origin main
```

### 2. Первый запуск (единоразово)

```bash
sudo bash deployment/update-zero-downtime.sh
```

При первом запуске:
- Скрипт обнаружит что backend не в cluster mode
- Предупредит о кратковременном простое (~2-3 сек)
- Переключит в cluster mode
- Все последующие обновления будут без простоя!

### 3. Проверка

```bash
# Проверить что backend в cluster mode
sudo -u floodilka pm2 status

# Должно быть примерно так:
┌────┬─────────────────────┬─────────┬──────┬────────┬
│ id │ name                │ mode    │ ↺    │ status │
├────┼─────────────────────┼─────────┼──────┼────────┼
│ 0  │ floodilka-backend   │ cluster │ 0    │ online │
│ 1  │ floodilka-backend   │ cluster │ 0    │ online │
└────┴─────────────────────┴─────────┴──────┴────────┴
                           ^^^ cluster mode с 2 инстансами
```

## Использование

### Обычное обновление (каждый раз)

```bash
cd /var/www/floodilka
sudo bash deployment/update-zero-downtime.sh
```

Скрипт выполнит:
1. ✅ Проверка статуса
2. ✅ Создание бэкапа
3. ✅ Git pull
4. ✅ Backend обновление (zero downtime)
5. ✅ Frontend обновление и атомарная замена
6. ✅ Healthcheck
7. ✅ Готово!

### Что видят пользователи

**Backend обновление:**
- WebSocket соединения: ✅ остаются активными
- API запросы: ✅ продолжают работать
- Голосовые звонки: ✅ не прерываются

**Frontend обновление:**
- Текущая страница: ✅ продолжает работать
- При следующей навигации: ✅ загрузится новая версия
- Можно обновить: Ctrl+F5 / Cmd+Shift+R

### Проверка логов

```bash
# Логи backend
sudo -u floodilka pm2 logs floodilka-backend

# Последние 50 строк
sudo -u floodilka pm2 logs floodilka-backend --lines 50

# Статус
sudo -u floodilka pm2 status
```

## Troubleshooting

### 1. Backend не переключается в cluster mode

**Симптомы:**
```
Backend работает не в cluster mode. Переключаю...
Error: Process floodilka-backend not found
```

**Решение:**
```bash
# Остановить старый процесс
sudo -u floodilka pm2 delete floodilka-backend

# Запустить через ecosystem
cd /var/www/floodilka/backend
sudo -u floodilka pm2 start /var/www/floodilka/deployment/ecosystem.config.js --env production
sudo -u floodilka pm2 save
```

### 2. Ошибка "Backend не отвечает после reload"

**Симптомы:**
```
❌ Backend не отвечает после reload!
Выполняю откат...
```

**Причины:**
- Синтаксическая ошибка в коде
- Отсутствует зависимость в npm
- Порт 3001 занят

**Решение:**
```bash
# Проверить логи
sudo -u floodilka pm2 logs floodilka-backend --lines 100

# Проверить порт
sudo netstat -tlnp | grep 3001

# Откатиться к бэкапу вручную
BACKUP_DIR=$(ls -dt /var/www/floodilka-backup-* | head -1)
cd /var/www/floodilka/backend
cp -r $BACKUP_DIR/backend/* .
sudo -u floodilka pm2 reload floodilka-backend
```

### 3. Frontend не обновляется у пользователей

**Причина:** Браузер кэширует старую версию

**Решение для пользователей:**
- **Chrome/Firefox:** Ctrl+F5 (Windows) или Cmd+Shift+R (Mac)
- **Safari:** Cmd+Option+R

**Решение для админа (очистить серверный кэш):**
```bash
# Очистить nginx кэш если настроен
sudo rm -rf /var/cache/nginx/*
sudo systemctl reload nginx
```

### 4. Недостаточно памяти для 2 инстансов

**Симптомы:**
```
Error: Script execution timed out after 10000ms
```

**Решение 1:** Увеличить swap
```bash
# Создать swap файл 2GB
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Сделать постоянным
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

**Решение 2:** Уменьшить до 1 инстанса (но тогда будет кратковременный простой)
```bash
# Редактировать ecosystem.config.js
sudo nano /var/www/floodilka/deployment/ecosystem.config.js

# Изменить
instances: 1,  // было 2

# Применить
cd /var/www/floodilka/backend
sudo -u floodilka pm2 reload ecosystem.config.js
```

### 5. Git conflicts при pull

**Симптомы:**
```
⚠️  Обнаружены локальные изменения
```

**Решение:**
Скрипт предложит сбросить изменения. Если вы внесли важные изменения локально:

```bash
# Сохранить изменения
git stash

# Или создать бранч
git checkout -b local-changes
git commit -am "Local changes"
git checkout main
```

## Мониторинг

### Проверить что всё работает

```bash
# Полная проверка системы
sudo bash deployment/healthcheck.sh  # создайте этот скрипт

# Или вручную:
# 1. Backend
curl http://localhost:3001/api/health

# 2. PM2 статус
sudo -u floodilka pm2 status

# 3. Nginx
sudo systemctl status nginx

# 4. MongoDB
sudo systemctl status mongod

# 5. Disk space
df -h
```

### Создать healthcheck скрипт

```bash
cat > /var/www/floodilka/deployment/healthcheck.sh << 'EOF'
#!/bin/bash
echo "🏥 Health Check Floodilka"
echo ""

echo "1. Backend:"
if curl -f -s http://localhost:3001/ > /dev/null; then
    echo "   ✅ Backend отвечает"
else
    echo "   ❌ Backend не отвечает"
fi

echo "2. PM2:"
sudo -u floodilka pm2 status | grep floodilka-backend

echo "3. Nginx:"
sudo systemctl status nginx | grep Active

echo "4. MongoDB:"
sudo systemctl status mongod | grep Active

echo "5. Disk space:"
df -h | grep -E '^/dev/'

echo ""
echo "✅ Проверка завершена"
EOF

sudo chmod +x /var/www/floodilka/deployment/healthcheck.sh
```

## Best Practices

### 1. Обновляйте в непиковое время
Хотя deployment zero-downtime, лучше обновлять когда меньше пользователей онлайн.

### 2. Проверяйте изменения локально
```bash
# Перед push на production
npm test
npm run build
```

### 3. Делайте коммиты осмысленными
```bash
git commit -m "feat: добавить новую фичу"
git commit -m "fix: исправить баг с аудио"
```

### 4. Мониторьте логи после обновления
```bash
# В течение 5 минут после обновления
sudo -u floodilka pm2 logs floodilka-backend --lines 100
```

### 5. Регулярные бэкапы базы данных
```bash
# Добавить в cron
0 3 * * * /var/www/floodilka/scripts/backup-db.sh
```

## Сравнение: Старый vs Новый подход

| Критерий | update-graceful.sh (старый) | update-zero-downtime.sh (новый) |
|----------|----------------------------|----------------------------------|
| Простой при обновлении | 2-5 секунд | 0 секунд ✅ |
| WebSocket соединения | Рвутся ❌ | Сохраняются ✅ |
| Голосовые звонки | Прерываются ❌ | Продолжаются ✅ |
| Автоматический rollback | Нет ❌ | Есть ✅ |
| Healthcheck | Базовый | Полный ✅ |
| Cluster mode | Нет | Да ✅ |
| Бэкапы | Простые | Полные ✅ |

## FAQ

**Q: Нужно ли останавливать сервер для первого обновления?**
A: Да, один раз будет простой ~2-3 секунды для переключения в cluster mode. Все последующие обновления - без простоя.

**Q: Сколько памяти требует cluster mode?**
A: 2 инстанса x 500MB = ~1GB RAM. Для дроплета с 1GB RAM нужен swap 1-2GB.

**Q: Можно ли откатиться к старой версии?**
A: Да, бэкапы хранятся в `/var/www/floodilka-backup-*`. Последние 3 бэкапа сохраняются автоматически.

**Q: Что если обновление зависнет?**
A: Ctrl+C для отмены. Затем используйте `emergency-fix.sh` или вручную откатитесь к бэкапу.

**Q: Нужно ли уведомлять пользователей об обновлении?**
A: Нет необходимости! Пользователи ничего не заметят. Можно добавить уведомление "Обновите страницу для новой версии" в UI.

---

## 🎉 Готово!

Теперь вы можете обновлять Floodilka без простоя. Пользователи будут счастливы! 💙

**Следующие шаги:**
1. ✅ Выполните первое обновление
2. ✅ Проверьте что backend в cluster mode
3. ✅ Настройте мониторинг
4. ✅ Делайте обновления уверенно!

**Вопросы?** Смотрите:
- [DEPLOYMENT-BEST-PRACTICES.md](./DEPLOYMENT-BEST-PRACTICES.md)
- [TROUBLESHOOTING.md](../TROUBLESHOOTING.md)
- [CHEATSHEET.md](./CHEATSHEET.md)

