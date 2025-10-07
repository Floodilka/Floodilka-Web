const express = require('express');
const router = express.Router();
const DirectMessage = require('../models/DirectMessage');
const auth = require('../middleware/auth');
const mongoose = require('mongoose');

// Отправить личное сообщение
router.post('/send', auth.authenticateToken, async (req, res) => {
  try {
    console.log('📨 Получен запрос на отправку сообщения:', req.body);
    console.log('👤 Отправитель:', req.user);

    const { receiverId, content } = req.body;

    if (!receiverId || !content) {
      console.log('❌ Отсутствуют обязательные поля:', { receiverId, content });
      return res.status(400).json({ error: 'Получатель и содержимое сообщения обязательны' });
    }

    if (receiverId === req.user.id) {
      console.log('❌ Попытка отправить сообщение самому себе');
      return res.status(400).json({ error: 'Нельзя отправить сообщение самому себе' });
    }

    const directMessage = new DirectMessage({
      sender: req.user.id,
      receiver: receiverId,
      content: content.trim()
    });

    console.log('💾 Сохраняем сообщение в базу данных...');
    await directMessage.save();
    console.log('✅ Сообщение сохранено с ID:', directMessage._id);

    // Популируем данные отправителя и получателя
    await directMessage.populate([
      { path: 'sender', select: 'username displayName avatar badge badgeTooltip' },
      { path: 'receiver', select: 'username displayName avatar badge badgeTooltip' }
    ]);

    console.log('📤 Отправляем ответ клиенту...');

    // Отправляем сообщение через WebSocket получателю и отправителю
    const io = req.app.get('io');
    if (io) {
      io.emit('direct-message:new', directMessage);
      console.log('📡 Сообщение отправлено через WebSocket');
    }

    res.status(201).json(directMessage);
  } catch (error) {
    console.error('Ошибка отправки личного сообщения:', error);
    res.status(500).json({ error: 'Ошибка сервера при отправке сообщения' });
  }
});

// Получить личные сообщения с конкретным пользователем
router.get('/conversation/:userId', auth.authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const skip = (page - 1) * limit;

    const currentUserId = new mongoose.Types.ObjectId(req.user.id);
    const targetUserId = new mongoose.Types.ObjectId(userId);

    console.log('📥 Загрузка сообщений между пользователями:', currentUserId, targetUserId);

    const messages = await DirectMessage.find({
      $or: [
        { sender: currentUserId, receiver: targetUserId },
        { sender: targetUserId, receiver: currentUserId }
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
router.get('/conversations', auth.authenticateToken, async (req, res) => {
  try {
    console.log('📥 Запрос списка разговоров для пользователя:', req.user.id);

    const userId = new mongoose.Types.ObjectId(req.user.id);
    console.log('📥 Преобразован в ObjectId:', userId);

    const conversations = await DirectMessage.aggregate([
      {
        $match: {
          $or: [
            { sender: userId },
            { receiver: userId }
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
              { $eq: ['$sender', userId] },
              '$receiver',
              '$sender'
            ]
          },
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$receiver', userId] }, { $eq: ['$read', false] }] },
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
        $lookup: {
          from: 'users',
          localField: 'lastMessage.sender',
          foreignField: '_id',
          as: 'lastMessage.senderData'
        }
      },
      {
        $unwind: '$lastMessage.senderData'
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
            sender: {
              _id: '$lastMessage.senderData._id',
              username: '$lastMessage.senderData.username',
              displayName: '$lastMessage.senderData.displayName',
              avatar: '$lastMessage.senderData.avatar'
            }
          },
          unreadCount: 1
        }
      },
      {
        $sort: { 'lastMessage.timestamp': -1 }
      }
    ]);

    console.log('📥 Найдено разговоров:', conversations.length);
    console.log('📥 Результат:', conversations);
    res.json(conversations);
  } catch (error) {
    console.error('Ошибка получения списка разговоров:', error);
    res.status(500).json({ error: 'Ошибка сервера при получении разговоров' });
  }
});

// Отметить сообщения как прочитанные
router.put('/read/:userId', auth.authenticateToken, async (req, res) => {
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
router.put('/edit/:messageId', auth.authenticateToken, async (req, res) => {
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
router.delete('/delete/:messageId', auth.authenticateToken, async (req, res) => {
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
