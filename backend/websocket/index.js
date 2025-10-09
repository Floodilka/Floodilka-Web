const ChatHandler = require('./chatHandler');
const VoiceHandler = require('./voiceHandler');
const ServerHandler = require('./serverHandler');
const logger = require('../utils/logger');

class WebSocketManager {
  constructor(io) {
    this.io = io;
    this.chatHandler = new ChatHandler(io);
    this.voiceHandler = new VoiceHandler(io);
    this.serverHandler = new ServerHandler(io);
  }

  initialize() {
    this.io.on('connection', (socket) => {
      logger.info('Новое подключение:', socket.id);

      // Регистрируем обработчики для этого сокета
      this.serverHandler.register(socket);
      this.chatHandler.register(socket);
      this.voiceHandler.register(socket);
    });

    logger.info('✅ WebSocket сервер инициализирован');
  }
}

module.exports = WebSocketManager;

