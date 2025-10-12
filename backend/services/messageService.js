const Message = require('../models/Message');
const User = require('../models/User');
const { NotFoundError, ValidationError } = require('../utils/errors');
const { validateMessageContent, canEditMessage } = require('../validators/messageValidator');
const { MESSAGE_EDIT_TIME_LIMIT } = require('../constants');

class MessageService {
  async getChannelMessages(channelId, limit = 100) {
    const messages = await Message.find({ channelId })
      .populate('userId', 'username displayName avatar badge badgeTooltip')
      .sort({ createdAt: 1 })
      .limit(limit);

    // Обновляем данные пользователя в сообщениях на актуальные
    return messages.map(msg => {
      const msgObj = msg.toJSON();

      if (msgObj.userId && typeof msgObj.userId === 'object') {
        msgObj.username = msgObj.userId.username || msgObj.username;
        msgObj.displayName = msgObj.userId.displayName || msgObj.displayName;
        msgObj.avatar = msgObj.userId.avatar || msgObj.avatar;
        msgObj.badge = msgObj.userId.badge || msgObj.badge;
        msgObj.badgeTooltip = msgObj.userId.badgeTooltip || msgObj.badgeTooltip;
        msgObj.userId = msgObj.userId._id;
      }

      return msgObj;
    });
  }

  async createMessage(messageData) {
    const { channelId, userId, username, displayName, avatar, badge, badgeTooltip, content, attachments } = messageData;

    const hasAttachments = attachments && attachments.length > 0;
    const validatedContent = validateMessageContent(content, hasAttachments);

    // Если есть userId, загружаем актуальные данные пользователя
    let actualUserData = {
      username: username || 'Аноним',
      displayName: displayName || null,
      avatar: avatar || null,
      badge: badge || null,
      badgeTooltip: badgeTooltip || null
    };

    if (userId) {
      const user = await User.findById(userId).select('username displayName avatar badge badgeTooltip');
      if (user) {
        actualUserData = {
          username: user.username,
          displayName: user.displayName,
          avatar: user.avatar,
          badge: user.badge,
          badgeTooltip: user.badgeTooltip
        };
      }
    }

    const message = new Message({
      channelId,
      userId: userId || null,
      username: actualUserData.username,
      displayName: actualUserData.displayName,
      avatar: actualUserData.avatar,
      badge: actualUserData.badge,
      badgeTooltip: actualUserData.badgeTooltip,
      content: validatedContent,
      isSystem: false,
      attachments: attachments || []
    });

    await message.save();
    return message.toJSON();
  }

  async editMessage(messageId, content) {
    const validatedContent = validateMessageContent(content);

    const message = await Message.findById(messageId);
    if (!message) {
      throw new NotFoundError('Сообщение не найдено');
    }

    // Проверяем, можно ли редактировать
    if (!canEditMessage(message)) {
      throw new ValidationError(`Сообщение можно редактировать только в течение ${MESSAGE_EDIT_TIME_LIMIT} часов`);
    }

    // Обновляем сообщение
    message.content = validatedContent;
    await message.save();

    // Загружаем актуальные данные пользователя
    let updatedMessage = message.toJSON();
    if (message.userId) {
      const user = await User.findById(message.userId).select('username displayName avatar badge badgeTooltip');
      if (user) {
        updatedMessage.username = user.username;
        updatedMessage.displayName = user.displayName;
        updatedMessage.avatar = user.avatar;
        updatedMessage.badge = user.badge;
        updatedMessage.badgeTooltip = user.badgeTooltip;
        updatedMessage.userId = user._id.toString();
      }
    }

    return updatedMessage;
  }

  async deleteMessage(messageId) {
    const message = await Message.findById(messageId);
    if (!message) {
      throw new NotFoundError('Сообщение не найдено');
    }

    const channelId = message.channelId;
    await Message.findByIdAndDelete(messageId);

    return { messageId, channelId };
  }

  // Методы для личных сообщений
  async editDirectMessage(messageId, content) {
    const DirectMessage = require('../models/DirectMessage');
    const validatedContent = validateMessageContent(content);

    const message = await DirectMessage.findById(messageId);
    if (!message) {
      throw new NotFoundError('Сообщение не найдено');
    }

    // Проверяем, можно ли редактировать
    if (!canEditMessage(message)) {
      throw new ValidationError(`Сообщение можно редактировать только в течение ${MESSAGE_EDIT_TIME_LIMIT} часов`);
    }

    // Обновляем сообщение
    message.content = validatedContent;
    message.edited = true;
    await message.save();

    return message;
  }

  async deleteDirectMessage(messageId) {
    const DirectMessage = require('../models/DirectMessage');

    const message = await DirectMessage.findById(messageId);
    if (!message) {
      throw new NotFoundError('Сообщение не найдено');
    }

    const senderId = message.sender;
    const receiverId = message.receiver;
    await DirectMessage.findByIdAndDelete(messageId);

    return { messageId, senderId, receiverId };
  }
}

module.exports = new MessageService();

