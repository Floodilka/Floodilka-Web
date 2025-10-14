const mongoose = require('mongoose');
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
const serverBansCacheKey = (serverId) => `server:${serverId}:bans`;

const invalidateServerMemberCaches = (serverId) => {
  cache.del(memberListCacheKey(serverId));
  cache.del(serverMembersCacheKey(serverId));
  cache.del(serverBansCacheKey(serverId));
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

      const serverIdStr = role.serverId.toString();
      const rolePerms = role.roleId.permissions || {};
      const aggregated = permissionsByServer.get(serverIdStr) || {
        manageServer: false,
        manageChannels: false,
        manageMembers: false,
        manageMessages: false,
        kickMembers: false,
        banMembers: false
      };

      permissionsByServer.set(serverIdStr, {
        manageServer: aggregated.manageServer || Boolean(rolePerms.manageServer),
        manageChannels: aggregated.manageChannels || Boolean(rolePerms.manageChannels) || Boolean(rolePerms.manageServer),
        manageMembers: aggregated.manageMembers || Boolean(rolePerms.manageMembers) || Boolean(rolePerms.manageServer),
        manageMessages: aggregated.manageMessages || Boolean(rolePerms.manageMessages) || Boolean(rolePerms.manageServer),
        kickMembers: aggregated.kickMembers || Boolean(rolePerms.kickMembers) || Boolean(rolePerms.manageServer),
        banMembers: aggregated.banMembers || Boolean(rolePerms.banMembers) || Boolean(rolePerms.manageServer) || Boolean(rolePerms.manageMembers)
      });
    });

    return servers.map(server => {
      const serverId = server._id.toString();
      const isOwner = server.ownerId?.toString() === normalizedUserId;
      const aggregatedPermissions = permissionsByServer.get(serverId) || {};
      const canManageChannels = isOwner || aggregatedPermissions.manageChannels || aggregatedPermissions.manageServer;
      const canBanMembers = isOwner || aggregatedPermissions.banMembers || aggregatedPermissions.manageServer;
      const canManageMembers = isOwner || aggregatedPermissions.manageMembers || aggregatedPermissions.manageServer;

      return {
        ...server,
        id: serverId,
        ownerId: server.ownerId?.toString(),
        members: (server.members || []).map(memberId => memberId.toString()),
        isOwner,
        canManageChannels,
        canManageMembers,
        canBanMembers
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
    const isBanned = (server.bans || []).some(ban => ban.userId.toString() === userId.toString());

    if (isBanned && !isOwner) {
      throw new ForbiddenError('Вы заблокированы на этом сервере');
    }

    if (!isMember && !isOwner) {
      throw new ForbiddenError('Нет доступа к этому серверу');
    }

    return server;
  }

  async ensureBanPermission(server, userId) {
    const normalizedUserId = userId.toString();
    if (server.ownerId.toString() === normalizedUserId) {
      return true;
    }

    const roles = await ServerRole.find({
      userId: normalizedUserId,
      serverId: server._id
    }).populate('roleId', 'permissions').lean();

    const hasPermission = roles.some(role => {
      const perms = role.roleId?.permissions || {};
      return perms.manageServer || perms.manageMembers || perms.banMembers;
    });

    if (!hasPermission) {
      throw new ForbiddenError('Недостаточно прав для управления банами');
    }

    return true;
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

    const isBanned = (server.bans || []).some(ban => ban.userId.toString() === userId.toString());
    if (isBanned) {
      throw new ForbiddenError('Вы заблокированы на этом сервере');
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

  async getBannedMembers(serverId, userId) {
    const server = await this.verifyServerAccess(serverId, userId);
    await this.ensureBanPermission(server, userId);

    const cacheKey = serverBansCacheKey(serverId);
    const cached = cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const bans = server.bans || [];
    if (bans.length === 0) {
      cache.set(cacheKey, [], MEMBER_LIST_CACHE_TTL);
      return [];
    }

    const uniqueUserIds = Array.from(new Set(
      bans
        .map(ban => ban.userId)
        .filter(Boolean)
        .map(id => id.toString())
    ));

    const users = await User.find({ _id: { $in: uniqueUserIds } })
      .select('username displayName avatar badge badgeTooltip status')
      .lean();

    const usersMap = new Map(users.map(user => [user._id.toString(), user]));

    const normalized = bans
      .filter(ban => ban && ban.userId)
      .map(ban => {
        const id = ban.userId.toString();
        const userInfo = usersMap.get(id);
        return {
          id,
          reason: ban.reason || null,
          bannedAt: ban.bannedAt,
          bannedBy: ban.bannedBy ? ban.bannedBy.toString() : null,
          user: userInfo ? {
            id: userInfo._id.toString(),
            username: userInfo.username,
            displayName: userInfo.displayName,
            avatar: userInfo.avatar,
            badge: userInfo.badge,
            badgeTooltip: userInfo.badgeTooltip,
            status: userInfo.status
          } : null
        };
      });

    cache.set(cacheKey, normalized, MEMBER_LIST_CACHE_TTL);

    return normalized;
  }

  async banMember(serverId, userId, targetUserId, reason = '') {
    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      throw new ValidationError('Некорректный идентификатор пользователя');
    }

    const server = await this.getServerById(serverId);
    await this.ensureBanPermission(server, userId);

    const targetObjectId = new mongoose.Types.ObjectId(targetUserId);
    const normalizedTargetId = targetObjectId.toString();

    if (server.ownerId.toString() === normalizedTargetId) {
      throw new ValidationError('Нельзя забанить владельца сервера');
    }

    const targetUser = await User.findById(targetObjectId)
      .select('username displayName avatar badge badgeTooltip status');

    if (!targetUser) {
      throw new NotFoundError('Пользователь не найден');
    }

    const sanitizedReason = typeof reason === 'string' ? reason.trim().slice(0, 200) : '';
    const banEntry = {
      userId: targetObjectId,
      bannedBy: new mongoose.Types.ObjectId(userId),
      bannedAt: new Date()
    };

    if (sanitizedReason) {
      banEntry.reason = sanitizedReason;
    }

    // Сначала удаляем из members и старые баны
    await Server.updateOne(
      { _id: server._id },
      {
        $pull: {
          members: targetObjectId,
          bans: { userId: targetObjectId }
        }
      }
    );

    // Затем добавляем новый бан
    await Server.updateOne(
      { _id: server._id },
      {
        $push: {
          bans: banEntry
        }
      }
    );

    await ServerRole.deleteMany({
      serverId: server._id,
      userId: targetObjectId
    });

    invalidateServerMemberCaches(server._id.toString());

    return {
      success: true,
      ban: {
        userId: targetObjectId.toString(),
        reason: banEntry.reason || null,
        bannedAt: banEntry.bannedAt,
        bannedBy: banEntry.bannedBy.toString(),
        user: {
          id: targetUser._id.toString(),
          username: targetUser.username,
          displayName: targetUser.displayName,
          avatar: targetUser.avatar,
          badge: targetUser.badge,
          badgeTooltip: targetUser.badgeTooltip,
          status: targetUser.status
        }
      }
    };
  }

  async unbanMember(serverId, userId, targetUserId) {
    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      throw new ValidationError('Некорректный идентификатор пользователя');
    }

    const server = await this.getServerById(serverId);
    await this.ensureBanPermission(server, userId);

    const targetIdStr = targetUserId.toString();
    const existingBan = (server.bans || []).find(ban => ban.userId.toString() === targetIdStr);

    if (!existingBan) {
      throw new NotFoundError('Пользователь не находится в списке банов');
    }

    const targetObjectId = new mongoose.Types.ObjectId(targetUserId);

    await Server.updateOne(
      { _id: server._id },
      { $pull: { bans: { userId: targetObjectId } } }
    );

    invalidateServerMemberCaches(server._id.toString());

    return { success: true };
  }
}

module.exports = new ServerService();
