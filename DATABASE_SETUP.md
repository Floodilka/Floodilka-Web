# Настройка базы данных для локальной разработки

## 🐳 Быстрый старт с Docker

### 1. Запуск MongoDB

```bash
# Из корневой директории проекта
cd backend
npm run db:start
```

### 2. Настройка переменных окружения

Создайте файл `.env` в папке `backend` со следующим содержимым:

```env
# Настройки сервера
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Настройки MongoDB для Docker
MONGODB_URI=mongodb://boltushka_user:boltushka_pass@localhost:27017/boltushka

# JWT секрет (сгенерируйте свой)
JWT_SECRET=your-super-secret-jwt-key-here

# Настройки загрузки файлов
MAX_FILE_SIZE=2097152
UPLOAD_PATH=uploads
```

### 3. Запуск backend

```bash
cd backend
npm start
```

## 📊 Доступ к базе данных

### Mongo Express (веб-интерфейс)
- URL: http://localhost:8081
- Логин: `admin`
- Пароль: `admin123`

### Прямое подключение
- Хост: `localhost:27017`
- База данных: `boltushka`
- Пользователь: `boltushka_user`
- Пароль: `boltushka_pass`

## 🛠️ Команды управления

```bash
# Запуск базы данных
npm run db:start

# Остановка базы данных
npm run db:stop

# Просмотр логов
npm run db:logs

# Сброс базы данных (удаление всех данных)
npm run db:reset
```

## 🔧 Ручная настройка

Если вы хотите запустить MongoDB вручную:

```bash
# Запуск только MongoDB
docker run -d \
  --name boltushka-mongodb \
  -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=password123 \
  -e MONGO_INITDB_DATABASE=boltushka \
  mongo:7.0

# Инициализация базы данных
docker exec -i boltushka-mongodb mongosh --username admin --password password123 --authenticationDatabase admin << EOF
use boltushka;
db.createUser({
  user: 'boltushka_user',
  pwd: 'boltushka_pass',
  roles: [{ role: 'readWrite', db: 'boltushka' }]
});
EOF
```

## 🐛 Решение проблем

### Ошибка подключения к MongoDB
1. Убедитесь, что Docker запущен
2. Проверьте, что контейнер MongoDB работает: `docker ps`
3. Проверьте логи: `npm run db:logs`

### Порт 27017 занят
```bash
# Остановить существующий MongoDB
sudo systemctl stop mongod

# Или изменить порт в docker-compose.yml
```

### Очистка данных
```bash
# Полный сброс
npm run db:reset

# Только остановка
npm run db:stop
```

## 📝 Структура базы данных

База данных `boltushka` содержит следующие коллекции:
- `users` - пользователи
- `servers` - серверы
- `channels` - каналы
- `messages` - сообщения
- `roles` - роли
- `serverroles` - роли пользователей на серверах
- `invites` - приглашения
