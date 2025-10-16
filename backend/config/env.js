require('dotenv').config();

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

const boolFromEnv = (value, fallback) => {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const numberFromEnv = (value, fallback) => {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const jsonFromEnv = (value, fallback) => {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed;
  } catch (err) {
    console.warn('⚠️  Failed to parse JSON env variable:', err.message);
    return fallback;
  }
};

const normalizeIceServers = (rawServers, fallback) => {
  if (!Array.isArray(rawServers)) {
    return fallback;
  }

  return rawServers
    .map((entry) => {
      if (!entry) return null;
      if (typeof entry === 'string') {
        return { urls: entry };
      }
      if (entry.urls) {
        const normalized = { urls: entry.urls };
        if (entry.username || entry.credential) {
          if (entry.username) normalized.username = entry.username;
          if (entry.credential) normalized.credential = entry.credential;
        }
        if (entry.credentialType) {
          normalized.credentialType = entry.credentialType;
        }
        return normalized;
      }
      return null;
    })
    .filter(Boolean);
};

const defaultVoiceIceServers = [
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  // Добавляем TURN серверы для стабильности соединений
  // В продакшене замените на ваши TURN серверы
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject'
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject'
  },
  {
    urls: 'turns:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject'
  }
];

const tlsKeyPath = process.env.TLS_KEY_PATH;
const tlsCertPath = process.env.TLS_CERT_PATH;

const config = {
  // Server
  port: process.env.PORT || 3001,
  nodeEnv,

  // Frontend
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',

  // Database
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/floodilka',
  mongoMaxPoolSize: numberFromEnv(process.env.MONGO_MAX_POOL_SIZE, 20),
  mongoMinPoolSize: numberFromEnv(process.env.MONGO_MIN_POOL_SIZE, 5),
  mongoConnectTimeoutMs: numberFromEnv(process.env.MONGO_CONNECT_TIMEOUT_MS, 10000),

  // JWT
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  // Cookie settings
  cookieSecret: process.env.COOKIE_SECRET || null,
  jwtCookie: {
    enabled: boolFromEnv(process.env.JWT_COOKIE_ENABLED, true),
    name: process.env.JWT_COOKIE_NAME || 'floodilka.sid',
    sameSite: (process.env.JWT_COOKIE_SAMESITE || 'lax').toLowerCase(),
    secure: boolFromEnv(process.env.JWT_COOKIE_SECURE, isProduction),
    domain: process.env.JWT_COOKIE_DOMAIN || null,
    path: process.env.JWT_COOKIE_PATH || '/',
    maxAge: numberFromEnv(process.env.JWT_COOKIE_MAX_AGE, 7 * 24 * 60 * 60 * 1000),
    signed: boolFromEnv(process.env.JWT_COOKIE_SIGNED, Boolean(process.env.COOKIE_SECRET))
  },

  // File Upload
  uploadDir: process.env.UPLOAD_DIR || './uploads',
  maxFileSize: numberFromEnv(process.env.MAX_FILE_SIZE, 2 * 1024 * 1024), // 2MB

  // WebSocket
  corsOptions: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  },

  // Redis (optional)
  redisUrl: process.env.REDIS_URL || null,
  redisTls: process.env.REDIS_TLS === 'true',
  redisKeyPrefix: process.env.REDIS_KEY_PREFIX || 'floodilka',

  // Rate limiting
  rateLimitWindowMs: numberFromEnv(process.env.RATE_LIMIT_WINDOW_MS, 60000),
  rateLimitMax: numberFromEnv(process.env.RATE_LIMIT_MAX, 600),

  // TLS
  tls: {
    enabled: Boolean(tlsKeyPath && tlsCertPath),
    keyPath: tlsKeyPath || null,
    certPath: tlsCertPath || null,
    caPath: process.env.TLS_CA_PATH || null,
    passphrase: process.env.TLS_PASSPHRASE || null
  },

  // Voice / WebRTC
  voice: {
    iceServers: normalizeIceServers(
      jsonFromEnv(process.env.VOICE_ICE_SERVERS, null),
      defaultVoiceIceServers
    ),
    iceTransportPolicy: process.env.VOICE_ICE_TRANSPORT_POLICY || 'all',
    recording: {
      enabled: boolFromEnv(process.env.VOICE_RECORDING_ENABLED, false),
      retentionDays: numberFromEnv(process.env.VOICE_RECORDING_RETENTION_DAYS, 30)
    },
    logJoinLeave: boolFromEnv(process.env.VOICE_LOG_JOIN_LEAVE, true)
  }
};

if (isProduction && config.jwtSecret === 'your-secret-key-change-in-production') {
  throw new Error('JWT_SECRET must be provided in production environments');
}

module.exports = config;
