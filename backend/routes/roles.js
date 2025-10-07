const express = require('express');
const router = express.Router();
const Role = require('../models/Role');
const ServerRole = require('../models/ServerRole');
const { authenticateToken } = require('../middleware/auth');
const { canManageServer, hasServerAccess } = require('../middleware/permissions');

// Получить все роли сервера
router.get('/servers/:serverId/roles', authenticateToken, hasServerAccess, async (req, res) => {
  try {
    const { serverId } = req.params;

    const roles = await Role.find({ serverId })
      .sort({ position: -1 })
      .populate('createdBy', 'username');

    res.json(roles);
  } catch (error) {
    console.error('Ошибка получения ролей:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Создать роль
router.post('/servers/:serverId/roles', authenticateToken, canManageServer, async (req, res) => {
  try {
    const { serverId } = req.params;
    const { name, permissions, color } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Название роли обязательно' });
    }

    // Проверяем, что роль с таким именем не существует
    const existingRole = await Role.findOne({ serverId, name: name.trim() });
    if (existingRole) {
      return res.status(400).json({ error: 'Роль с таким именем уже существует' });
    }

    // Получаем максимальную позицию
    const maxPositionRole = await Role.findOne({ serverId }).sort({ position: -1 });
    const position = maxPositionRole ? maxPositionRole.position + 1 : 1;

    const role = new Role({
      name: name.trim(),
      serverId,
      permissions: permissions || {},
      color: color || '#5865f2',
      position,
      createdBy: req.user.id
    });

    await role.save();
    await role.populate('createdBy', 'username');

    res.status(201).json(role);
  } catch (error) {
    console.error('Ошибка создания роли:', error);
    res.status(500).json({ error: 'Ошибка создания роли' });
  }
});

// Обновить роль
router.put('/servers/:serverId/roles/:roleId', authenticateToken, canManageServer, async (req, res) => {
  try {
    const { serverId, roleId } = req.params;
    const { name, permissions, color, position } = req.body;

    const role = await Role.findOne({ _id: roleId, serverId });
    if (!role) {
      return res.status(404).json({ error: 'Роль не найдена' });
    }

    // Нельзя редактировать роль Administrator
    if (role.name === 'Administrator') {
      return res.status(403).json({ error: 'Роль Administrator нельзя редактировать' });
    }

    if (name && name.trim() !== '') {
      // Проверяем, что роль с таким именем не существует (кроме текущей)
      const existingRole = await Role.findOne({
        serverId,
        name: name.trim(),
        _id: { $ne: roleId }
      });
      if (existingRole) {
        return res.status(400).json({ error: 'Роль с таким именем уже существует' });
      }
      role.name = name.trim();
    }

    if (permissions) {
      role.permissions = { ...role.permissions, ...permissions };
    }

    if (color) {
      role.color = color;
    }

    if (position !== undefined) {
      role.position = position;
    }

    await role.save();
    await role.populate('createdBy', 'username');

    res.json(role);
  } catch (error) {
    console.error('Ошибка обновления роли:', error);
    res.status(500).json({ error: 'Ошибка обновления роли' });
  }
});

// Удалить роль
router.delete('/servers/:serverId/roles/:roleId', authenticateToken, canManageServer, async (req, res) => {
  try {
    const { serverId, roleId } = req.params;

    const role = await Role.findOne({ _id: roleId, serverId });
    if (!role) {
      return res.status(404).json({ error: 'Роль не найдена' });
    }

    // Нельзя удалить роль Administrator
    if (role.name === 'Administrator') {
      return res.status(403).json({ error: 'Роль Administrator нельзя удалить' });
    }

    // Удаляем все связи пользователей с этой ролью
    await ServerRole.deleteMany({ roleId: role._id });

    // Удаляем саму роль
    await Role.findByIdAndDelete(roleId);

    res.json({ message: 'Роль успешно удалена' });
  } catch (error) {
    console.error('Ошибка удаления роли:', error);
    res.status(500).json({ error: 'Ошибка удаления роли' });
  }
});

// Назначить роль пользователю
router.post('/servers/:serverId/roles/:roleId/assign', authenticateToken, canManageServer, async (req, res) => {
  try {
    const { serverId, roleId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'ID пользователя обязателен' });
    }

    const role = await Role.findOne({ _id: roleId, serverId });
    if (!role) {
      return res.status(404).json({ error: 'Роль не найдена' });
    }

    // Проверяем, что пользователь является членом сервера
    const Server = require('../models/Server');
    const server = await Server.findById(serverId);
    if (!server.members.includes(userId) && server.ownerId.toString() !== userId) {
      return res.status(400).json({ error: 'Пользователь не является членом сервера' });
    }

    // Проверяем, не назначена ли уже эта роль пользователю
    const existingAssignment = await ServerRole.findOne({ userId, serverId, roleId });
    if (existingAssignment) {
      return res.status(400).json({ error: 'Роль уже назначена пользователю' });
    }

    const serverRole = new ServerRole({
      userId,
      serverId,
      roleId,
      assignedBy: req.user.id
    });

    await serverRole.save();
    await serverRole.populate(['userId', 'roleId'], 'username name');

    res.status(201).json(serverRole);
  } catch (error) {
    console.error('Ошибка назначения роли:', error);
    res.status(500).json({ error: 'Ошибка назначения роли' });
  }
});

// Убрать роль у пользователя
router.delete('/servers/:serverId/roles/:roleId/assign', authenticateToken, canManageServer, async (req, res) => {
  try {
    const { serverId, roleId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'ID пользователя обязателен' });
    }

    const role = await Role.findOne({ _id: roleId, serverId });
    if (!role) {
      return res.status(404).json({ error: 'Роль не найдена' });
    }

    // Нельзя убрать роль Administrator у владельца сервера
    if (role.name === 'Administrator') {
      const Server = require('../models/Server');
      const server = await Server.findById(serverId);
      if (server.ownerId.toString() === userId) {
        return res.status(403).json({ error: 'Нельзя убрать роль Administrator у владельца сервера' });
      }
    }

    const serverRole = await ServerRole.findOneAndDelete({ userId, serverId, roleId });
    if (!serverRole) {
      return res.status(404).json({ error: 'Роль не назначена пользователю' });
    }

    res.json({ message: 'Роль успешно убрана' });
  } catch (error) {
    console.error('Ошибка удаления роли:', error);
    res.status(500).json({ error: 'Ошибка удаления роли' });
  }
});

// Получить роли пользователя на сервере
router.get('/servers/:serverId/users/:userId/roles', authenticateToken, hasServerAccess, async (req, res) => {
  try {
    const { serverId, userId } = req.params;

    const userRoles = await ServerRole.find({ userId, serverId })
      .populate('roleId');

    res.json(userRoles);
  } catch (error) {
    console.error('Ошибка получения ролей пользователя:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
