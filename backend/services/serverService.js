const Server = require('../models/Server');
const Channel = require('../models/Channel');
const Role = require('../models/Role');
const ServerRole = require('../models/ServerRole');
const Invite = require('../models/Invite');
const User = require('../models/User');
const { NotFoundError, ForbiddenError, ValidationError } = require('../utils/errors');
const crypto = require('crypto');
const cache = require('../utils/cache');

const MEMBER_LIST_CACHE_TTL = 15_000;

const memberListCacheKey = (serverId) => `server:${serverId}:members:list`;
const serverMembersCacheKey = (serverId) => `server:${serverId}:members`;

const invalidateServerMemberCaches = (serverId) => {
  cache.del(memberListCacheKey(serverId));
  cache.del(serverMembersCacheKey(serverId));
};

class ServerService {
  async getUserServers(userId) {
    const normalizedUserId = userId.toString();

    const servers = await Server.find({
      $or: [
        { ownerId: userId },
        { members: userId }
      ]
    })
      .select('name icon ownerId members createdAt')
      .sort({ createdAt: 1 })
      .lean();

    if (servers.length === 0) {
      return [];
    }

    const serverIds = servers.map(server => server._id);

    const roles = await ServerRole.find({
      userId: normalizedUserId,
      serverId: { $in: serverIds }
    })
      .populate('roleId', 'permissions')
      .lean();

    const permissionsByServer = new Map();

    roles.forEach(role => {
      if (!role.roleId) return;

      const canManage = Boolean(
        role.roleId.permissions?.manageChannels ||
        role.roleId.permissions?.manageServer
      );

      if (!permissionsByServer.has(role.serverId.toString())) {
        permissionsByServer.set(role.serverId.toString(), canManage);
      } else {
        permissionsByServer.set(
          role.serverId.toString(),
          permissionsByServer.get(role.serverId.toString()) || canManage
        );
      }
    });

    return servers.map(server => {
      const serverId = server._id.toString();
      const isOwner = server.ownerId?.toString() === normalizedUserId;
      const canManageChannels = isOwner || permissionsByServer.get(serverId) || false;

      return {
        ...server,
        id: serverId,
        ownerId: server.ownerId?.toString(),
        members: (server.members || []).map(memberId => memberId.toString()),
        isOwner,
        canManageChannels
      };
    });
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
    invalidateServerMemberCaches(server._id.toString());

    // Создаем роль Administrator
    const adminRole = new Role({
      name: 'Administrator',
      serverId: server._id,
      permissions: {
        manageServer: true,
        manageChannels: true,
        manageRoles: true,
        manageMembers: true,
        manageMessages: true,
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

    const members = server.members || [];
    const isMember = members.some(memberId => memberId.toString() === userId.toString());
    const isOwner = server.ownerId.toString() === userId.toString();

    if (!isMember && !isOwner) {
      throw new ForbiddenError('Нет доступа к этому серверу');
    }

    return server;
  }

  async getServerMembers(serverId, userId) {
    const server = await this.verifyServerAccess(serverId, userId);

    // Получить всех участников (включая владельца)
    const memberIdSet = new Set();
    if (server.ownerId) {
      memberIdSet.add(server.ownerId.toString());
    }
    (server.members || []).forEach(member => {
      if (member) {
        memberIdSet.add(member.toString());
      }
    });
    const memberIds = Array.from(memberIdSet);

    const cacheKey = memberListCacheKey(serverId);
    const cachedMembers = cache.get(cacheKey);
    if (cachedMembers) {
      return cachedMembers;
    }

    const members = await User.find({ _id: { $in: memberIds } })
      .select('-password -email')
      .sort({ username: 1 })
      .lean();

    const normalizedMembers = members.map(member => {
      const memberId = member._id.toString();
      return {
        id: memberId,
        username: member.username,
        displayName: member.displayName,
        avatar: member.avatar,
        badge: member.badge,
        badgeTooltip: member.badgeTooltip,
        status: member.status
      };
    });

    cache.set(cacheKey, normalizedMembers, MEMBER_LIST_CACHE_TTL);

    return normalizedMembers;
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
    const alreadyMember = server.ownerId?.toString() === userId.toString() ||
      (server.members || []).some(memberId => memberId.toString() === userId.toString());

    if (alreadyMember) {
      return { message: 'Вы уже являетесь членом этого сервера', server };
    }

    // Добавить пользователя к серверу
    await Server.updateOne({ _id: server._id }, { $addToSet: { members: userId } });
    invalidateServerMemberCaches(server._id.toString());
    server.members = [...new Set([...(server.members || []).map(id => id.toString()), userId.toString()])];

    // Увеличить счетчик использований
    invite.uses += 1;
    await invite.save();

    return { message: 'Успешно присоединились к серверу', server };
  }
}

module.exports = new ServerService();
