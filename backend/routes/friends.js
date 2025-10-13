const express = require('express');
const router = express.Router();
const friendController = require('../controllers/friendController');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, friendController.getFriends);
router.post('/request', authenticateToken, friendController.sendRequest);
router.post('/respond', authenticateToken, friendController.respondToRequest);
router.delete('/:friendId', authenticateToken, friendController.removeFriend);

module.exports = router;
