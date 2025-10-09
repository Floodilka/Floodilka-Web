const Server = require('../models/Server');
const Channel = require('../models/Channel');
const Role = require('../models/Role');
const ServerRole = require('../models/ServerRole');
const Invite = require('../models/Invite');
const User = require('../models/User');
const { NotFoundError, ForbiddenError, ValidationError } = require('../utils/errors');
const crypto = require('crypto');

class ServerService {
  async getUserServers(userId) {
    const servers = await Server.find({
      $or: [
        { ownerId: userId },
        { members: userId }
      ]
    }).sort({ createdAt: 1 });

    // Добавляем информацию о правах пользователя для каждого сервера
    const serversWithPermissions = await Promise.all(servers.map(async (server) => {
      const isOwner = server.ownerId.toString() === userId;
      
      let canManageChannels = isOwner;
      
      if (!isOwner) {
        const userRoles = await ServerRole.find({
          userId: userId,
          serverId: server._id
        }).populate('roleId');
        
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

    return serversWithPermissions;
  }

  async createServer(userId, serverData) {
    const { name, icon } = serverData;

    if (!name || name.trim() === '') {
      throw new ValidationError('Название сервера обязательно');
    }

    // Создаем сервер
    const server = new Server({
      name: name.trim(),
      icon: icon || null,
      ownerId: userId,
      members: [userId]
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
      position: 1000,
      createdBy: userId
    });

    await adminRole.save();

    // Назначаем роль Administrator создателю сервера
    const serverRole = new ServerRole({
      userId: userId,
      serverId: server._id,
      roleId: adminRole._id,
      assignedBy: userId
    });

    await serverRole.save();

    // Создаем дефолтные каналы
    const textChannel = new Channel({
      name: 'общий',
      type: 'text',
      serverId: server._id,
      createdBy: userId
    });

    const voiceChannel = new Channel({
      name: 'Голосовой',
      type: 'voice',
      serverId: server._id,
      createdBy: userId
    });

    await Promise.all([textChannel.save(), voiceChannel.save()]);

    return server;
  }

  async getServerById(serverId) {
    const server = await Server.findById(serverId);
    if (!server) {
      throw new NotFoundError('Сервер не найден');
    }
    return server;
  }

  async verifyServerAccess(serverId, userId) {
    const server = await this.getServerById(serverId);
    
    if (!server.members.includes(userId) && server.ownerId.toString() !== userId) {
      throw new ForbiddenError('Нет доступа к этому серверу');
    }

    return server;
  }

  async getServerMembers(serverId, userId) {
    const server = await this.verifyServerAccess(serverId, userId);

    // Получить всех участников (включая владельца)
    const memberIds = [...new Set([server.ownerId, ...server.members])];
    const members = await User.find({ _id: { $in: memberIds } })
      .select('-password -email')
      .sort({ username: 1 });

    return members.map(member => ({
      id: member._id,
      username: member.username,
      displayName: member.displayName,
      avatar: member.avatar,
      badge: member.badge,
      badgeTooltip: member.badgeTooltip,
      status: member.status
    }));
  }

  async createInvite(serverId, userId, inviteData) {
    const { maxUses, expiresIn } = inviteData;

    await this.verifyServerAccess(serverId, userId);

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
      createdBy: userId,
      maxUses: maxUses || null,
      expiresAt
    });

    await invite.save();

    return {
      code: invite.code,
      expiresAt: invite.expiresAt,
      maxUses: invite.maxUses
    };
  }

  async getServerInvites(serverId, userId) {
    await this.verifyServerAccess(serverId, userId);
    
    const invites = await Invite.find({ serverId }).populate('createdBy', 'username');
    return invites;
  }

  async joinServerByInvite(code, userId) {
    // Найти инвайт
    const invite = await Invite.findOne({ code }).populate('serverId');
    if (!invite) {
      throw new NotFoundError('Приглашение не найдено');
    }

    // Проверить валидность
    if (!invite.isValid()) {
      throw new ValidationError('Приглашение истекло или недействительно');
    }

    const server = await Server.findById(invite.serverId);
    if (!server) {
      throw new NotFoundError('Сервер не найден');
    }

    // Проверить, не является ли пользователь уже членом
    if (server.members.includes(userId)) {
      return { message: 'Вы уже являетесь членом этого сервера', server };
    }

    // Добавить пользователя к серверу
    server.members.push(userId);
    await server.save();

    // Увеличить счетчик использований
    invite.uses += 1;
    await invite.save();

    return { message: 'Успешно присоединились к серверу', server };
  }
}

module.exports = new ServerService();

