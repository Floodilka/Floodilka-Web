# 📚 Документация по деплою floodilka

Эта директория содержит всё необходимое для деплоя и обслуживания floodilka в продакшене.

## 🚀 Быстрый старт

### Первый деплой
```bash
# 1. Клонировать на сервер
git clone <your-repo> /var/www/floodilka
cd /var/www/floodilka/deployment

# 2. Установить MongoDB
bash setup-mongodb.sh

# 3. Настроить production окружение
bash setup-production.sh

# 4. Настроить SSL (опционально)
bash setup-ssl.sh

# 5. Первый деплой
bash update.sh
```

📖 Подробнее: [DEPLOY.md](./DEPLOY.md)

### Обновление

**⭐⭐⭐ Zero-Downtime (ЛУЧШИЙ СПОСОБ - БЕЗ простоя!):**
```bash
cd /var/www/floodilka
sudo bash deployment/update-zero-downtime.sh
```
📖 Подробнее: [ZERO-DOWNTIME.md](./ZERO-DOWNTIME.md) | [Миграция](./MIGRATION-TO-ZERO-DOWNTIME.md)

**⭐ Graceful (минимальный простой ~2-5 сек):**
```bash
cd /var/www/floodilka
sudo bash deployment/update-graceful.sh
```

**Быстрое обновление (простой ~5-10 сек):**
```bash
cd /var/www/floodilka
sudo bash deployment/update.sh
```

📖 Подробнее: [QUICK-UPDATE.md](./QUICK-UPDATE.md)

## 📖 Документация

### Основные документы

1. **[ZERO-DOWNTIME.md](./ZERO-DOWNTIME.md)** ⭐⭐⭐
   - Zero-downtime deployment БЕЗ простоя
   - PM2 cluster mode
   - Автоматический rollback
   - Healthcheck
   - Troubleshooting

2. **[MIGRATION-TO-ZERO-DOWNTIME.md](./MIGRATION-TO-ZERO-DOWNTIME.md)** 🚀
   - Быстрая миграция с graceful на zero-downtime
   - Пошаговая инструкция
   - FAQ и troubleshooting

3. **[DEPLOYMENT-BEST-PRACTICES.md](./DEPLOYMENT-BEST-PRACTICES.md)** ⭐
   - Типы обновлений
   - Лучшее время для деплоя
   - Минимизация downtime
   - План отката
   - Мониторинг после деплоя

4. **[QUICK-UPDATE.md](./QUICK-UPDATE.md)** 🚀
   - Graceful vs стандартное обновление
   - Когда деплоить
   - Проверка после обновления
   - Troubleshooting

5. **[CHEATSHEET.md](./CHEATSHEET.md)** 📋
   - Все команды в одном месте
   - Полезные алиасы
   - SOS - что делать если сломалось
   - Быстрые решения типичных проблем

6. **[DEPLOY.md](./DEPLOY.md)** 🔧
   - Полная инструкция по первоначальной настройке
   - MongoDB, PM2, Nginx
   - Переменные окружения
   - Безопасность

7. **[HOTFIX-UPLOADS.md](./HOTFIX-UPLOADS.md)** 🔧
   - Исправление проблемы с загрузкой аватаров
   - Настройка nginx для статических файлов

## 🛠️ Скрипты

### Основные скрипты обновления

- **`update-zero-downtime.sh`** ⭐⭐⭐ - Zero-downtime обновление
  - PM2 cluster mode (2 инстанса)
  - Полное отсутствие простоя
  - WebSocket соединения не рвутся
  - Автоматический rollback при ошибках
  - Healthcheck перед переключением
  - Бэкап с возможностью отката
  - ~0 сек downtime!

- **`update-graceful.sh`** ⭐ - Graceful обновление
  - Проверка активных пользователей
  - PM2 reload вместо restart
  - Проверка синтаксиса
  - Автоматический backup
  - ~2-5 сек downtime

- **`update.sh`** - Стандартное обновление
  - Быстрое обновление
  - Автоопределение изменений в nginx
  - ~5-10 сек downtime

- **`update-nginx.sh`** - Обновление только nginx конфигурации
  - Выбор HTTP/HTTPS конфигурации
  - Проверка синтаксиса
  - Graceful reload

### Скрипты первоначальной настройки

- **`setup.sh`** - Автоматическая настройка сервера
- **`setup-mongodb.sh`** - Установка MongoDB
- **`setup-production.sh`** - Настройка production окружения
- **`setup-ssl.sh`** - Настройка Let's Encrypt SSL
- **`setup-cluster.sh`** ⭐ - Настройка PM2 cluster mode для zero-downtime

