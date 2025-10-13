require('dotenv').config();

const config = {
  // Server
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Frontend
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  
  // Database
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/floodilka',
  mongoMaxPoolSize: parseInt(process.env.MONGO_MAX_POOL_SIZE || '20', 10),
  mongoMinPoolSize: parseInt(process.env.MONGO_MIN_POOL_SIZE || '5', 10),
  mongoConnectTimeoutMs: parseInt(process.env.MONGO_CONNECT_TIMEOUT_MS || '10000', 10),
  
  // JWT
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  
  // File Upload
  uploadDir: process.env.UPLOAD_DIR || './uploads',
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 2 * 1024 * 1024, // 2MB
  
  // WebSocket
  corsOptions: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ["GET", "POST"],
    credentials: true
  },

  // Redis (optional)
  redisUrl: process.env.REDIS_URL || null,
  redisTls: process.env.REDIS_TLS === 'true',
  redisKeyPrefix: process.env.REDIS_KEY_PREFIX || 'floodilka',

  // Rate limiting
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '600', 10)
};

module.exports = config;
