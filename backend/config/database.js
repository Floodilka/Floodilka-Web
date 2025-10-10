const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  try {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/floodilka';

    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    logger.info('📦 MongoDB подключена успешно');
    logger.info(`📍 URI: ${MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@')}`);
  } catch (error) {
    logger.error('❌ Ошибка подключения к MongoDB:', error);
    process.exit(1);
  }
};

module.exports = { connectDB };

