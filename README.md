# 💬 Флудилка (Floodilka)

Discord-подобное приложение для общения с текстовыми и голосовыми каналами.

## 🚀 Быстрый старт

### Требования
- Node.js 16+
- MongoDB 6+

### Установка MongoDB

**macOS:**
```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

**Ubuntu/Debian:**
```bash
sudo apt-get install -y mongodb-org
sudo systemctl start mongod
sudo systemctl enable mongod
```

**Windows:**
Скачайте установщик с [mongodb.com](https://www.mongodb.com/try/download/community)

### Установка и запуск

1. Клонируйте репозиторий:
```bash
git clone <your-repo-url>
cd Floodilka
```

2. Установите backend:
```bash
cd backend
npm install
cp .env.example .env
# Отредактируйте .env если нужно изменить настройки
npm start
```

3. Установите frontend (в новом терминале):
```bash
cd frontend
npm install
npm start
```

4. Откройте http://localhost:3000

## 📦 Структура проекта

```
Floodilka/
├── backend/
│   ├── models/          # Модели MongoDB (User, Channel, Message)
│   ├── routes/          # API роуты
│   ├── server.js        # Главный файл сервера
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/  # React компоненты
│   │   ├── App.js       # Главный компонент
│   │   └── App.css
│   └── package.json
└── deployment/          # Скрипты для деплоя
```

## 🔐 Аутентификация

Приложение использует JWT токены для аутентификации:
- Регистрация: `/api/auth/register`
- Логин: `/api/auth/login`
- Получить профиль: `/api/auth/me`

Токен сохраняется в `localStorage` и автоматически используется при последующих запросах.

## 🌐 Деплой

### Первоначальная настройка
См. [deployment/DEPLOY.md](./deployment/DEPLOY.md) для полной инструкции по первоначальной настройке на DigitalOcean.

### Обновление продакшена

**Рекомендуемый способ (graceful, минимальный downtime):**
```bash
ssh root@your-server
cd /var/www/floodilka
sudo bash deployment/update-graceful.sh
```

**Быстрое обновление:**
```bash
sudo bash deployment/update.sh
```

📚 **Документация по деплою:**
- ⭐ [DEPLOYMENT-BEST-PRACTICES.md](./deployment/DEPLOYMENT-BEST-PRACTICES.md) - Best practices
- 🚀 [QUICK-UPDATE.md](./deployment/QUICK-UPDATE.md) - Быстрое обновление
- 📖 [CHEATSHEET.md](./deployment/CHEATSHEET.md) - Шпаргалка по командам
- 🔧 [DEPLOY.md](./deployment/DEPLOY.md) - Полная инструкция

**Что происходит при обновлении:**
- ✅ Graceful reload backend (~2-5 сек downtime)
- ✅ Автоматическое переподключение пользователей
- ✅ Проверка синтаксиса перед применением
- ⚠️ Голосовые звонки прервутся (нужно переподключиться)

## ⚙️ Переменные окружения

Backend `.env`:
```
PORT=3001
FRONTEND_URL=http://localhost:3000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/floodilka
JWT_SECRET=your-super-secret-jwt-key
```

## 🎨 Фичи

- ✅ Регистрация и вход с JWT
- ✅ Профили пользователей с аватарами
- ✅ Создание серверов и каналов
- ✅ Текстовые каналы с реал-тайм сообщениями
- ✅ Голосовые каналы с WebRTC
- ✅ Демонстрация экрана (Screen Sharing)
- ✅ Шумоподавление и настройки микрофона
- ✅ Индикаторы говорящих пользователей
- ✅ Реакции на сообщения с emoji 🎉
- ✅ Личные сообщения (Direct Messages)
- ✅ Загрузка файлов и изображений
- ✅ Редактирование и удаление сообщений
- ✅ Роли и система прав доступа
- ✅ Инвайты на серверы
- ✅ Discord-подобный UI
- ✅ Graceful deployment с минимальным downtime

## 📚 Документация

- 📝 [MESSAGE_PERMISSIONS.md](./MESSAGE_PERMISSIONS.md) - Система прав для управления сообщениями
- 📺 [SCREEN_SHARING.md](./SCREEN_SHARING.md) - Демонстрация экрана
- 🎉 [REACTIONS.md](./REACTIONS.md) - Реакции на сообщения

## 🌐 Поддерживаемые браузеры

Голосовой чат и все функции работают в современных браузерах:
- ✅ **Google Chrome** - рекомендуется
- ✅ **Mozilla Firefox**
- ✅ **Microsoft Edge**
- ✅ **Safari** (macOS/iOS)
- ✅ **Яндекс Браузер**
- ✅ **Arc Browser**