const asyncHandler = require('../utils/asyncHandler');
const userService = require('../services/userService');

exports.getBlockedUsers = asyncHandler(async (req, res) => {
  const blockedUsers = await userService.getBlockedUsers(req.user.id);
  res.json(blockedUsers);
});

exports.getBlockStatus = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const status = await userService.getBlockStatus(req.user.id, userId);
  res.json(status);
});

exports.blockUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { reason } = req.body || {};

  const result = await userService.blockUser(req.user.id, userId, reason);
  res.status(201).json(result);
});

exports.unblockUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const result = await userService.unblockUser(req.user.id, userId);
  res.json(result);
});
