const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

// Конфигурация
const config = require('./config/env');
const { connectDB } = require('./config/database');
const logger = require('./utils/logger');

// Middleware
const errorHandler = require('./middleware/errorHandler');

// Routes
const authRoutes = require('./routes/auth');
const serverRoutes = require('./routes/servers');
const roleRoutes = require('./routes/roles');
const directMessageRoutes = require('./routes/directMessages');
const messageRoutes = require('./routes/messages');

// WebSocket
const WebSocketManager = require('./websocket');

// Инициализация приложения
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: config.corsOptions
});

// Middleware
app.use(cors({
  origin: config.frontendUrl,
  credentials: true
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ limit: '2mb', extended: true }));

// Статические файлы (для аватаров)
app.use('/uploads', express.static('uploads'));

// Добавляем io в app для доступа в контроллерах
app.set('io', io);

// Подключение к базе данных
connectDB().then(async () => {
  // Сбросить все статусы на offline при запуске (на случай сбоя сервера)
  try {
    const User = require('./models/User');
    const result = await User.updateMany(
      { status: 'online' },
      { status: 'offline' }
    );
    if (result.modifiedCount > 0) {
      logger.info(`🔄 Сброшено ${result.modifiedCount} пользовательских статусов на offline при запуске`);
    }
  } catch (err) {
    logger.error('Ошибка при сбросе статусов пользователей:', err);
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/direct-messages', directMessageRoutes);
app.use('/api/messages', messageRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv
  });
});

// Error handling middleware (должен быть последним)
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Маршрут не найден'
  });
});

// Инициализация WebSocket
const wsManager = new WebSocketManager(io);
wsManager.initialize();

// Запуск сервера
server.listen(config.port, () => {
  logger.info(`🚀 Сервер запущен на порту ${config.port}`);
  logger.info(`📝 Режим: ${config.nodeEnv}`);
  logger.info(`🌐 CORS настроен для: ${config.frontendUrl}`);
  logger.info(`✅ Новая архитектура загружена`);
});

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

  // Закрываем WebSocket соединения
  io.close(() => {
    logger.info('WebSocket сервер закрыт');
  });

  // Установить всех пользователей в offline перед закрытием
  (async () => {
    try {
      const User = require('./models/User');
      const result = await User.updateMany(
        { status: 'online' },
        { status: 'offline' }
      );
      if (result.modifiedCount > 0) {
        logger.info(`🔄 Установлено ${result.modifiedCount} пользователей в offline при остановке`);
      }
    } catch (err) {
      logger.error('Ошибка при установке статусов offline:', err);
    }
  })();

  // Закрываем MongoDB соединение
  const mongoose = require('mongoose');
  mongoose.connection.close(() => {
    logger.info('MongoDB соединение закрыто');
  });

  server.close(() => {
    clearTimeout(forceExit);
    logger.info('HTTP сервер остановлен');
    process.exit(0);
  });
};

// Graceful shutdown (только если еще не добавлены)
if (!process.listenerCount('SIGTERM')) {
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
}
if (!process.listenerCount('SIGINT')) {
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

// Обработка необработанных ошибок
process.on('unhandledRejection', (err) => {
  logger.error('UNHANDLED REJECTION! 💥 Завершаем работу...', err);
  if (!isShuttingDown) {
    gracefulShutdown('UNHANDLED_REJECTION');
  }
});

process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION! 💥 Завершаем работу...', err);
  if (!isShuttingDown) {
    gracefulShutdown('UNCAUGHT_EXCEPTION');
  }
});

module.exports = { app, server, io };

