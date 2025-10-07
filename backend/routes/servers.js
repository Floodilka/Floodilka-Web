const express = require('express');
const router = express.Router();
const Server = require('../models/Server');
const Channel = require('../models/Channel');
const Invite = require('../models/Invite');
const Role = require('../models/Role');
const { authenticateToken } = require('../middleware/auth');
const { canManageChannels, hasServerAccess } = require('../middleware/permissions');
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

    // Добавляем информацию о правах пользователя для каждого сервера
    const serversWithPermissions = await Promise.all(servers.map(async (server) => {
      const isOwner = server.ownerId.toString() === req.user.id;
      
      let canManageChannels = isOwner; // Владелец всегда может управлять каналами
      
      if (!isOwner) {
        // Проверяем роли пользователя на сервере
        const ServerRole = require('../models/ServerRole');
        const userRoles = await ServerRole.find({
          userId: req.user.id,
          serverId: server._id
        }).populate('roleId');
        
        // Проверяем, есть ли у пользователя права на управление каналами
        canManageChannels = userRoles.some(userRole =>
          userRole.roleId.permissions.manageChannels ||
          userRole.roleId.permissions.manageServer
        );
      }
      
      return {
        ...server.toObject(),
        isOwner,
        canManageChannels
      };
    }));

    res.json(serversWithPermissions);
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

    // Создаем роль Administrator
    const adminRole = new Role({
      name: 'Administrator',
      serverId: server._id,
      permissions: {
        manageServer: true,
        manageChannels: true,
        manageRoles: true,
        manageMembers: true,
        kickMembers: true,
        banMembers: true
      },
      color: '#ed4245',
      position: 1000, // Высокий приоритет
      createdBy: req.user.id
    });

    await adminRole.save();

    // Назначаем роль Administrator создателю сервера
    const ServerRole = require('../models/ServerRole');
    const serverRole = new ServerRole({
      userId: req.user.id,
      serverId: server._id,
      roleId: adminRole._id,
      assignedBy: req.user.id
    });

    await serverRole.save();

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
router.get('/:serverId/channels', authenticateToken, hasServerAccess, async (req, res) => {
  try {
    const { serverId } = req.params;

    const channels = await Channel.find({ serverId }).sort({ createdAt: 1 });
    res.json(channels);
  } catch (error) {
    console.error('Ошибка получения каналов:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получить всех участников сервера
router.get('/:serverId/members', authenticateToken, async (req, res) => {
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

    // Получить всех участников (включая владельца)
    const memberIds = [...new Set([server.ownerId, ...server.members])];
    const User = require('../models/User');
    const members = await User.find({ _id: { $in: memberIds } })
      .select('-password -email')
      .sort({ username: 1 });

    const membersData = members.map(member => ({
      id: member._id,
      username: member.username,
      displayName: member.displayName,
      avatar: member.avatar,
      badge: member.badge,
      badgeTooltip: member.badgeTooltip,
      status: member.status
    }));

    res.json(membersData);
  } catch (error) {
    console.error('Ошибка получения участников:', error);
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
router.post('/:serverId/channels', authenticateToken, canManageChannels, async (req, res) => {
  try {
    const { serverId } = req.params;
    const { name, type } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Название канала обязательно' });
    }

    const channelType = type === 'voice' ? 'voice' : 'text';
    const newChannel = new Channel({
      name: name.trim(),
      type: channelType,
      serverId: req.server._id,
      createdBy: req.user.id
    });

    await newChannel.save();

    res.status(201).json(newChannel);
  } catch (error) {
    console.error('Ошибка создания канала:', error);
    res.status(500).json({ error: 'Ошибка создания канала' });
  }
});

// Обновить канал
router.put('/:serverId/channels/:channelId', authenticateToken, canManageChannels, async (req, res) => {
  try {
    const { serverId, channelId } = req.params;
    const { name, topic, slowMode, nsfw, hideAfterInactivity } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Название канала обязательно' });
    }

    // Найти канал
    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ error: 'Канал не найден' });
    }

    // Проверить, что канал принадлежит этому серверу
    if (channel.serverId.toString() !== serverId) {
      return res.status(400).json({ error: 'Канал не принадлежит этому серверу' });
    }

    // Обновить поля канала
    channel.name = name.trim();
    if (topic !== undefined) channel.topic = topic.trim();
    if (slowMode !== undefined) channel.slowMode = slowMode;
    if (nsfw !== undefined) channel.nsfw = nsfw;
    if (hideAfterInactivity !== undefined) channel.hideAfterInactivity = hideAfterInactivity;

    await channel.save();

    res.json(channel);
  } catch (error) {
    console.error('Ошибка обновления канала:', error);
    res.status(500).json({ error: 'Ошибка обновления канала' });
  }
});

// Удалить канал
router.delete('/:serverId/channels/:channelId', authenticateToken, canManageChannels, async (req, res) => {
  try {
    const { serverId, channelId } = req.params;

    // Найти канал
    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ error: 'Канал не найден' });
    }

    // Проверить, что канал принадлежит этому серверу
    if (channel.serverId.toString() !== serverId) {
      return res.status(400).json({ error: 'Канал не принадлежит этому серверу' });
    }

    // Удалить канал
    await Channel.findByIdAndDelete(channelId);

    res.json({ message: 'Канал успешно удален' });
  } catch (error) {
    console.error('Ошибка удаления канала:', error);
    res.status(500).json({ error: 'Ошибка удаления канала' });
  }
});

module.exports = router;

