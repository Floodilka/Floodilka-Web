const express = require('express');
const router = express.Router();
const directMessageController = require('../controllers/directMessageController');
const { authenticateToken } = require('../middleware/auth');

// Отправить личное сообщение
router.post('/send', authenticateToken, directMessageController.sendMessage);

// Получить личные сообщения с конкретным пользователем
router.get('/conversation/:userId', authenticateToken, directMessageController.getConversation);

// Получить список разговоров
router.get('/conversations', authenticateToken, directMessageController.getConversations);

// Отметить сообщения как прочитанные
router.put('/read/:userId', authenticateToken, directMessageController.markAsRead);

// Редактировать сообщение
router.put('/edit/:messageId', authenticateToken, directMessageController.editMessage);

// Удалить сообщение
router.delete('/delete/:messageId', authenticateToken, directMessageController.deleteMessage);

module.exports = router;

