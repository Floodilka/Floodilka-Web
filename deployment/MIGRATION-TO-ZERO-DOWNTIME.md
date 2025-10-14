# 🚀 Миграция на Zero-Downtime Deployment

Быстрое руководство по переходу с обычного deployment на zero-downtime.

## 📋 Для кого это руководство

Если вы уже используете `update-graceful.sh` или `update.sh` и хотите перейти на zero-downtime deployment.

## ⏱️ Сколько времени займет

- **Подготовка:** 2 минуты
- **Миграция:** 5 минут (единоразово)
- **Все последующие обновления:** БЕЗ простоя!

## 🎯 Что вы получите

| До миграции | После миграции |
|-------------|----------------|
| Простой при обновлении: 2-5 сек | ✅ 0 секунд простоя |
| WebSocket соединения рвутся | ✅ Соединения сохраняются |
| Голосовые звонки прерываются | ✅ Звонки продолжаются |
| Ручной rollback | ✅ Автоматический rollback |

## 📝 Шаги миграции

### Шаг 1: Получить новые файлы (локально)

```bash
# В вашем локальном проекте
cd /path/to/floodilka

# Убедитесь что все файлы закоммичены
git add deployment/
git commit -m "feat: add zero-downtime deployment"
git push origin main
```

### Шаг 2: Получить обновления на сервере

```bash
# Подключитесь к серверу
ssh root@your-server

# Перейдите в проект
cd /var/www/floodilka

# Получите изменения
git pull origin main
```

### Шаг 3: Первое zero-downtime обновление

```bash
# Запустите новый скрипт
sudo bash deployment/update-zero-downtime.sh
```

**Что произойдет:**
1. Скрипт обнаружит что backend не в cluster mode
2. Предупредит о кратковременном простое (~2-3 сек) **один раз**
3. Переключит backend в cluster mode
4. Все последующие обновления будут БЕЗ простоя! ✅

### Шаг 4: Проверка

```bash
# Убедитесь что backend в cluster mode
sudo -u floodilka pm2 status

# Должно быть примерно так:
# ┌─────┬──────────────────────┬─────────┬───┬────────┐
# │ id  │ name                 │ mode    │ ↺ │ status │
# ├─────┼──────────────────────┼─────────┼───┼────────┤
# │ 0   │ floodilka-backend    │ cluster │ 0 │ online │
# │ 1   │ floodilka-backend    │ cluster │ 0 │ online │
# └─────┴──────────────────────┴─────────┴───┴────────┘
```

### Шаг 5: Готово! 🎉

Теперь используйте для обновлений:

```bash
sudo bash deployment/update-zero-downtime.sh
```

## 🔄 Альтернативный способ (если хотите только настроить cluster)

Если вы не хотите обновляться прямо сейчас, но хотите настроить cluster mode:

```bash
# Только настройка cluster mode (единоразово)
sudo bash deployment/setup-cluster.sh
```

Это настроит cluster mode без обновления кода.

## 📊 Сравнение до/после

### До (update-graceful.sh):

```
[Backend Single Instance]
       ↓
   pm2 reload
       ↓
   [простой 2-5 сек]
       ↓
   ❌ пользователи видят ошибки
   ❌ WebSocket соединения рвутся
   ❌ голосовые звонки прерываются
       ↓
[Backend Single Instance]
```

### После (update-zero-downtime.sh):

```
[Instance 1] ──────────────────> online
[Instance 2] ──────────────────> online
                ↓
        [New Instance 1] запускается
        [New Instance 2] запускается
                ↓
        healthcheck ✓
                ↓
        [Old Instance 1] graceful shutdown
        [Old Instance 2] graceful shutdown
                ↓
✅ пользователи ничего не заметили
✅ все соединения сохранены
✅ никаких ошибок
```

## 🔧 Настройка алиасов

Обновите ваши алиасы для удобства:

```bash
# Отредактируйте ~/.bashrc
nano ~/.bashrc

# Замените или добавьте:
alias b-update='cd /var/www/floodilka && sudo bash deployment/update-zero-downtime.sh'

# Сохраните и примените
source ~/.bashrc

# Теперь просто:
b-update
```

## ⚙️ Что изменилось технически

### Новые файлы:
- `deployment/ecosystem.config.js` - PM2 конфигурация для cluster mode
- `deployment/update-zero-downtime.sh` - Основной скрипт zero-downtime
- `deployment/setup-cluster.sh` - Настройка cluster mode отдельно
- `deployment/maintenance.html` - Страница maintenance (на случай проблем)
- `deployment/ZERO-DOWNTIME.md` - Полная документация

### Изменения в backend:
- PM2 запускается в cluster mode (2 инстанса)
- Graceful shutdown за 5 секунд
- Wait for ready signal при старте
- Логи пишутся в `/var/www/floodilka/logs/`

### Изменения не требуются для:
- ❌ Код приложения (backend/frontend)
- ❌ Nginx конфигурация
- ❌ MongoDB
- ❌ .env файлы

## ❓ FAQ

**Q: Нужно ли останавливать сервер для миграции?**
A: Только один раз будет простой ~2-3 секунды. Все последующие обновления - без простоя.

**Q: Можно ли вернуться к старому способу?**
A: Да, просто используйте старые скрипты. Но зачем? 😉

```bash
# Если очень нужно вернуться к single instance:
sudo -u floodilka pm2 delete floodilka-backend
cd /var/www/floodilka/backend
sudo -u floodilka pm2 start server.js --name floodilka-backend
```

**Q: Сколько памяти требуется для 2 инстансов?**
A: Примерно 1GB RAM. Если у вас дроплет 1GB, нужен swap:

```bash
# Создать swap 2GB (если нет)
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

**Q: Что если обновление пойдет не так?**
A: Скрипт автоматически откатится к предыдущей версии. Бэкапы хранятся в `/var/www/floodilka-backup-*`

**Q: Нужно ли уведомлять пользователей?**
A: Нет! Они ничего не заметят. Это и есть zero-downtime 🎉

## 📚 Дополнительная информация

После миграции прочитайте:
- [ZERO-DOWNTIME.md](./ZERO-DOWNTIME.md) - Полная документация
- [CHEATSHEET.md](./CHEATSHEET.md) - Обновленные команды
- [DEPLOYMENT-BEST-PRACTICES.md](./DEPLOYMENT-BEST-PRACTICES.md) - Best practices

## ✅ Чеклист миграции

- [ ] Закоммитил и запушил новые файлы
- [ ] Получил изменения на сервере (`git pull`)
- [ ] Запустил `update-zero-downtime.sh`
- [ ] Проверил что backend в cluster mode (`pm2 status`)
- [ ] Обновил алиасы в `~/.bashrc`
- [ ] Сделал тестовое обновление
- [ ] Проверил что все работает
- [ ] Радуюсь отсутствию простоя! 🎉

## 🎉 Поздравляем!

Теперь вы можете обновлять Floodilka когда угодно, не беспокоясь о пользователях!

**Следующее обновление:**
```bash
sudo bash deployment/update-zero-downtime.sh
```

**И всё! Без простоя, без ошибок, без стресса.** 💙

---

*Возникли проблемы? Смотрите [TROUBLESHOOTING](../TROUBLESHOOTING.md) или раздел Troubleshooting в [ZERO-DOWNTIME.md](./ZERO-DOWNTIME.md)*

