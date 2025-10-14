const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken } = require('../middleware/auth');

router.get('/blocks', authenticateToken, userController.getBlockedUsers);
router.get('/blocks/status/:userId', authenticateToken, userController.getBlockStatus);
router.post('/blocks/:userId', authenticateToken, userController.blockUser);
router.delete('/blocks/:userId', authenticateToken, userController.unblockUser);

module.exports = router;
