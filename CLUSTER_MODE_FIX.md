# Исправление проблемы "Разных миров" в PM2 Cluster Mode

## 🐛 Проблема

**Симптомы:**
- Кто-то пишет в чат → один видит сразу, другой НЕ видит
- Пользователь в голосовом канале → то видно, то не видно после обновления страницы
- Как будто пользователи в "разных мирах"

**Причина:**

PM2 запущен в **cluster mode** (2 процесса), но **НЕТ Redis адаптера** для синхронизации Socket.IO между процессами.

```
┌─────────────┐         ┌─────────────┐
│ PM2 Процесс 1│         │ PM2 Процесс 2│
│             │         │             │
│ Комнаты:    │         │ Комнаты:    │
│ - channel1  │         │ - channel1  │
│   └─ UserA  │  ❌NO❌  │   └─ UserB  │
│ - voice-123 │  REDIS  │ - voice-123 │
└─────────────┘         └─────────────┘
     ↑                       ↑
     │                       │
  Nginx балансирует случайным образом
```

Каждый процесс имеет **изолированную память** с комнатами Socket.IO!

- UserA подключается к Процессу 1
- UserB подключается к Процессу 2
- Они НЕ видят друг друга в реальном времени

---

## ✅ РЕШЕНИЕ 1: Fork Mode (Рекомендуется)

**Переключить на 1 процесс** - самое простое и надежное решение для небольших/средних проектов.

### Автоматически:

```bash
# На сервере
cd /var/www/floodilka
git pull origin main
sudo bash deployment/fix-cluster-issue.sh
```

### Вручную:

```bash
# 1. Остановить текущий процесс
sudo -u floodilka pm2 delete floodilka-backend

# 2. Запустить в fork mode
cd /var/www/floodilka/backend
sudo -u floodilka pm2 start ecosystem.config.js --env production

# 3. Сохранить
sudo -u floodilka pm2 save

# 4. Проверить
sudo -u floodilka pm2 status
```

**Плюсы:**
- ✅ Простота
- ✅ Нет зависимости от Redis
- ✅ Стабильность
- ✅ Достаточно для 100-500+ одновременных пользователей

**Минусы:**
- ❌ Нет zero-downtime deployment (несколько секунд простоя при обновлении)
- ❌ Один процесс = один CPU core

---

## ✅ РЕШЕНИЕ 2: Cluster Mode + Redis (Для высоких нагрузок)

Если нужен cluster mode для масштабирования:

### 1. Установить Redis:

```bash
# Установка Redis
sudo apt update
sudo apt install redis-server -y

# Настройка автозапуска
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Проверка
redis-cli ping
# Должен ответить: PONG
```

### 2. Добавить REDIS_URL в .env:

```bash
sudo nano /var/www/floodilka/backend/.env
```

Добавить строку:
```
REDIS_URL=redis://localhost:6379
```

### 3. Перезапустить backend:

```bash
sudo -u floodilka pm2 restart floodilka-backend
```

### 4. Проверить логи:

```bash
sudo -u floodilka pm2 logs floodilka-backend --lines 50
```

Должно быть:
```
✅ Socket.IO Redis adapter активирован
```

### 5. Вернуть cluster mode:

```bash
# Отредактировать ecosystem.config.js
sudo nano /var/www/floodilka/deployment/ecosystem.config.js
```

Изменить:
```javascript
instances: 2,          // или 'max' для auto
exec_mode: 'cluster',
```

Перезапустить:
```bash
sudo -u floodilka pm2 delete floodilka-backend
sudo -u floodilka pm2 start /var/www/floodilka/deployment/ecosystem.config.js --env production
sudo -u floodilka pm2 save
```

**Плюсы:**
- ✅ Zero-downtime deployment
- ✅ Использование всех CPU cores
- ✅ Масштабируемость

**Минусы:**
- ❌ Зависимость от Redis
- ❌ Дополнительная сложность
- ❌ Нужно мониторить Redis

---

## 🧪 Проверка после исправления

### Тест 1: Сообщения в реальном времени

1. Откройте 2 вкладки браузера (можно incognito)
2. Войдите в один канал с обоих вкладок
3. Отправьте сообщение в первой вкладке
4. **Должно появиться во второй БЕЗ обновления страницы**

### Тест 2: Голосовые каналы

1. Пользователь A заходит в голосовой канал
2. Пользователь B открывает сервер
3. Пользователь B **должен сразу видеть** пользователя A в голосовом канале
4. Обновите страницу несколько раз
5. Пользователь A **должен быть виден стабильно**

### Тест 3: Console проверка

Откройте DevTools (F12) → Console:

```
✅ Socket connected: <id>
📨 Получено новое сообщение: ...  (при каждом новом сообщении)
```

---

## 📊 Мониторинг

### Проверка процессов PM2:

```bash
sudo -u floodilka pm2 status
```

**Fork mode:**
```
┌─────┬────────────────────┬─────────┬─────────┬──────────┐
│ id  │ name               │ mode    │ ↺       │ status   │
├─────┼────────────────────┼─────────┼─────────┼──────────┤
│ 0   │ floodilka-backend  │ fork    │ 0       │ online   │
└─────┴────────────────────┴─────────┴─────────┴──────────┘
```

**Cluster mode:**
```
┌─────┬────────────────────┬─────────┬─────────┬──────────┐
│ id  │ name               │ mode    │ ↺       │ status   │
├─────┼────────────────────┼─────────┼─────────┼──────────┤
│ 0   │ floodilka-backend  │ cluster │ 0       │ online   │
│ 1   │ floodilka-backend  │ cluster │ 0       │ online   │
└─────┴────────────────────┴─────────┴─────────┴──────────┘
```

### Логи:

```bash
# Все логи
sudo -u floodilka pm2 logs floodilka-backend

# Поиск проблем с Socket.IO
sudo -u floodilka pm2 logs floodilka-backend | grep -i "socket\|redis"
```

---

## 🎯 Рекомендация

Для вашего проекта (небольшая/средняя нагрузка) **рекомендую Fork Mode** (Решение 1):

1. ✅ Проще
2. ✅ Надежнее
3. ✅ Нет зависимости от Redis
4. ✅ Достаточно производительности

Redis нужен только если:
- Более 1000+ одновременных пользователей
- Критично важен zero-downtime deployment
- Хотите распределять нагрузку на несколько серверов

---

## 📝 Итоговый чеклист

После применения исправлений:

- [ ] PM2 запущен в правильном режиме
- [ ] `pm2 status` показывает нужное количество процессов
- [ ] Сообщения появляются в реальном времени
- [ ] Пользователи в голосовых каналах видны стабильно
- [ ] Нет ошибок в Console браузера
- [ ] Нет ошибок в `pm2 logs`

---

**Дата исправления:** 2025-10-14

