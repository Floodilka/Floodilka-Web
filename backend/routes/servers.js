const express = require('express');
const router = express.Router();
const Server = require('../models/Server');
const Channel = require('../models/Channel');
const Invite = require('../models/Invite');
const { authenticateToken } = require('../middleware/auth');
const crypto = require('crypto');

// Получить все серверы пользователя
router.get('/', authenticateToken, async (req, res) => {
  try {
    const servers = await Server.find({
      $or: [
        { ownerId: req.user.id },
        { members: req.user.id }
      ]
    }).sort({ createdAt: 1 });

    res.json(servers);
  } catch (error) {
    console.error('Ошибка получения серверов:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Создать новый сервер
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, icon } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Название сервера обязательно' });
    }

    // Создаем сервер
    const server = new Server({
      name: name.trim(),
      icon: icon || null,
      ownerId: req.user.id,
      members: [req.user.id]
    });

    await server.save();

    // Создаем дефолтные каналы для сервера
    const textChannel = new Channel({
      name: 'общий',
      type: 'text',
      serverId: server._id,
      createdBy: req.user.id
    });

    const voiceChannel = new Channel({
      name: 'Голосовой',
      type: 'voice',
      serverId: server._id,
      createdBy: req.user.id
    });

    await Promise.all([textChannel.save(), voiceChannel.save()]);

    res.status(201).json(server);
  } catch (error) {
    console.error('Ошибка создания сервера:', error);
    res.status(500).json({ error: 'Ошибка создания сервера' });
  }
});

// Получить каналы сервера
router.get('/:serverId/channels', authenticateToken, async (req, res) => {
  try {
    const { serverId } = req.params;

    // Проверить доступ к серверу
    const server = await Server.findById(serverId);
    if (!server) {
      return res.status(404).json({ error: 'Сервер не найден' });
    }

    if (!server.members.includes(req.user.id) && server.ownerId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Нет доступа к этому серверу' });
    }

    const channels = await Channel.find({ serverId }).sort({ createdAt: 1 });
    res.json(channels);
  } catch (error) {
    console.error('Ошибка получения каналов:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Создать инвайт для сервера
router.post('/:serverId/invites', authenticateToken, async (req, res) => {
  try {
    const { serverId } = req.params;
    const { maxUses, expiresIn } = req.body; // expiresIn в часах

    // Проверить доступ к серверу
    const server = await Server.findById(serverId);
    if (!server) {
      return res.status(404).json({ error: 'Сервер не найден' });
    }

    if (!server.members.includes(req.user.id) && server.ownerId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Нет доступа к этому серверу' });
    }

    // Генерируем уникальный код
    const code = crypto.randomBytes(4).toString('hex');

    // Вычисляем срок действия
    let expiresAt = null;
    if (expiresIn) {
      expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + expiresIn);
    }

    const invite = new Invite({
      code,
      serverId,
      createdBy: req.user.id,
      maxUses: maxUses || null,
      expiresAt
    });

    await invite.save();

    res.status(201).json({
      code: invite.code,
      url: `${req.protocol}://${req.get('host')}/invite/${invite.code}`,
      expiresAt: invite.expiresAt,
      maxUses: invite.maxUses
    });
  } catch (error) {
    console.error('Ошибка создания инвайта:', error);
    res.status(500).json({ error: 'Ошибка создания приглашения' });
  }
});

// Присоединиться к серверу по инвайт-коду
router.post('/join/:code', authenticateToken, async (req, res) => {
  try {
    const { code } = req.params;

    // Найти инвайт
    const invite = await Invite.findOne({ code }).populate('serverId');
    if (!invite) {
      return res.status(404).json({ error: 'Приглашение не найдено' });
    }

    // Проверить валидность
    if (!invite.isValid()) {
      return res.status(400).json({ error: 'Приглашение истекло или недействительно' });
    }

    const server = await Server.findById(invite.serverId);
    if (!server) {
      return res.status(404).json({ error: 'Сервер не найден' });
    }

    // Проверить, не является ли пользователь уже членом
    if (server.members.includes(req.user.id)) {
      return res.json({ message: 'Вы уже являетесь членом этого сервера', server });
    }

    // Добавить пользователя к серверу
    server.members.push(req.user.id);
    await server.save();

    // Увеличить счетчик использований
    invite.uses += 1;
    await invite.save();

    res.json({ message: 'Успешно присоединились к серверу', server });
  } catch (error) {
    console.error('Ошибка присоединения к серверу:', error);
    res.status(500).json({ error: 'Ошибка присоединения к серверу' });
  }
});

// Получить инвайты сервера
router.get('/:serverId/invites', authenticateToken, async (req, res) => {
  try {
    const { serverId } = req.params;

    // Проверить доступ к серверу
    const server = await Server.findById(serverId);
    if (!server) {
      return res.status(404).json({ error: 'Сервер не найден' });
    }

    if (!server.members.includes(req.user.id) && server.ownerId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Нет доступа к этому серверу' });
    }

    const invites = await Invite.find({ serverId }).populate('createdBy', 'username');
    res.json(invites);
  } catch (error) {
    console.error('Ошибка получения инвайтов:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Создать канал в сервере
router.post('/:serverId/channels', authenticateToken, async (req, res) => {
  try {
    const { serverId } = req.params;
    const { name, type } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Название канала обязательно' });
    }

    // Проверить доступ к серверу
    const server = await Server.findById(serverId);
    if (!server) {
      return res.status(404).json({ error: 'Сервер не найден' });
    }

    if (!server.members.includes(req.user.id) && server.ownerId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Нет доступа к этому серверу' });
    }

    const channelType = type === 'voice' ? 'voice' : 'text';
    const newChannel = new Channel({
      name: name.trim(),
      type: channelType,
      serverId: server._id,
      createdBy: req.user.id
    });

    await newChannel.save();

    res.status(201).json(newChannel);
  } catch (error) {
    console.error('Ошибка создания канала:', error);
    res.status(500).json({ error: 'Ошибка создания канала' });
  }
});

module.exports = router;

