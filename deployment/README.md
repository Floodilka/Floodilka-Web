# 📚 Документация по деплою Boltushka

Эта директория содержит всё необходимое для деплоя и обслуживания Boltushka в продакшене.

## 🚀 Быстрый старт

### Первый деплой
```bash
# 1. Клонировать на сервер
git clone <your-repo> /var/www/boltushka
cd /var/www/boltushka/deployment

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

### 🚚 Миграция с Digital Ocean
Если нужно перенести сервер на российский хостинг:
```bash
# На старом сервере (Digital Ocean):
bash migrate-to-new-server.sh

# На новом сервере следуйте инструкциям в консоли
```

📖 Подробное руководство: [MIGRATION-GUIDE.md](./MIGRATION-GUIDE.md)

### Обновление

**⭐ Рекомендуемый способ (с активными пользователями):**
```bash
cd /var/www/boltushka
sudo bash deployment/update-graceful.sh
```

**Быстрое обновление (без пользователей онлайн):**
```bash
cd /var/www/boltushka
sudo bash deployment/update.sh
```

📖 Подробнее: [QUICK-UPDATE.md](./QUICK-UPDATE.md)

## 📖 Документация

### Основные документы

1. **[DEPLOYMENT-BEST-PRACTICES.md](./DEPLOYMENT-BEST-PRACTICES.md)** ⭐
   - Типы обновлений
   - Лучшее время для деплоя
   - Минимизация downtime
   - План отката
   - Мониторинг после деплоя

2. **[QUICK-UPDATE.md](./QUICK-UPDATE.md)** 🚀
   - Graceful vs стандартное обновление
   - Когда деплоить
   - Проверка после обновления
   - Troubleshooting

3. **[CHEATSHEET.md](./CHEATSHEET.md)** 📋
   - Все команды в одном месте
   - Полезные алиасы
   - SOS - что делать если сломалось
   - Быстрые решения типичных проблем

4. **[DEPLOY.md](./DEPLOY.md)** 🔧
   - Полная инструкция по первоначальной настройке
   - MongoDB, PM2, Nginx
   - Переменные окружения
   - Безопасность

5. **[HOTFIX-UPLOADS.md](./HOTFIX-UPLOADS.md)** 🔧
   - Исправление проблемы с загрузкой аватаров
   - Настройка nginx для статических файлов

## 🛠️ Скрипты

### Основные скрипты обновления

- **`update-graceful.sh`** ⭐ - Graceful обновление с минимальным downtime
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

### Скрипты деплоя компонентов

- **`deploy-backend.sh`** - Деплой backend
- **`deploy-frontend.sh`** - Деплой frontend

### Дополнительные скрипты

- **`notify-maintenance.sh`** - Уведомление пользователей о обслуживании (TODO)

## 📊 Сравнение методов обновления

| Метод | Downtime | Проверки | Backup | Когда использовать |
|-------|----------|----------|--------|-------------------|
| `update-graceful.sh` | ~2-5 сек | ✅ | ✅ | Есть активные пользователи |
| `update.sh` | ~5-10 сек | ⚠️ | ❌ | Нет пользователей / hotfix |
| Manual | Зависит | ❌ | ❌ | Отладка |

## 🎯 Рекомендации

### Для продакшена
1. ✅ Всегда используйте `update-graceful.sh`
2. ✅ Деплойте в ночное время (02:00-06:00 МСК)
3. ✅ Проверяйте логи после деплоя
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
sudo -u boltushka pm2 logs --lines 50

# 2. Откатываемся
cd /var/www/boltushka
git reset --hard HEAD~1
sudo bash deployment/update-graceful.sh

# 3. Если не помогло - восстанавливаем backup
mv /var/www/boltushka/public.backup /var/www/boltushka/public
sudo systemctl reload nginx
```

### Backend не запускается?

```bash
# Проверить процесс
sudo -u boltushka pm2 status

# Перезапустить
sudo -u boltushka pm2 reload boltushka-backend

# Посмотреть детали
sudo -u boltushka pm2 logs boltushka-backend --lines 100
```

### Nginx ошибки?

```bash
# Проверить конфигурацию
sudo nginx -t

# Посмотреть логи
sudo tail -f /var/log/nginx/boltushka-error.log

# Перезагрузить
sudo systemctl reload nginx
```

## 📞 Полезные команды

```bash
# Статус всего
sudo -u boltushka pm2 status
sudo systemctl status nginx
sudo systemctl status mongod

# Логи
sudo -u boltushka pm2 logs
sudo tail -f /var/log/nginx/boltushka-error.log

# Мониторинг
sudo -u boltushka pm2 monit
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

💙 Сделано с любовью для Boltushka

Вопросы? Смотрите [CHEATSHEET.md](./CHEATSHEET.md) или [DEPLOYMENT-BEST-PRACTICES.md](./DEPLOYMENT-BEST-PRACTICES.md)

