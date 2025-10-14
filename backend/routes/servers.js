const express = require('express');
const router = express.Router();
const serverController = require('../controllers/serverController');
const { authenticateToken } = require('../middleware/auth');
const { canManageChannels, hasServerAccess, canBanMembers } = require('../middleware/permissions');

// Серверы
router.get('/', authenticateToken, serverController.getUserServers);
router.post('/', authenticateToken, serverController.createServer);

// Каналы сервера
router.get('/:serverId/channels', authenticateToken, hasServerAccess, serverController.getServerChannels);
router.post('/:serverId/channels', authenticateToken, canManageChannels, serverController.createChannel);
router.put('/:serverId/channels/:channelId', authenticateToken, canManageChannels, serverController.updateChannel);
router.delete('/:serverId/channels/:channelId', authenticateToken, canManageChannels, serverController.deleteChannel);

// Участники сервера
router.get('/:serverId/members', authenticateToken, serverController.getServerMembers);

// Баны сервера
router.get('/:serverId/bans', authenticateToken, canBanMembers, serverController.getBannedMembers);
router.post('/:serverId/bans', authenticateToken, canBanMembers, serverController.banMember);
router.delete('/:serverId/bans/:userId', authenticateToken, canBanMembers, serverController.unbanMember);

// Инвайты
router.post('/:serverId/invites', authenticateToken, serverController.createInvite);
router.get('/:serverId/invites', authenticateToken, serverController.getServerInvites);
router.post('/join/:code', authenticateToken, serverController.joinServerByInvite);

module.exports = router;
