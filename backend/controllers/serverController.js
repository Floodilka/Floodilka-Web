const serverService = require('../services/serverService');
const channelService = require('../services/channelService');
const asyncHandler = require('../utils/asyncHandler');
const { SOCKET_EVENTS } = require('../constants/events');

exports.getUserServers = asyncHandler(async (req, res) => {
  const servers = await serverService.getUserServers(req.user.id);
  res.json(servers);
});

exports.createServer = asyncHandler(async (req, res) => {
  const server = await serverService.createServer(req.user.id, req.body);
  res.status(201).json(server);
});

exports.getServerChannels = asyncHandler(async (req, res) => {
  const { serverId } = req.params;
  await serverService.verifyServerAccess(serverId, req.user.id);

  const channels = await channelService.getServerChannels(serverId);
  res.json(channels);
});

exports.getServerMembers = asyncHandler(async (req, res) => {
  const { serverId } = req.params;
  const members = await serverService.getServerMembers(serverId, req.user.id);
  res.json(members);
});

exports.createInvite = asyncHandler(async (req, res) => {
  const { serverId } = req.params;
  const invite = await serverService.createInvite(serverId, req.user.id, req.body);
  res.status(201).json(invite);
});

exports.getServerInvites = asyncHandler(async (req, res) => {
  const { serverId } = req.params;
  const invites = await serverService.getServerInvites(serverId, req.user.id);
  res.json(invites);
});

exports.joinServerByInvite = asyncHandler(async (req, res) => {
  const { code } = req.params;
  const result = await serverService.joinServerByInvite(code, req.user.id);
  res.json(result);
});

exports.createChannel = asyncHandler(async (req, res) => {
  const { serverId } = req.params;
  const channel = await channelService.createChannel(serverId, req.user.id, req.body);

  // Отправляем WebSocket событие всем участникам сервера
  const io = req.app.get('io');
  if (io) {
    io.to(`server:${serverId}`).emit(SOCKET_EVENTS.CHANNEL_CREATED, {
      serverId,
      channel
    });
  }

  res.status(201).json(channel);
});

exports.updateChannel = asyncHandler(async (req, res) => {
  const { serverId, channelId } = req.params;
  const channel = await channelService.updateChannel(serverId, channelId, req.body);

  // Отправляем WebSocket событие всем участникам сервера
  const io = req.app.get('io');
  if (io) {
    io.to(`server:${serverId}`).emit(SOCKET_EVENTS.CHANNEL_UPDATED, {
      serverId,
      channel
    });
  }

  res.json(channel);
});

exports.deleteChannel = asyncHandler(async (req, res) => {
  const { serverId, channelId } = req.params;
  const result = await channelService.deleteChannel(serverId, channelId);

  // Отправляем WebSocket событие всем участникам сервера
  const io = req.app.get('io');
  if (io) {
    io.to(`server:${serverId}`).emit(SOCKET_EVENTS.CHANNEL_DELETED, {
      serverId,
      channelId
    });
  }

  res.json(result);
});

exports.getBannedMembers = asyncHandler(async (req, res) => {
  const { serverId } = req.params;
  const bans = await serverService.getBannedMembers(serverId, req.user.id);
  res.json(bans);
});

exports.banMember = asyncHandler(async (req, res) => {
  const { serverId } = req.params;
  const { userId, reason } = req.body;
  const result = await serverService.banMember(serverId, req.user.id, userId, reason);

  // Отправляем WebSocket событие забаненному пользователю
  const io = req.app.get('io');
  if (io) {
    // Отправляем событие в комнату сервера, забаненный пользователь получит его на клиенте
    io.to(`server:${serverId}`).emit(SOCKET_EVENTS.SERVER_MEMBER_BANNED, {
      serverId,
      userId,
      reason: reason || null
    });
  }

  res.status(201).json(result);
});

exports.unbanMember = asyncHandler(async (req, res) => {
  const { serverId, userId } = req.params;
  const result = await serverService.unbanMember(serverId, req.user.id, userId);
  res.json(result);
});
