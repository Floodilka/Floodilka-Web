const Server = require('../models/Server');
const Role = require('../models/Role');
const ServerRole = require('../models/ServerRole');

// Проверка, является ли пользователь владельцем сервера
const isServerOwner = async (req, res, next) => {
  try {
    const { serverId } = req.params;
    const server = await Server.findById(serverId);

    if (!server) {
      return res.status(404).json({ error: 'Сервер не найден' });
    }

    if (server.ownerId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Недостаточно прав доступа' });
    }

    req.server = server;
    next();
  } catch (error) {
    console.error('Ошибка проверки прав владельца:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
};

// Проверка, может ли пользователь управлять сервером (владелец или Administrator)
const canManageServer = async (req, res, next) => {
  try {
    const { serverId } = req.params;
    const server = await Server.findById(serverId);

    if (!server) {
      return res.status(404).json({ error: 'Сервер не найден' });
    }

    // Проверяем, является ли пользователь владельцем
    if (server.ownerId.toString() === req.user.id) {
      req.server = server;
      req.userPermissions = { manageServer: true };
      return next();
    }

    // Проверяем, есть ли у пользователя роль Administrator
    const adminRole = await Role.findOne({
      serverId: server._id,
      name: 'Administrator'
    });

    if (!adminRole) {
      return res.status(403).json({ error: 'Недостаточно прав доступа' });
    }

    const userRole = await ServerRole.findOne({
      userId: req.user.id,
      serverId: server._id,
      roleId: adminRole._id
    });

    if (!userRole) {
      return res.status(403).json({ error: 'Недостаточно прав доступа' });
    }

    req.server = server;
    req.userPermissions = adminRole.permissions;
    next();
  } catch (error) {
    console.error('Ошибка проверки прав управления сервером:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
};

// Проверка, может ли пользователь управлять каналами
const canManageChannels = async (req, res, next) => {
  try {
    const { serverId } = req.params;
    const server = await Server.findById(serverId);

    if (!server) {
      return res.status(404).json({ error: 'Сервер не найден' });
    }

    // Проверяем, является ли пользователь владельцем
    if (server.ownerId.toString() === req.user.id) {
      req.server = server;
      req.userPermissions = { manageChannels: true };
      return next();
    }

    // Получаем все роли пользователя на сервере
    const userRoles = await ServerRole.find({
      userId: req.user.id,
      serverId: server._id
    }).populate('roleId');

    // Проверяем, есть ли у пользователя права на управление каналами
    const hasChannelPermissions = userRoles.some(userRole =>
      userRole.roleId.permissions.manageChannels ||
      userRole.roleId.permissions.manageServer
    );

    if (!hasChannelPermissions) {
      return res.status(403).json({ error: 'Недостаточно прав доступа' });
    }

    req.server = server;
    req.userPermissions = userRoles.reduce((permissions, userRole) => ({
      ...permissions,
      ...userRole.roleId.permissions
    }), {});

    next();
  } catch (error) {
    console.error('Ошибка проверки прав управления каналами:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
};

// Проверка базового доступа к серверу
const hasServerAccess = async (req, res, next) => {
  try {
    const { serverId } = req.params;
    const server = await Server.findById(serverId);

    if (!server) {
      return res.status(404).json({ error: 'Сервер не найден' });
    }

    // Проверяем, является ли пользователь членом сервера или владельцем
    if (!server.members.includes(req.user.id) && server.ownerId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Нет доступа к этому серверу' });
    }

    req.server = server;
    next();
  } catch (error) {
    console.error('Ошибка проверки доступа к серверу:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
};

module.exports = {
  isServerOwner,
  canManageServer,
  canManageChannels,
  hasServerAccess
};
