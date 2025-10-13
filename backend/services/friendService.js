const mongoose = require('mongoose');
const User = require('../models/User');
const FriendRequest = require('../models/FriendRequest');
const { ValidationError, NotFoundError, ForbiddenError } = require('../utils/errors');

const USER_SELECT_FIELDS = 'username displayName avatar badge badgeTooltip status';

const toUserDto = (userDoc) => {
  if (!userDoc) return null;
  const user = userDoc.toObject ? userDoc.toObject() : userDoc;
  return {
    _id: user._id,
    username: user.username,
    displayName: user.displayName,
    avatar: user.avatar,
    badge: user.badge,
    badgeTooltip: user.badgeTooltip,
    status: user.status || 'offline'
  };
};

class FriendService {
  async getOverview(userId) {
    const user = await User.findById(userId).populate('friends', USER_SELECT_FIELDS);
    if (!user) {
      throw new NotFoundError('Пользователь не найден');
    }

    const [incoming, outgoing] = await Promise.all([
      FriendRequest.find({ to: userId, status: 'pending' })
        .populate('from', USER_SELECT_FIELDS)
        .sort({ createdAt: -1 }),
      FriendRequest.find({ from: userId, status: 'pending' })
        .populate('to', USER_SELECT_FIELDS)
        .sort({ createdAt: -1 })
    ]);

    return {
      friends: user.friends.map(toUserDto),
      incomingRequests: incoming.map(req => ({
        _id: req._id,
        status: req.status,
        createdAt: req.createdAt,
        from: toUserDto(req.from)
      })),
      outgoingRequests: outgoing.map(req => ({
        _id: req._id,
        status: req.status,
        createdAt: req.createdAt,
        to: toUserDto(req.to)
      }))
    };
  }

  async sendRequest(userId, username) {
    const normalizedUsername = typeof username === 'string' ? username.trim() : '';
    if (!normalizedUsername) {
      throw new ValidationError('Введите имя пользователя');
    }

    const targetUser = await User.findOne({
      username: { $regex: new RegExp(`^${this.escapeRegex(normalizedUsername)}$`, 'i') }
    }).select(USER_SELECT_FIELDS);

    if (!targetUser) {
      throw new NotFoundError('Пользователь не найден');
    }

    if (targetUser._id.equals(userId)) {
      throw new ValidationError('Нельзя добавить в друзья самого себя');
    }

    const currentUser = await User.findById(userId).select(`friends ${USER_SELECT_FIELDS}`);
    if (!currentUser) {
      throw new NotFoundError('Пользователь не найден');
    }

    if (currentUser.friends.some(friendId => friendId.equals(targetUser._id))) {
      throw new ValidationError('Пользователь уже у вас в друзьях');
    }

    // Проверяем, не существует ли встречная заявка — принимаем её автоматически
    const existingReverseRequest = await FriendRequest.findOne({
      from: targetUser._id,
      to: userId
    });

    if (existingReverseRequest) {
      if (existingReverseRequest.status === 'pending') {
        existingReverseRequest.status = 'accepted';
        await existingReverseRequest.save();

        await this.addFriendship(userId, targetUser._id);

        const populatedRequest = await existingReverseRequest.populate([
          { path: 'from', select: USER_SELECT_FIELDS },
          { path: 'to', select: USER_SELECT_FIELDS }
        ]);

        return {
          type: 'accepted',
          request: populatedRequest,
          friend: toUserDto(targetUser),
          self: toUserDto(currentUser)
        };
      }

      // Если заявка уже была принята, но пользователь не в friends (дружба была удалена),
      // удаляем старую заявку и создадим новую ниже
      if (existingReverseRequest.status === 'accepted') {
        await existingReverseRequest.deleteOne();
      }
    }

    // Проверяем исходящую заявку
    const existingRequest = await FriendRequest.findOne({
      from: userId,
      to: targetUser._id
    });

    if (existingRequest) {
      if (existingRequest.status === 'pending') {
        throw new ValidationError('Заявка уже отправлена');
      }

      // Переиспользуем старую заявку (accepted/declined/cancelled), обновляя на pending
      existingRequest.status = 'pending';
      const now = new Date();
      existingRequest.createdAt = now;
      existingRequest.updatedAt = now;
      await existingRequest.save();

      const populatedRequest = await existingRequest.populate([
        { path: 'from', select: USER_SELECT_FIELDS },
        { path: 'to', select: USER_SELECT_FIELDS }
      ]);

      return {
        type: 'request',
        request: populatedRequest
      };
    }

    const friendRequest = await FriendRequest.create({
      from: userId,
      to: targetUser._id,
      status: 'pending'
    });

    const populatedRequest = await friendRequest.populate([
      { path: 'from', select: USER_SELECT_FIELDS },
      { path: 'to', select: USER_SELECT_FIELDS }
    ]);

    return {
      type: 'request',
      request: populatedRequest
    };
  }