### Скрипты деплоя компонентов

- **`deploy-backend.sh`** - Деплой backend
- **`deploy-frontend.sh`** - Деплой frontend

### Дополнительные скрипты

- **`emergency-fix.sh`** - Экстренное восстановление при зависании
- **`notify-maintenance.sh`** - Уведомление пользователей о обслуживании (TODO)

### Конфигурационные файлы

- **`ecosystem.config.js`** - PM2 конфигурация для cluster mode
- **`maintenance.html`** - Страница технического обслуживания
- **`nginx-https.conf`** / **`nginx-http.conf`** - Nginx конфигурации

## 📊 Сравнение методов обновления

| Метод | Downtime | WebSocket | Rollback | Healthcheck | Когда использовать |
|-------|----------|-----------|----------|-------------|-------------------|
| `update-zero-downtime.sh` | **0 сек** ✅ | Сохраняются ✅ | Авто ✅ | ✅ | **Всегда (лучший способ!)** |
| `update-graceful.sh` | ~2-5 сек | Рвутся ⚠️ | ✅ | ⚠️ | Если не настроен cluster |
| `update.sh` | ~5-10 сек | Рвутся ❌ | ❌ | ❌ | Экстренный hotfix |
| Manual | Зависит | Зависит | ❌ | ❌ | Отладка |

## 🎯 Рекомендации

### Для продакшена
1. ✅ **Всегда используйте `update-zero-downtime.sh`**
2. ✅ Обновляйте когда удобно - простоя нет!
3. ✅ Проверяйте логи после деплоя (для уверенности)
4. ✅ Держите backup предыдущей версии
5. ✅ Тестируйте локально перед деплоем

### Избегайте
1. ❌ Деплой в пиковое время (18:00-22:00 МСК)
2. ❌ Использование `pm2 restart` в продакшене
3. ❌ Деплой без тестирования
4. ❌ Изменения прямо на сервере (всегда через Git)

## 🆘 Быстрая помощь

### Что-то сломалось после обновления?

```bash
# 1. Смотрим логи
sudo -u floodilka pm2 logs --lines 50

# 2. Откатываемся
cd /var/www/floodilka
git reset --hard HEAD~1
sudo bash deployment/update-graceful.sh

# 3. Если не помогло - восстанавливаем backup
mv /var/www/floodilka/public.backup /var/www/floodilka/public
sudo systemctl reload nginx
```

### Backend не запускается?

```bash
# Проверить процесс
sudo -u floodilka pm2 status

# Перезапустить
sudo -u floodilka pm2 reload floodilka-backend

# Посмотреть детали
sudo -u floodilka pm2 logs floodilka-backend --lines 100
```

### Nginx ошибки?

```bash
# Проверить конфигурацию
sudo nginx -t

# Посмотреть логи
sudo tail -f /var/log/nginx/floodilka-error.log

# Перезагрузить
sudo systemctl reload nginx
```

## 📞 Полезные команды

```bash
# Статус всего
sudo -u floodilka pm2 status
sudo systemctl status nginx
sudo systemctl status mongod

# Логи
sudo -u floodilka pm2 logs
sudo tail -f /var/log/nginx/floodilka-error.log

# Мониторинг
sudo -u floodilka pm2 monit
htop
```

## 🔗 Конфигурационные файлы

- `nginx-http.conf` - Nginx конфигурация для HTTP
- `nginx-https.conf` - Nginx конфигурация для HTTPS с SSL
- `.env.example` - Пример переменных окружения (скопируется в backend/.env)

## 🎓 Дополнительная информация

- Приложение использует PM2 для управления процессом backend
- Frontend собирается и раздается через Nginx как статика
- Backend API проксируется через Nginx (порт 3001)
- WebSocket (Socket.IO) также проксируется через Nginx
- MongoDB слушает только localhost (безопасно)

## 🤝 Contribution

При добавлении новых скриптов или изменении существующих:
1. Обновите эту документацию
2. Протестируйте на тестовом сервере
3. Добавьте примеры использования
4. Обновите CHEATSHEET.md если нужно

## 📝 Changelog

См. git log для истории изменений:
```bash
git log --oneline deployment/
```

---

💙 Сделано с любовью для floodilka

Вопросы? Смотрите [CHEATSHEET.md](./CHEATSHEET.md) или [DEPLOYMENT-BEST-PRACTICES.md](./DEPLOYMENT-BEST-PRACTICES.md)

