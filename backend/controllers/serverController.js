const serverService = require('../services/serverService');
const channelService = require('../services/channelService');
const asyncHandler = require('../utils/asyncHandler');

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
  res.status(201).json(channel);
});

exports.updateChannel = asyncHandler(async (req, res) => {
  const { serverId, channelId } = req.params;
  const channel = await channelService.updateChannel(serverId, channelId, req.body);
  res.json(channel);
});

exports.deleteChannel = asyncHandler(async (req, res) => {
  const { serverId, channelId } = req.params;
  const result = await channelService.deleteChannel(serverId, channelId);
  res.json(result);
});

