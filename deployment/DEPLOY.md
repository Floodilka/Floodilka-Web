# 🚀 Инструкция по деплою на DigitalOcean

## 🌐 Текущие домены

Приложение доступно на:
- **https://floodilka.com** (основной домен)
- **https://floodilka.ru** (зеркало)

## Первоначальная настройка (один раз)

### 1. Подключитесь к дроплету
```bash
ssh root@159.89.110.44
```

### 2. Установите MongoDB
```bash
cd /var/www/floodilka/deployment
bash setup-mongodb.sh
```

### 3. Настройте production окружение
```bash
bash setup-production.sh
```

Этот скрипт:
- Создаст `.env` файл с уникальным JWT секретом
- Установит зависимости для production
- Перезапустит backend с новыми настройками

### 4. Деплой приложения
```bash
bash update.sh
```

## Последующие обновления

### Быстрое обновление (рекомендуется)

```bash
cd /var/www/floodilka
sudo bash deployment/update.sh
```

Этот скрипт автоматически:
1. ✅ Сохранит локальные изменения (если есть)
2. ✅ Подтянет обновления из Git
3. ✅ Обнаружит изменения в nginx конфигурации
4. ✅ Обновит nginx (если запущен с sudo)
5. ✅ Обновит backend и frontend
6. ✅ Перезапустит сервисы

📖 **Подробная инструкция**: [QUICK-UPDATE.md](./QUICK-UPDATE.md)

## Полезные команды

### Проверка статуса
```bash
# Статус backend
sudo -u floodilka pm2 status

# Статус MongoDB
sudo systemctl status mongod

# Статус Nginx
sudo systemctl status nginx
```

### Логи
```bash
# Логи backend
sudo -u floodilka pm2 logs floodilka-backend

# Логи MongoDB
sudo journalctl -u mongod

# Логи Nginx
sudo tail -f /var/log/nginx/error.log
```

### Перезапуск сервисов
```bash
# Перезапуск backend
sudo -u floodilka pm2 restart floodilka-backend

# Перезапуск MongoDB
sudo systemctl restart mongod

# Перезапуск Nginx
sudo systemctl restart nginx
```

### MongoDB команды
```bash
# Подключиться к MongoDB
mongosh

# Посмотреть базы данных
show dbs

# Использовать базу floodilka
use floodilka

# Посмотреть коллекции
show collections

# Посмотреть пользователей
db.users.find()

# Посмотреть каналы
db.channels.find()
```

## Структура production

```
/var/www/floodilka/
├── backend/
│   ├── .env              # ⚠️ Не коммитится в Git!
│   ├── models/
│   ├── routes/
│   └── server.js
├── frontend/
│   └── build/
├── public/               # Статические файлы frontend
└── deployment/
    ├── setup-mongodb.sh
    ├── setup-production.sh
    ├── update.sh
    ├── deploy-backend.sh
    └── deploy-frontend.sh
```

## Безопасность

### JWT Secret
JWT секрет генерируется автоматически при запуске `setup-production.sh` и хранится в `/var/www/floodilka/backend/.env`.

⚠️ **Важно**: Этот файл не должен коммититься в Git!

### MongoDB
По умолчанию MongoDB слушает только на localhost (127.0.0.1), что безопасно.

Если нужен доступ извне, настройте:
```bash
sudo nano /etc/mongod.conf
```

### Firewall
```bash
# Разрешенные порты
sudo ufw status

# Должны быть открыты:
# 22/tcp   - SSH
# 80/tcp   - HTTP
# 443/tcp  - HTTPS
```

## Troubleshooting

### Backend не запускается
```bash
# Проверить логи
sudo -u floodilka pm2 logs floodilka-backend --lines 50

# Проверить .env файл
cat /var/www/floodilka/backend/.env

# Проверить права
ls -la /var/www/floodilka/backend/
```

### MongoDB не подключается
```bash
# Проверить статус
sudo systemctl status mongod

# Проверить логи
sudo journalctl -u mongod -n 50

# Перезапустить
sudo systemctl restart mongod
```

### Frontend показывает белый экран
```bash
# Проверить сборку
ls -la /var/www/floodilka/public/

# Пересобрать frontend
cd /var/www/floodilka/deployment
bash deploy-frontend.sh
```

### Ошибка CORS
Проверьте, что в `/var/www/floodilka/backend/.env` правильный `FRONTEND_URL`:
```
FRONTEND_URL=https://floodilka.com
```

## Документация

- 📖 [QUICK-UPDATE.md](./QUICK-UPDATE.md) - Быстрое обновление и деплой
- 🔧 [HOTFIX-UPLOADS.md](./HOTFIX-UPLOADS.md) - Hotfix для проблемы с загрузкой аватаров