  async respondToRequest(userId, requestId, action) {
    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      throw new ValidationError('Некорректный идентификатор заявки');
    }

    const request = await FriendRequest.findById(requestId).populate([
      { path: 'from', select: USER_SELECT_FIELDS },
      { path: 'to', select: USER_SELECT_FIELDS }
    ]);

    if (!request) {
      throw new NotFoundError('Заявка не найдена');
    }

    switch (action) {
      case 'accept':
        if (!request.to._id.equals(userId)) {
          throw new ForbiddenError('Вы не можете принять эту заявку');
        }
        if (request.status !== 'pending') {
          throw new ValidationError('Заявка уже обработана');
        }

        request.status = 'accepted';
        await request.save();
        await this.addFriendship(request.from._id, request.to._id);

        return {
          status: 'accepted',
          request,
          friend: toUserDto(request.from),
          self: toUserDto(request.to)
        };

      case 'decline':
        if (!request.to._id.equals(userId)) {
          throw new ForbiddenError('Вы не можете отклонить эту заявку');
        }
        if (request.status !== 'pending') {
          throw new ValidationError('Заявка уже обработана');
        }

        request.status = 'declined';
        await request.save();

        return {
          status: 'declined',
          request
        };

      case 'cancel':
        if (!request.from._id.equals(userId)) {
          throw new ForbiddenError('Вы не можете отменить эту заявку');
        }
        if (request.status !== 'pending') {
          throw new ValidationError('Заявка уже обработана');
        }

        request.status = 'cancelled';
        await request.save();

        return {
          status: 'cancelled',
          request
        };

      default:
        throw new ValidationError('Некорректное действие');
    }
  }

  async removeFriend(userId, friendId) {
    if (!mongoose.Types.ObjectId.isValid(friendId)) {
      throw new ValidationError('Некорректный идентификатор пользователя');
    }

    if (friendId === userId) {
      throw new ValidationError('Некорректный идентификатор пользователя');
    }

    const [user, friend] = await Promise.all([
      User.findById(userId).select('friends'),
      User.findById(friendId).select('friends')
    ]);

    if (!user || !friend) {
      throw new NotFoundError('Пользователь не найден');
    }

    const isFriend = user.friends.some(id => id.equals(friendId));
    if (!isFriend) {
      throw new ValidationError('Пользователь не является вашим другом');
    }

    await Promise.all([
      User.updateOne({ _id: userId }, { $pull: { friends: friendId } }),
      User.updateOne({ _id: friendId }, { $pull: { friends: userId } }),
      // Удаляем или обновляем статус заявок в друзья между этими пользователями
      FriendRequest.deleteMany({
        $or: [
          { from: userId, to: friendId },
          { from: friendId, to: userId }
        ]
      })
    ]);

    return { success: true };
  }

  async addFriendship(userAId, userBId) {
    await Promise.all([
      User.updateOne({ _id: userAId }, { $addToSet: { friends: userBId } }),
      User.updateOne({ _id: userBId }, { $addToSet: { friends: userAId } })
    ]);
  }

  escapeRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

module.exports = new FriendService();
