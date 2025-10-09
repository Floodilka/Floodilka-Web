const DirectMessage = require('../models/DirectMessage');
const mongoose = require('mongoose');
const { ValidationError, NotFoundError } = require('../utils/errors');
const { validateMessageContent } = require('../validators/messageValidator');

class DirectMessageService {
  async sendMessage(senderId, receiverId, content) {
    const validatedContent = validateMessageContent(content);

    if (receiverId === senderId) {
      throw new ValidationError('Нельзя отправить сообщение самому себе');
    }

    const directMessage = new DirectMessage({
      sender: senderId,
      receiver: receiverId,
      content: validatedContent
    });

    await directMessage.save();

    // Популируем данные отправителя и получателя
    await directMessage.populate([
      { path: 'sender', select: 'username displayName avatar badge badgeTooltip' },
      { path: 'receiver', select: 'username displayName avatar badge badgeTooltip' }
    ]);

    return directMessage;
  }

  async getConversation(currentUserId, targetUserId, page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    const currentUserObjectId = new mongoose.Types.ObjectId(currentUserId);
    const targetUserObjectId = new mongoose.Types.ObjectId(targetUserId);

    const messages = await DirectMessage.find({
      $or: [
        { sender: currentUserObjectId, receiver: targetUserObjectId },
        { sender: targetUserObjectId, receiver: currentUserObjectId }
      ],
      deleted: false
    })
    .populate('sender', 'username displayName avatar badge badgeTooltip')
    .populate('receiver', 'username displayName avatar badge badgeTooltip')
    .sort({ timestamp: -1 })
    .limit(parseInt(limit))
    .skip(skip);

    // Отмечаем сообщения как прочитанные
    await DirectMessage.updateMany(
      { sender: targetUserId, receiver: currentUserId, read: false },
      { read: true }
    );

    return messages.reverse();
  }

  async getConversations(userId) {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const conversations = await DirectMessage.aggregate([
      {
        $match: {
          $or: [
            { sender: userObjectId },
            { receiver: userObjectId }
          ],
          deleted: false
        }
      },
      {
        $sort: { timestamp: -1 }
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ['$sender', userObjectId] },
              '$receiver',
              '$sender'
            ]
          },
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$receiver', userObjectId] }, { $eq: ['$read', false] }] },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      {
        $lookup: {
          from: 'users',
          localField: 'lastMessage.sender',
          foreignField: '_id',
          as: 'lastMessage.senderData'
        }
      },
      {
        $unwind: '$lastMessage.senderData'
      },
      {
        $project: {
          user: {
            _id: '$user._id',
            username: '$user.username',
            displayName: '$user.displayName',
            avatar: '$user.avatar',
            badge: '$user.badge',
            badgeTooltip: '$user.badgeTooltip'
          },
          lastMessage: {
            _id: '$lastMessage._id',
            content: '$lastMessage.content',
            timestamp: '$lastMessage.timestamp',
            sender: {
              _id: '$lastMessage.senderData._id',
              username: '$lastMessage.senderData.username',
              displayName: '$lastMessage.senderData.displayName',
              avatar: '$lastMessage.senderData.avatar'
            }
          },
          unreadCount: 1
        }
      },
      {
        $sort: { 'lastMessage.timestamp': -1 }
      }
    ]);

    return conversations;
  }

  async markAsRead(currentUserId, senderId) {
    await DirectMessage.updateMany(
      { sender: senderId, receiver: currentUserId, read: false },
      { read: true }
    );

    return { success: true };
  }

  async editMessage(messageId, senderId, content) {
    const validatedContent = validateMessageContent(content);

    const message = await DirectMessage.findOneAndUpdate(
      { _id: messageId, sender: senderId, deleted: false },
      {
        content: validatedContent,
        edited: true,
        editedAt: new Date()
      },
      { new: true }
    ).populate([
      { path: 'sender', select: 'username displayName avatar badge badgeTooltip' },
      { path: 'receiver', select: 'username displayName avatar badge badgeTooltip' }
    ]);

    if (!message) {
      throw new NotFoundError('Сообщение не найдено');
    }

    return message;
  }

  async deleteMessage(messageId, senderId) {
    const message = await DirectMessage.findOneAndUpdate(
      { _id: messageId, sender: senderId, deleted: false },
      {
        deleted: true,
        deletedAt: new Date()
      },
      { new: true }
    );

    if (!message) {
      throw new NotFoundError('Сообщение не найдено');
    }

    return { success: true, messageId };
  }
}

module.exports = new DirectMessageService();

