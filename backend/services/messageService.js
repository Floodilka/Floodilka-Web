const Message = require('../models/Message');
const User = require('../models/User');
const Server = require('../models/Server');
const Channel = require('../models/Channel');
const { NotFoundError, ValidationError } = require('../utils/errors');
const { validateMessageContent, canEditMessage } = require('../validators/messageValidator');
const { MESSAGE_EDIT_TIME_LIMIT } = require('../constants');

class MessageService {
  /**
   * Парсит упоминания из текста сообщения
   * @param {string} content - Текст сообщения
   * @param {string} channelId - ID канала
   * @returns {Promise<Array>} - Массив упоминаний
   */
  async parseMentions(content, channelId) {
    if (!content) return [];

    const mentions = [];
    const mentionRegex = /@(\w+)/g;
    let match;

    // Получаем канал и сервер для доступа к списку участников
    const channel = await Channel.findById(channelId);
    if (!channel || !channel.serverId) return mentions;

    const server = await Server.findById(channel.serverId);
    if (!server) return mentions;

    // Проверяем упоминание @everyone
    if (content.includes('@everyone')) {
      mentions.push({
        username: 'everyone',
        type: 'everyone',
        userId: null
      });
    }

    // Получаем всех участников сервера
    const memberIds = [...new Set([server.ownerId, ...server.members])];

    // Находим все упоминания пользователей
    while ((match = mentionRegex.exec(content)) !== null) {
      const username = match[1];

      // Пропускаем @everyone (уже обработали выше)
      if (username === 'everyone') continue;

      // Ищем пользователя среди участников сервера
      const user = await User.findOne({
        _id: { $in: memberIds },
        username: { $regex: new RegExp(`^${username}$`, 'i') }
      });

      if (user && !mentions.find(m => m.userId && m.userId.toString() === user._id.toString())) {
        mentions.push({
          userId: user._id,
          username: user.username,
          type: 'user'
        });
      }
    }

    return mentions;
  }
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
    const {
      channelId,
      userId,
      username,
      displayName,
      avatar,
      badge,
      badgeTooltip,
      content,
      attachments,
      replyToMessageId
    } = messageData;

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

    // Парсим упоминания
    const mentions = await this.parseMentions(validatedContent, channelId);

    // Формируем метаданные ответа, если есть replyToMessageId
    let replyTo = null;
    if (replyToMessageId) {
      const parentMessage = await Message.findById(replyToMessageId);
      if (parentMessage && parentMessage.channelId === channelId) {
        replyTo = {
          messageId: parentMessage._id,
          channelId: parentMessage.channelId,
          username: parentMessage.username,
          displayName: parentMessage.displayName,
          content: parentMessage.content || '',
          hasAttachments: Array.isArray(parentMessage.attachments) && parentMessage.attachments.length > 0,
          attachmentPreview: parentMessage.attachments && parentMessage.attachments.length > 0
            ? {
                path: parentMessage.attachments[0].path,
                mimetype: parentMessage.attachments[0].mimetype,
                originalName: parentMessage.attachments[0].originalName
              }
            : null,
          isSystem: !!parentMessage.isSystem
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
      replyTo,
      attachments: attachments || [],
      mentions: mentions
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
