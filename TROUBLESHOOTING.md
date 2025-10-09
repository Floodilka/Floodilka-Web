# Устранение неполадок

## Проблема: Ctrl+C не работает (сервер не останавливается)

### Симптомы:
- Нажатие Ctrl+C не останавливает сервер
- Появляется сообщение "SIGINT получен, завершаем работу..." но сервер продолжает работать
- Ошибка "MaxListenersExceededWarning: Possible EventEmitter memory leak detected"

### Причина:
1. **Множественные обработчики событий** - обработчики SIGINT добавляются несколько раз
2. **Утечка памяти** - накапливаются слушатели событий
3. **Некорректное закрытие соединений** - WebSocket и MongoDB соединения не закрываются

### Решение ✅

#### 1. Обновленный graceful shutdown
```javascript
// Флаг для предотвращения множественных вызовов
let isShuttingDown = false;

const gracefulShutdown = (signal) => {
  if (isShuttingDown) {
    logger.warn(`${signal} получен повторно, принудительное завершение...`);
    process.exit(1);
  }

  isShuttingDown = true;
  logger.info(`${signal} получен, завершаем работу...`);

  // Таймаут для принудительного завершения
  const forceExit = setTimeout(() => {
    logger.error('Принудительное завершение по таймауту');
    process.exit(1);
  }, 10000); // 10 секунд

  // Закрываем все соединения
  io.close(() => logger.info('WebSocket сервер закрыт'));
  mongoose.connection.close(() => logger.info('MongoDB соединение закрыто'));

  server.close(() => {
    clearTimeout(forceExit);
    logger.info('HTTP сервер остановлен');
    process.exit(0);
  });
};
```

#### 2. Предотвращение дублирования обработчиков
```javascript
// Graceful shutdown (только если еще не добавлены)
if (!process.listenerCount('SIGTERM')) {
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
}
if (!process.listenerCount('SIGINT')) {
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}
```

### Команды для решения проблемы:

#### Если сервер завис:
```bash
# 1. Попробуйте Ctrl+C еще раз (теперь должно работать)
# 2. Если не помогает, используйте принудительное завершение:
cd backend
npm run kill

# 3. Или вручную:
pkill -f "node.*server.js"
```

#### Проверка процессов:
```bash
# Посмотреть все процессы Node.js
ps aux | grep node

# Завершить конкретный процесс
kill -9 <PID>
```

### Предотвращение проблемы:

1. **Всегда используйте Ctrl+C** для остановки сервера
2. **Не запускайте сервер несколько раз** одновременно
3. **Проверяйте**, что предыдущий процесс завершился перед новым запуском

## Другие проблемы

### Проблема: "Port already in use"
```bash
# Найти процесс на порту 3001
lsof -ti:3001

# Завершить процесс
kill -9 $(lsof -ti:3001)
```

### Проблема: "MongoDB connection failed"
```bash
# Запустить MongoDB
cd backend
npm run db:start

# Или вручную
mongod --dbpath ./data/db
```

### Проблема: "Module not found"
```bash
# Переустановить зависимости
cd backend
rm -rf node_modules package-lock.json
npm install
```

## Полезные команды

### Backend:
```bash
cd backend

# Запуск в dev режиме
npm run dev

# Запуск в production
npm start

# Принудительное завершение
npm run kill

# Работа с БД
npm run db:start    # Запустить MongoDB
npm run db:stop     # Остановить MongoDB
npm run db:logs     # Логи MongoDB
npm run db:reset    # Сбросить БД
```

### Frontend:
```bash
cd frontend

# Запуск в dev режиме
npm start

# Сборка для production
npm run build
```

### Общие:
```bash
# Проверить все процессы Node.js
ps aux | grep node

# Завершить все процессы Node.js
pkill -f node

# Проверить порты
netstat -tulpn | grep :3001
netstat -tulpn | grep :3000
```

## Логи и отладка

### Просмотр логов:
```bash
# Backend логи (в терминале где запущен сервер)
# Или в файле если настроено логирование

# MongoDB логи
cd backend
npm run db:logs
```

### Отладка:
```bash
# Запуск с отладкой
node --inspect server.js

# Или с nodemon
nodemon --inspect server.js
```

## Контакты

Если проблема не решается:
1. Проверьте логи сервера
2. Убедитесь что все зависимости установлены
3. Проверьте что порты свободны
4. Попробуйте перезапустить терминал

## Заключение

Проблема с Ctrl+C решена! Теперь сервер корректно завершается по Ctrl+C с graceful shutdown всех соединений. 🎉
