const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { authenticateToken } = require('../middleware/auth');

// Получить сообщения канала
router.get('/channels/:channelId', authenticateToken, messageController.getChannelMessages);

// Загрузить файлы для сообщений
router.post('/upload', authenticateToken, messageController.uploadFiles, messageController.uploadMessageFiles);

// Редактировать сообщение
router.put('/:messageId', authenticateToken, messageController.editMessage);

// Удалить сообщение
router.delete('/:messageId', authenticateToken, messageController.deleteMessage);

module.exports = router;

