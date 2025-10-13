const mongoose = require('mongoose');
const logger = require('../utils/logger');
const config = require('./env');

mongoose.set('strictQuery', true);

const connectDB = async () => {
  try {
    const MONGODB_URI = config.mongodbUri;

    await mongoose.connect(MONGODB_URI, {
      maxPoolSize: config.mongoMaxPoolSize,
      minPoolSize: config.mongoMinPoolSize,
      serverSelectionTimeoutMS: config.mongoConnectTimeoutMs,
      socketTimeoutMS: 60000
    });

    mongoose.connection.on('connected', () => {
      logger.info('📦 MongoDB подключена успешно');
      logger.info(`📍 URI: ${MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@')}`);
    });

    mongoose.connection.on('error', (err) => {
      logger.error('❌ Ошибка MongoDB соединения:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('⚠️  MongoDB соединение потеряно, попытка переподключения...');
    });
  } catch (error) {
    logger.error('❌ Ошибка подключения к MongoDB:', error);
    process.exit(1);
  }
};

module.exports = { connectDB };
