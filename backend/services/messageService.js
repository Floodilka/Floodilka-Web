const mongoose = require('mongoose');
const Message = require('../models/Message');
const User = require('../models/User');
const Server = require('../models/Server');
const Channel = require('../models/Channel');
const { NotFoundError, ValidationError } = require('../utils/errors');
const { validateMessageContent, canEditMessage } = require('../validators/messageValidator');
const { MESSAGE_EDIT_TIME_LIMIT } = require('../constants');
const cache = require('../utils/cache');
const { escapeRegex } = require('../utils/string');

const MAX_MESSAGES_LIMIT = 200;
const DEFAULT_MESSAGES_LIMIT = 100;

const normalizeMessage = (messageDoc) => {
  if (!messageDoc) {
    return null;
  }

  const message = { ...messageDoc };
  const id = message._id || message.id;
  if (id) {
    message.id = id.toString();
  }
  if (message.createdAt) {
    const createdAt = message.createdAt instanceof Date ? message.createdAt : new Date(message.createdAt);
    message.timestamp = createdAt.toISOString();
    message.createdAt = createdAt;
  }

  if (message.userId && typeof message.userId === 'object' && message.userId !== null) {
    message.username = message.userId.username || message.username;
    message.displayName = message.userId.displayName || message.displayName;
    message.avatar = message.userId.avatar || message.avatar;
    message.badge = message.userId.badge || message.badge;
    message.badgeTooltip = message.userId.badgeTooltip || message.badgeTooltip;
    message.userId = message.userId._id ? message.userId._id.toString() : message.userId.toString();
  } else if (message.userId) {
    message.userId = message.userId.toString();
  } else {
    message.userId = null;
  }

  if (message.replyTo?.messageId) {
    message.replyTo = {
      ...message.replyTo,
      messageId: message.replyTo.messageId.toString()
    };
  }

  delete message.__v;

  return message;
};

class MessageService {
  /**
   * Парсит упоминания из текста сообщения
   * @param {string} content - Текст сообщения
   * @param {string} channelId - ID канала
   * @returns {Promise<Array>} - Массив упоминаний
   */
  async parseMentions(content, channelId) {
    if (!content) return [];

    const mentionRegex = /@(\w+)/g;
    const matches = [...content.matchAll(mentionRegex)].map(match => match[1]);
    if (matches.length === 0) {
      return [];
    }

    const mentions = [];
    const normalizedMatches = matches.map(name => name.trim()).filter(Boolean);
    const uniqueNormalized = [...new Set(normalizedMatches.map(name => name.toLowerCase()))];

    if (uniqueNormalized.includes('everyone')) {
      mentions.push({
        username: 'everyone',
        type: 'everyone',
        userId: null
      });
    }

    const cachedChannel = cache.get(`channel:${channelId}`);
    let channel = cachedChannel;
    if (!channel) {
      channel = await Channel.findById(channelId).select('serverId').lean();
      if (channel) {
        cache.set(`channel:${channelId}`, channel, 60_000);
      }
    }

    if (!channel?.serverId) {
      return mentions;
    }

    const serverId = channel.serverId instanceof mongoose.Types.ObjectId
      ? channel.serverId.toString()
      : channel.serverId;

    let server = cache.get(`server:${serverId}:members`);
    if (!server) {
      server = await Server.findById(serverId).select('ownerId members').lean();
      if (server) {
        cache.set(`server:${serverId}:members`, server, 30_000);
      }
    }

    if (!server) {
      return mentions;
    }

    const memberIds = new Set();
    if (server.ownerId) {
      memberIds.add(server.ownerId.toString());
    }
    (server.members || []).forEach(memberId => {
      if (memberId) {
        memberIds.add(memberId.toString());
      }
    });

    const mentionCandidates = [...new Set(normalizedMatches
      .filter(name => name.toLowerCase() !== 'everyone'))];

    if (mentionCandidates.length === 0 || memberIds.size === 0) {
      return mentions;
    }

    const userFilters = mentionCandidates.map(name => ({
      username: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') }
    }));

    const users = await User.find({
      _id: { $in: Array.from(memberIds) },
      $or: userFilters
    }).select('username displayName avatar badge badgeTooltip').lean();

    const usersByName = new Map(
      users.map(user => [user.username.toLowerCase(), user])
    );

    normalizedMatches.forEach(username => {
      const lowered = username.toLowerCase();
      if (lowered === 'everyone') {
        return;
      }

      const user = usersByName.get(lowered);
      if (user && !mentions.find(m => m.userId && m.userId.toString() === user._id.toString())) {
        mentions.push({
          userId: user._id,
          username: user.username,
          type: 'user'
        });
      }
    });

    return mentions;
  }

  async getChannelMessages(channelId, options = {}) {
    const safeLimit = Math.min(
      Math.max(parseInt(options.limit, 10) || DEFAULT_MESSAGES_LIMIT, 1),
      MAX_MESSAGES_LIMIT
    );

    const query = { channelId };
    const createdAtQuery = {};

    if (options.before) {
      const beforeDate = new Date(options.before);
      if (!Number.isNaN(beforeDate.getTime())) {
        createdAtQuery.$lt = beforeDate;
      }
    }
    if (options.after) {
      const afterDate = new Date(options.after);
      if (!Number.isNaN(afterDate.getTime())) {
        createdAtQuery.$gt = afterDate;
      }
    }
    if (Object.keys(createdAtQuery).length > 0) {
      query.createdAt = createdAtQuery;
    }

    const messages = await Message.find(query)
      .populate('userId', 'username displayName avatar badge badgeTooltip')
      .sort({ createdAt: -1 })
      .limit(safeLimit)
      .lean();

    const normalized = messages
      .map(normalizeMessage)
      .filter(Boolean)
      .reverse();

    return normalized;
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
