const express = require('express');
const http = require('http');
const https = require('https');
const socketIo = require('socket.io');
const fs = require('fs');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const Redis = require('ioredis');
const { createAdapter } = require('@socket.io/redis-adapter');
const cookieParser = require('cookie-parser');

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
const friendRoutes = require('./routes/friends');
const userRoutes = require('./routes/users');
const voiceRoutes = require('./routes/voice');

// WebSocket
const WebSocketManager = require('./websocket');

// Инициализация приложения
const app = express();
let server;
let serverProtocol = 'http';

// Настройка разрешенных origins для CORS
const allowedOrigins = [
  config.frontendUrl,
  'https://floodilka.com',
  'https://floodilka.ru',
  'http://localhost:3000' // для локальной разработки
];

if (config.tls.enabled) {
  try {
    const tlsOptions = {
      key: fs.readFileSync(config.tls.keyPath),
      cert: fs.readFileSync(config.tls.certPath)
    };

    if (config.tls.caPath) {
      tlsOptions.ca = fs.readFileSync(config.tls.caPath);
    }

    if (config.tls.passphrase) {
      tlsOptions.passphrase = config.tls.passphrase;
    }

    server = https.createServer(tlsOptions, app);
    serverProtocol = 'https';
    logger.info('🔐 HTTPS режим включен');
  } catch (error) {
    logger.error('⚠️  Не удалось инициализировать HTTPS, используется HTTP:', error);
    server = http.createServer(app);
  }
} else {
  server = http.createServer(app);
}

const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  maxHttpBufferSize: 1e6,
  pingInterval: 20000,
  pingTimeout: 30000,
  connectTimeout: 45000
});

// Настройка Socket.IO адаптера (Redis при наличии)
if (config.redisUrl) {
  const redisOptions = {
    lazyConnect: true,
    maxRetriesPerRequest: null
  };

  if (config.redisTls) {
    redisOptions.tls = {
      rejectUnauthorized: false
    };
  }

  const pubClient = new Redis(config.redisUrl, redisOptions);
  const subClient = pubClient.duplicate();

  const awaitReady = (client) => new Promise((resolve, reject) => {
    client.once('ready', resolve);
    client.once('error', reject);
  });

  pubClient.on('error', (error) => logger.error('Redis pubClient error:', error));
  subClient.on('error', (error) => logger.error('Redis subClient error:', error));

  Promise.all([awaitReady(pubClient), awaitReady(subClient)])
    .then(() => {
      io.adapter(createAdapter(pubClient, subClient));
      logger.info('🔌 Socket.IO Redis adapter активирован');
    })
    .catch((error) => {
      logger.error('⚠️  Не удалось активировать Redis adapter для Socket.IO:', error);
    });
} else {
  logger.warn('Redis не настроен — используется встроенный адаптер Socket.IO');
}

// Middleware
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(compression());

// Настройка CORS для поддержки нескольких доменов
app.use(cors({
  origin: (origin, callback) => {
    // Разрешить запросы без origin (например, Postman)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn(`CORS блокировка для origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(cookieParser(config.cookieSecret || undefined));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ limit: '2mb', extended: true }));

const apiLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Слишком много запросов. Попробуйте позже.'
    });
  }
});

app.use('/api/', apiLimiter);

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
app.use('/api/friends', friendRoutes);
app.use('/api/users', userRoutes);
app.use('/api/voice', voiceRoutes);

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
  logger.info(`🔒 Протокол: ${serverProtocol.toUpperCase()}`);
  logger.info(`📝 Режим: ${config.nodeEnv}`);
  logger.info(`🌐 CORS настроен для: ${config.frontendUrl}`);
  logger.info(`✅ Новая архитектура загружена`);
});

// Улучшенные таймауты keep-alive для большого количества соединений
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

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
