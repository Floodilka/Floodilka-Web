const mongoose = require('mongoose');
const User = require('../models/User');
const FriendRequest = require('../models/FriendRequest');
const { ValidationError, NotFoundError } = require('../utils/errors');

const USER_PUBLIC_FIELDS = 'username displayName avatar badge badgeTooltip status';

class UserService {
  async blockUser(requesterId, targetUserId, reason = '') {
    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      throw new ValidationError('Некорректный идентификатор пользователя');
    }

    if (requesterId.toString() === targetUserId.toString()) {
      throw new ValidationError('Нельзя заблокировать самого себя');
    }

    const [requester, target] = await Promise.all([
      User.findById(requesterId).select('blockedUsers friends'),
      User.findById(targetUserId).select(USER_PUBLIC_FIELDS)
    ]);

    if (!requester || !target) {
      throw new NotFoundError('Пользователь не найден');
    }

    const normalizedReason = typeof reason === 'string' ? reason.trim() : '';
    const sanitizedReason = normalizedReason.slice(0, 200);

    const blockEntry = {
      userId: target._id,
      blockedAt: new Date()
    };

    if (sanitizedReason) {
      blockEntry.reason = sanitizedReason;
    }

    // Разделяем операции для избежания конфликта MongoDB
    await User.updateOne(
      { _id: requesterId },
      {
        $pull: {
          friends: target._id,
          blockedUsers: { userId: target._id }
        }
      }
    );

    await User.updateOne(
      { _id: requesterId },
      {
        $push: { blockedUsers: blockEntry }
      }
    );

    await Promise.all([
      User.updateOne(
        { _id: target._id },
        { $pull: { friends: requesterId } }
      ),
      FriendRequest.deleteMany({
        $or: [
          { from: requesterId, to: target._id },
          { from: target._id, to: requesterId }
        ]
      })
    ]);

    return {
      success: true,
      user: {
        id: target._id.toString(),
        username: target.username,
        displayName: target.displayName,
        avatar: target.avatar,
        badge: target.badge,
        badgeTooltip: target.badgeTooltip,
        status: target.status
      },
      blockedAt: blockEntry.blockedAt,
      reason: blockEntry.reason || null
    };
  }

  async unblockUser(requesterId, targetUserId) {
    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      throw new ValidationError('Некорректный идентификатор пользователя');
    }

    await User.updateOne(
      { _id: requesterId },
      { $pull: { blockedUsers: { userId: targetUserId } } }
    );

    return { success: true };
  }

  async getBlockedUsers(userId) {
    const user = await User.findById(userId)
      .populate('blockedUsers.userId', USER_PUBLIC_FIELDS)
      .lean();

    if (!user) {
      throw new NotFoundError('Пользователь не найден');
    }

    return (user.blockedUsers || [])
      .filter(entry => entry && entry.userId)
      .map(entry => ({
        id: entry.userId._id.toString(),
        username: entry.userId.username,
        displayName: entry.userId.displayName,
        avatar: entry.userId.avatar,
        badge: entry.userId.badge,
        badgeTooltip: entry.userId.badgeTooltip,
        status: entry.userId.status,
        blockedAt: entry.blockedAt,
        reason: entry.reason || null
      }));
  }

  async getBlockStatus(requesterId, targetUserId) {
    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      throw new ValidationError('Некорректный идентификатор пользователя');
    }

    const [requester, target] = await Promise.all([
      User.findById(requesterId).select('blockedUsers'),
      User.findById(targetUserId).select('blockedUsers').lean()
    ]);

    if (!requester || !target) {
      throw new NotFoundError('Пользователь не найден');
    }

    const myBlockEntry = (requester.blockedUsers || []).find(entry =>
      entry.userId.toString() === targetUserId.toString()
    );
    const otherBlockEntry = (target.blockedUsers || []).find(entry =>
      entry.userId.toString() === requesterId.toString()
    );

    return {
      isBlockedByMe: Boolean(myBlockEntry),
      hasBlockedMe: Boolean(otherBlockEntry),
      blockedAt: myBlockEntry?.blockedAt || null,
      reason: myBlockEntry?.reason || null,
      blockedByOtherAt: otherBlockEntry?.blockedAt || null
    };
  }
}

module.exports = new UserService();
