const express = require('express');
const router = express.Router();
const DirectMessage = require('../models/DirectMessage');
const { authenticateToken } = require('../middleware/auth');

// Отправить личное сообщение
router.post('/send', authenticateToken, async (req, res) => {
  try {
    const { receiverId, content } = req.body;

    if (!receiverId || !content) {
      return res.status(400).json({ error: 'Получатель и содержимое сообщения обязательны' });
    }

    if (receiverId === req.user.id) {
      return res.status(400).json({ error: 'Нельзя отправить сообщение самому себе' });
    }

    const directMessage = new DirectMessage({
      sender: req.user.id,
      receiver: receiverId,
      content: content.trim()
    });

    await directMessage.save();

    // Популируем данные отправителя и получателя
    await directMessage.populate([
      { path: 'sender', select: 'username displayName avatar badge badgeTooltip' },
      { path: 'receiver', select: 'username displayName avatar badge badgeTooltip' }
    ]);

    // Отправляем сообщение через WebSocket всем подключенным клиентам
    req.app.get('io').emit('direct-message:new', directMessage);

    res.status(201).json(directMessage);
  } catch (error) {
    console.error('Ошибка отправки личного сообщения:', error);
    res.status(500).json({ error: 'Ошибка сервера при отправке сообщения' });
  }
});

// Получить личные сообщения с конкретным пользователем
router.get('/conversation/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const skip = (page - 1) * limit;

    const messages = await DirectMessage.find({
      $or: [
        { sender: req.user.id, receiver: userId },
        { sender: userId, receiver: req.user.id }
      ],
      deleted: false
    })
    .populate('sender', 'username displayName avatar badge badgeTooltip')
    .populate('receiver', 'username displayName avatar badge badgeTooltip')
    .sort({ timestamp: -1 })
    .limit(parseInt(limit))
    .skip(skip);

    // Отмечаем сообщения как прочитанные
    await DirectMessage.updateMany(
      { sender: userId, receiver: req.user.id, read: false },
      { read: true }
    );

    res.json(messages.reverse());
  } catch (error) {
    console.error('Ошибка получения личных сообщений:', error);
    res.status(500).json({ error: 'Ошибка сервера при получении сообщений' });
  }
});

// Получить список разговоров (последние сообщения с каждым пользователем)
router.get('/conversations', authenticateToken, async (req, res) => {
  try {
    const conversations = await DirectMessage.aggregate([
      {
        $match: {
          $or: [
            { sender: req.user._id },
            { receiver: req.user._id }
          ],
          deleted: false
        }
      },
      {
        $sort: { timestamp: -1 }
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ['$sender', req.user._id] },
              '$receiver',
              '$sender'
            ]
          },
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$receiver', req.user._id] }, { $eq: ['$read', false] }] },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      {
        $project: {
          user: {
            _id: '$user._id',
            username: '$user.username',
            displayName: '$user.displayName',
            avatar: '$user.avatar',
            badge: '$user.badge',
            badgeTooltip: '$user.badgeTooltip'
          },
          lastMessage: {
            _id: '$lastMessage._id',
            content: '$lastMessage.content',
            timestamp: '$lastMessage.timestamp',
            sender: '$lastMessage.sender'
          },
          unreadCount: 1
        }
      },
      {
        $sort: { 'lastMessage.timestamp': -1 }
      }
    ]);

    res.json(conversations);
  } catch (error) {
    console.error('Ошибка получения списка разговоров:', error);
    res.status(500).json({ error: 'Ошибка сервера при получении разговоров' });
  }
});

// Отметить сообщения как прочитанные
router.put('/read/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    await DirectMessage.updateMany(
      { sender: userId, receiver: req.user.id, read: false },
      { read: true }
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка отметки сообщений как прочитанных:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Редактировать сообщение
router.put('/edit/:messageId', authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Содержимое сообщения обязательно' });
    }

    const message = await DirectMessage.findOneAndUpdate(
      { _id: messageId, sender: req.user.id, deleted: false },
      {
        content: content.trim(),
        edited: true,
        editedAt: new Date()
      },
      { new: true }
    ).populate([
      { path: 'sender', select: 'username displayName avatar badge badgeTooltip' },
      { path: 'receiver', select: 'username displayName avatar badge badgeTooltip' }
    ]);

    if (!message) {
      return res.status(404).json({ error: 'Сообщение не найдено' });
    }

    req.app.get('io').emit('direct-message:edited', message);

    res.json(message);
  } catch (error) {
    console.error('Ошибка редактирования сообщения:', error);
    res.status(500).json({ error: 'Ошибка сервера при редактировании сообщения' });
  }
});

// Удалить сообщение
router.delete('/delete/:messageId', authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await DirectMessage.findOneAndUpdate(
      { _id: messageId, sender: req.user.id, deleted: false },
      {
        deleted: true,
        deletedAt: new Date()
      },
      { new: true }
    );

    if (!message) {
      return res.status(404).json({ error: 'Сообщение не найдено' });
    }

    req.app.get('io').emit('direct-message:deleted', { messageId });

    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка удаления сообщения:', error);
    res.status(500).json({ error: 'Ошибка сервера при удалении сообщения' });
  }
});

module.exports = router;
