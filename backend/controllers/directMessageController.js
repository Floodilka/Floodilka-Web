const directMessageService = require('../services/directMessageService');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');

exports.sendMessage = asyncHandler(async (req, res) => {
  const { receiverId, content, attachments } = req.body;

  logger.debug('📨 Получен запрос на отправку DM:', { sender: req.user.id, receiver: receiverId, hasAttachments: attachments && attachments.length > 0 });

  const message = await directMessageService.sendMessage(req.user.id, receiverId, content, attachments);

  // Отправляем сообщение через WebSocket
  const io = req.app.get('io');
  if (io) {
    io.emit('direct-message:new', message);
    logger.debug('📡 DM отправлено через WebSocket');
  }

  res.status(201).json(message);
});

exports.getConversation = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { page = 1, limit = 50 } = req.query;

  const messages = await directMessageService.getConversation(req.user.id, userId, page, limit);
  res.json(messages);
});

exports.getConversations = asyncHandler(async (req, res) => {
  logger.debug('📥 Запрос списка разговоров для пользователя:', req.user.id);

  const conversations = await directMessageService.getConversations(req.user.id);

  logger.debug('📥 Найдено разговоров:', conversations.length);
  res.json(conversations);
});

exports.markAsRead = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const result = await directMessageService.markAsRead(req.user.id, userId);
  res.json(result);
});

exports.editMessage = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const { content } = req.body;

  const message = await directMessageService.editMessage(messageId, req.user.id, content);

  const io = req.app.get('io');
  if (io) {
    io.emit('direct-message:edited', message);
  }

  res.json(message);
});

exports.deleteMessage = asyncHandler(async (req, res) => {
  const { messageId } = req.params;

  const result = await directMessageService.deleteMessage(messageId, req.user.id);

  const io = req.app.get('io');
  if (io) {
    io.emit('direct-message:deleted', { messageId: result.messageId });
  }

  res.json(result);
});

