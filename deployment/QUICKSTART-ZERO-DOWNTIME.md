# ⚡ QUICKSTART: Zero-Downtime Deployment

5-минутная настройка для обновления без простоя.

## 🎯 Цель

Перейти с обычного deployment на zero-downtime за 5 минут.

## ✅ Что нужно

- Сервер с работающей Floodilka
- SSH доступ к серверу
- 5 минут времени

## 🚀 3 простых шага

### 1️⃣ Локально: Запушить изменения (30 сек)

```bash
cd /path/to/floodilka

git add deployment/
git commit -m "feat: add zero-downtime deployment"
git push origin main
```

### 2️⃣ На сервере: Получить обновления (30 сек)

```bash
ssh root@your-server
cd /var/www/floodilka
git pull origin main
```

### 3️⃣ На сервере: Запустить zero-downtime (4 минуты)

```bash
sudo bash deployment/update-zero-downtime.sh
```

**Готово!** 🎉

## 📊 Что произошло

При первом запуске:
- ✅ Backend переключен в cluster mode (2 инстанса)
- ✅ Код обновлен
- ✅ Frontend пересобран
- ✅ Все работает!

**Кратковременный простой ~2-3 сек был только один раз** для настройки cluster mode.

**Все следующие обновления - БЕЗ простоя!**

## 🔄 Использование

Теперь просто:

```bash
# На сервере
cd /var/www/floodilka
sudo bash deployment/update-zero-downtime.sh
```

**Или еще проще с алиасом:**

```bash
# Добавить в ~/.bashrc
alias b-update='cd /var/www/floodilka && sudo bash deployment/update-zero-downtime.sh'

# Использовать
b-update
```

## ✨ Что теперь

- ✅ Обновляйте когда угодно - простоя нет
- ✅ Пользователи ничего не заметят
- ✅ WebSocket соединения сохраняются
- ✅ Голосовые звонки не прерываются
- ✅ Автоматический rollback при проблемах

## 🔍 Проверка

```bash
# Проверить что backend в cluster mode
sudo -u floodilka pm2 status

# Должно быть 2 инстанса:
# ┌────┬──────────────────────┬─────────┬───┬────────┐
# │ id │ name                 │ mode    │ ↺ │ status │
# ├────┼──────────────────────┼─────────┼───┼────────┤
# │ 0  │ floodilka-backend    │ cluster │ 0 │ online │
# │ 1  │ floodilka-backend    │ cluster │ 0 │ online │
# └────┴──────────────────────┴─────────┴───┴────────┘

# Проверить здоровье
curl http://localhost:3001/health
```

## 📖 Подробнее

- [ZERO-DOWNTIME.md](./ZERO-DOWNTIME.md) - Полная документация
- [MIGRATION-TO-ZERO-DOWNTIME.md](./MIGRATION-TO-ZERO-DOWNTIME.md) - Детальная миграция
- [CHEATSHEET.md](./CHEATSHEET.md) - Шпаргалка команд

## ❓ Проблемы?

**Backend не переключился в cluster mode:**
```bash
sudo bash deployment/setup-cluster.sh
```

**Логи:**
```bash
sudo -u floodilka pm2 logs floodilka-backend --lines 50
```

**Недостаточно памяти:**
```bash
# Создать swap 2GB
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

---

**Вот и всё!** Теперь у вас zero-downtime deployment! 🚀

