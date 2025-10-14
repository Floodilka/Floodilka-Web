const DirectMessage = require('../models/DirectMessage');
const User = require('../models/User');
const mongoose = require('mongoose');
const { ValidationError, NotFoundError, ForbiddenError } = require('../utils/errors');
const { validateMessageContent } = require('../validators/messageValidator');

class DirectMessageService {
  async sendMessage(senderId, receiverId, content, attachments = [], replyToMessageId = null) {
    const hasAttachments = attachments && attachments.length > 0;
    const validatedContent = validateMessageContent(content, hasAttachments);

    if (receiverId === senderId) {
      throw new ValidationError('Нельзя отправить сообщение самому себе');
    }

    const [sender, receiver] = await Promise.all([
      User.findById(senderId).select('blockedUsers'),
      User.findById(receiverId).select('blockedUsers')
    ]);

    if (!sender || !receiver) {
      throw new NotFoundError('Пользователь не найден');
    }

    const senderHasBlocked = (sender.blockedUsers || []).some(entry =>
      entry.userId.toString() === receiver._id.toString()
    );
    if (senderHasBlocked) {
      throw new ForbiddenError('Вы заблокировали этого пользователя. Разблокируйте его, чтобы отправлять сообщения.');
    }

    const receiverHasBlocked = (receiver.blockedUsers || []).some(entry =>
      entry.userId.toString() === sender._id.toString()
    );
    if (receiverHasBlocked) {
      throw new ForbiddenError('Пользователь заблокировал вас и не принимает сообщения.');
    }

    let replyTo = null;
    if (replyToMessageId) {
      const parentMessage = await DirectMessage.findById(replyToMessageId).populate('sender', 'username displayName');
      if (parentMessage) {
        const senderIdStr = senderId.toString();
        const receiverIdStr = receiverId.toString();
        const parentSenderId = parentMessage.sender?._id?.toString() || parentMessage.sender.toString();
        const parentReceiverId = parentMessage.receiver?._id?.toString() || parentMessage.receiver.toString();

        const sameConversation =
          (parentSenderId === senderIdStr && parentReceiverId === receiverIdStr) ||
          (parentSenderId === receiverIdStr && parentReceiverId === senderIdStr);

        if (sameConversation) {
          replyTo = {
            messageId: parentMessage._id,
            username: parentMessage.sender.username,
            displayName: parentMessage.sender.displayName,
            content: parentMessage.content || '',
            hasAttachments: Array.isArray(parentMessage.attachments) && parentMessage.attachments.length > 0,
            attachmentPreview: parentMessage.attachments && parentMessage.attachments.length > 0
              ? {
                  path: parentMessage.attachments[0].path,
                  mimetype: parentMessage.attachments[0].mimetype,
                  originalName: parentMessage.attachments[0].originalName
                }
              : null
          };
        }
      }
    }

    const directMessage = new DirectMessage({
      sender: senderId,
      receiver: receiverId,
      content: validatedContent,
      attachments: attachments || [],
      replyTo
    });

    await directMessage.save();

    // Популируем данные отправителя и получателя
    await directMessage.populate([
      { path: 'sender', select: 'username displayName avatar badge badgeTooltip' },
      { path: 'receiver', select: 'username displayName avatar badge badgeTooltip' }
    ]);

    return directMessage.toJSON();
  }

  async getConversation(currentUserId, targetUserId, page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    const currentUserObjectId = new mongoose.Types.ObjectId(currentUserId);
    const targetUserObjectId = new mongoose.Types.ObjectId(targetUserId);

    const messagesDocs = await DirectMessage.find({
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

    return messagesDocs.reverse().map(msg => msg.toJSON());
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
            attachments: '$lastMessage.attachments',
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

    if (conversations.length === 0) {
      return conversations;
    }

    const targetIdStrings = Array.from(new Set(
      conversations
        .map(conv => conv.user?._id)
        .filter(Boolean)
        .map(id => id.toString())
    ));

    const targetObjectIds = targetIdStrings.map(id => new mongoose.Types.ObjectId(id));

    const [currentUser, targetUsers] = await Promise.all([
      User.findById(userId).select('blockedUsers').lean(),
      targetObjectIds.length
        ? User.find({ _id: { $in: targetObjectIds } }).select('blockedUsers').lean()
        : Promise.resolve([])
    ]);

    if (!currentUser) {
      throw new NotFoundError('Пользователь не найден');
    }

    const blockedByMeSet = new Set(
      (currentUser?.blockedUsers || []).map(entry => entry.userId.toString())
    );

    const blockedMeSet = new Set();
    targetUsers.forEach(target => {
      (target.blockedUsers || []).forEach(entry => {
        if (entry.userId.toString() === userId.toString()) {
          blockedMeSet.add(target._id.toString());
        }
      });
    });

    return conversations.map(conv => {
      const targetId = conv.user?._id?.toString();
      if (!targetId) {
        return {
          ...conv,
          blockStatus: {
            isBlockedByMe: false,
            hasBlockedMe: false
          }
        };
      }

      return {
        ...conv,
        blockStatus: {
          isBlockedByMe: blockedByMeSet.has(targetId),
          hasBlockedMe: blockedMeSet.has(targetId)
        }
      };
    });
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
