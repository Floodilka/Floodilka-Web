const messageService = require('../services/messageService');
const asyncHandler = require('../utils/asyncHandler');

exports.getChannelMessages = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  const messages = await messageService.getChannelMessages(channelId);
  res.json(messages);
});

exports.editMessage = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const { content } = req.body;
  
  const message = await messageService.editMessage(messageId, content);
  
  // Отправляем обновление всем в канале через WebSocket
  const io = req.app.get('io');
  if (io) {
    io.to(message.channelId).emit('message:edited', message);
  }
  
  res.json(message);
});

exports.deleteMessage = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  
  const { messageId: deletedId, channelId } = await messageService.deleteMessage(messageId);
  
  // Отправляем уведомление об удалении всем в канале
  const io = req.app.get('io');
  if (io) {
    io.to(channelId).emit('message:deleted', { messageId: deletedId });
  }
  
  res.json({ success: true });
});

