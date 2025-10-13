const messageService = require('../services/messageService');
const { SOCKET_EVENTS } = require('../constants/events');
const logger = require('../utils/logger');
const Message = require('../models/Message');
const Channel = require('../models/Channel');
const Server = require('../models/Server');
const ServerRole = require('../models/ServerRole');

class ChatHandler {
  constructor(io) {
    this.io = io;
  }

  handleChannelJoin(socket) {
    socket.on(SOCKET_EVENTS.CHANNEL_JOIN, async ({ channelId, username, avatar, badge, badgeTooltip, displayName, userId }) => {
      try {
        // Покинуть предыдущий канал
        if (socket.currentChannel) {
          socket.leave(socket.currentChannel);
        }

        // Присоединиться к новому каналу
        socket.currentChannel = channelId;
        socket.currentUsername = username || `Гость${Math.floor(Math.random() * 1000)}`;
        socket.currentAvatar = avatar;
        socket.join(channelId);

        // Загрузить сообщения из БД
        const messages = await messageService.getChannelMessages(channelId);

        // Отправить текущие сообщения
        socket.emit(SOCKET_EVENTS.MESSAGES_HISTORY, messages);

        logger.debug(`Пользователь ${socket.currentUsername} присоединился к каналу ${channelId}`);
      } catch (error) {
        logger.error('Ошибка при присоединении к каналу:', error);
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Ошибка присоединения к каналу' });
      }
    });
  }

  handleDirectMessageJoin(socket) {
    socket.on('dm:join', async ({ userId, otherUserId, username, avatar, badge, badgeTooltip, displayName }) => {
      try {
        // Создаем уникальную комнату для разговора между двумя пользователями
        const room1 = `dm-${userId}-${otherUserId}`;
        const room2 = `dm-${otherUserId}-${userId}`;

        // Покидаем предыдущие комнаты DM
        const rooms = Array.from(socket.rooms);
        rooms.forEach(room => {
          if (room.startsWith('dm-')) {
            socket.leave(room);
          }
        });

        // Присоединяемся к комнатам личного сообщения
        socket.join(room1);
        socket.join(room2);

        // Сохраняем информацию о текущем DM
        socket.currentDM = otherUserId;
        socket.currentUsername = username || `Гость${Math.floor(Math.random() * 1000)}`;
        socket.currentAvatar = avatar;

        logger.debug(`Пользователь ${socket.currentUsername} присоединился к DM с ${otherUserId}`);
      } catch (error) {
        logger.error('Ошибка при присоединении к DM:', error);
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Ошибка присоединения к личному сообщению' });
      }
    });
  }

  handleDirectMessageLeave(socket) {
    socket.on('dm:leave', async () => {
      try {
        // Покидаем все комнаты DM
        const rooms = Array.from(socket.rooms);
        rooms.forEach(room => {
          if (room.startsWith('dm-')) {
            socket.leave(room);
          }
        });

        socket.currentDM = null;
        logger.debug(`Пользователь ${socket.currentUsername} покинул DM`);
      } catch (error) {
        logger.error('Ошибка при покидании DM:', error);
      }
    });
  }

  handleMessageSend(socket) {
    socket.on(SOCKET_EVENTS.MESSAGE_SEND, async ({ channelId, content, username, avatar, badge, badgeTooltip, displayName, userId, attachments, replyToMessageId }) => {
      try {
        // Проверяем, что есть хотя бы текст или файлы
        const hasContent = content && content.trim() !== '';
        const hasAttachments = attachments && attachments.length > 0;

        if (!hasContent && !hasAttachments) {
          return;
        }

        const message = await messageService.createMessage({
          channelId,
          userId,
          username,
          displayName,
          avatar,
          badge,
          badgeTooltip,
          content: content || '',
          attachments,
          replyToMessageId
        });

        // Отправить всем в канале
        this.io.to(channelId).emit(SOCKET_EVENTS.MESSAGE_NEW, message);

        logger.debug(`Сообщение от ${username} в канале ${channelId}`);
      } catch (error) {
        logger.error('Ошибка отправки сообщения:', error);
        socket.emit(SOCKET_EVENTS.ERROR, { message: error.message || 'Ошибка отправки сообщения' });
      }
    });
  }

  handleMessageEdit(socket) {
    socket.on(SOCKET_EVENTS.MESSAGE_EDIT, async ({ messageId, content, isDM = false }) => {
      try {
        if (isDM) {
          // Редактирование личного сообщения
          const message = await messageService.editDirectMessage(messageId, content);

          // Отправляем обновление участникам личного сообщения
          this.io.to(`dm-${message.sender}-${message.receiver}`).emit(SOCKET_EVENTS.MESSAGE_EDITED, {
            messageId: message._id.toString(),
            content: message.content,
            edited: message.edited
          });
          this.io.to(`dm-${message.receiver}-${message.sender}`).emit(SOCKET_EVENTS.MESSAGE_EDITED, {
            messageId: message._id.toString(),
            content: message.content,
            edited: message.edited
          });

          logger.debug(`Личное сообщение ${messageId} отредактировано`);
        } else {
          // Редактирование обычного сообщения
          const message = await messageService.editMessage(messageId, content);
          this.io.to(message.channelId).emit(SOCKET_EVENTS.MESSAGE_EDITED, message);
          logger.debug(`Сообщение ${messageId} отредактировано`);
        }
      } catch (error) {
        logger.error('Ошибка редактирования сообщения:', error);
        socket.emit(SOCKET_EVENTS.ERROR, { message: error.message || 'Ошибка редактирования сообщения' });
      }
    });
  }

  handleMessageDelete(socket) {
    socket.on(SOCKET_EVENTS.MESSAGE_DELETE, async ({ messageId, userId, isDM = false }) => {
      try {
        if (isDM) {
          // Удаление личного сообщения
          const { messageId: deletedId, senderId, receiverId } = await messageService.deleteDirectMessage(messageId);

          // Отправляем уведомление об удалении участникам личного сообщения
          this.io.to(`dm-${senderId}-${receiverId}`).emit(SOCKET_EVENTS.MESSAGE_DELETED, { messageId: deletedId });
          this.io.to(`dm-${receiverId}-${senderId}`).emit(SOCKET_EVENTS.MESSAGE_DELETED, { messageId: deletedId });

          logger.debug(`Личное сообщение ${messageId} удалено`);
          return;
        }

        // Получаем сообщение для обычных каналов
        const message = await Message.findById(messageId);
        if (!message) {
          socket.emit(SOCKET_EVENTS.ERROR, { message: 'Сообщение не найдено' });
          return;
        }

        // Проверяем права на удаление
        let canDelete = false;

        // 1. Если это свое сообщение - можно удалить
        if (message.userId && userId && message.userId.toString() === userId.toString()) {
          canDelete = true;
        }

        // 2. Если нет userId у сообщения, но username совпадает
        if (!canDelete && message.username === socket.currentUsername) {
          canDelete = true;
        }

        // 3. Проверяем права администратора/модератора
        if (!canDelete && userId) {
          // Получаем канал и сервер
          const channel = await Channel.findById(message.channelId);

          if (channel && channel.serverId) {
            const server = await Server.findById(channel.serverId);

            if (server) {
              // Проверяем, является ли пользователь владельцем сервера
              if (server.ownerId.toString() === userId.toString()) {
                canDelete = true;
              } else {
                // Проверяем роли пользователя
                const userRoles = await ServerRole.find({
                  userId: userId,
                  serverId: server._id
                }).populate('roleId');

                // Проверяем, есть ли права на управление сообщениями или сервером
                for (const userRole of userRoles) {
                  if (userRole.roleId && (
                    userRole.roleId.permissions.manageMessages ||
                    userRole.roleId.permissions.manageServer
                  )) {
                    canDelete = true;
                    break;
                  }
                }
              }
            }
          }
        }

        if (!canDelete) {
          socket.emit(SOCKET_EVENTS.ERROR, { message: 'Недостаточно прав для удаления сообщения' });
          return;
        }

        const { messageId: deletedId, channelId } = await messageService.deleteMessage(messageId);

        // Отправляем уведомление об удалении всем в канале
        this.io.to(channelId).emit(SOCKET_EVENTS.MESSAGE_DELETED, { messageId: deletedId });

        logger.debug(`Сообщение ${messageId} удалено пользователем ${socket.currentUsername}`);
      } catch (error) {
        logger.error('Ошибка удаления сообщения:', error);
        socket.emit(SOCKET_EVENTS.ERROR, { message: error.message || 'Ошибка удаления сообщения' });
      }
    });
  }


  handleReactionAdd(socket) {
    socket.on(SOCKET_EVENTS.REACTION_ADD, async ({ messageId, emoji, userId, username, isDM = false }) => {
      try {
        const MessageModel = isDM ? require('../models/DirectMessage') : Message;
        const message = await MessageModel.findById(messageId);

        if (!message) {
          socket.emit(SOCKET_EVENTS.ERROR, { message: 'Сообщение не найдено' });
          return;
        }

        // Инициализируем массив реакций если его нет
        if (!message.reactions) {
          message.reactions = [];
        }

        // Найти существующую реакцию с этим эмодзи
        let reaction = message.reactions.find(r => r.emoji === emoji);

        if (reaction) {
          // Проверить, не добавил ли уже пользователь эту реакцию
          const userAlreadyReacted = reaction.users.some(u => u.userId.toString() === userId.toString());

          if (!userAlreadyReacted) {
            reaction.users.push({ userId, username });
          }
        } else {
          // Создать новую реакцию
          message.reactions.push({
            emoji,
            users: [{ userId, username }]
          });
        }

        await message.save();

        // Отправить обновление
        const eventData = {
          messageId: message._id.toString(),
          reactions: message.reactions,
          isDM
        };

        if (isDM) {
          // Для личных сообщений отправляем обеим сторонам
          socket.emit(SOCKET_EVENTS.REACTION_ADDED, eventData);
          this.io.to(`dm-${message.sender}-${message.receiver}`).emit(SOCKET_EVENTS.REACTION_ADDED, eventData);
          this.io.to(`dm-${message.receiver}-${message.sender}`).emit(SOCKET_EVENTS.REACTION_ADDED, eventData);
        } else {
          // Для канальных сообщений
          this.io.to(message.channelId).emit(SOCKET_EVENTS.REACTION_ADDED, eventData);
        }

        logger.debug(`Реакция ${emoji} добавлена к сообщению ${messageId} пользователем ${username}`);
      } catch (error) {
        logger.error('Ошибка добавления реакции:', error);
        socket.emit(SOCKET_EVENTS.ERROR, { message: error.message || 'Ошибка добавления реакции' });
      }
    });
  }

  handleReactionRemove(socket) {
    socket.on(SOCKET_EVENTS.REACTION_REMOVE, async ({ messageId, emoji, userId, isDM = false }) => {
      try {
        const MessageModel = isDM ? require('../models/DirectMessage') : Message;
        const message = await MessageModel.findById(messageId);

        if (!message) {
          socket.emit(SOCKET_EVENTS.ERROR, { message: 'Сообщение не найдено' });
          return;
        }

        if (!message.reactions || message.reactions.length === 0) {
          return;
        }

        // Найти реакцию
        const reactionIndex = message.reactions.findIndex(r => r.emoji === emoji);

        if (reactionIndex !== -1) {
          const reaction = message.reactions[reactionIndex];

          // Удалить пользователя из списка
          reaction.users = reaction.users.filter(u => u.userId.toString() !== userId.toString());

          // Если больше нет пользователей с этой реакцией, удалить её полностью
          if (reaction.users.length === 0) {
            message.reactions.splice(reactionIndex, 1);
          }

          await message.save();

          // Отправить обновление
          const eventData = {
            messageId: message._id.toString(),
            reactions: message.reactions,
            isDM
          };

          if (isDM) {
            // Для личных сообщений отправляем обеим сторонам
            socket.emit(SOCKET_EVENTS.REACTION_REMOVED, eventData);
            this.io.to(`dm-${message.sender}-${message.receiver}`).emit(SOCKET_EVENTS.REACTION_REMOVED, eventData);
            this.io.to(`dm-${message.receiver}-${message.sender}`).emit(SOCKET_EVENTS.REACTION_REMOVED, eventData);
          } else {
            // Для канальных сообщений
            this.io.to(message.channelId).emit(SOCKET_EVENTS.REACTION_REMOVED, eventData);
          }

          logger.debug(`Реакция ${emoji} удалена из сообщения ${messageId} пользователем ${userId}`);
        }
      } catch (error) {
        logger.error('Ошибка удаления реакции:', error);
        socket.emit(SOCKET_EVENTS.ERROR, { message: error.message || 'Ошибка удаления реакции' });
      }
    });
  }

  handleDisconnect(socket) {
    socket.on(SOCKET_EVENTS.DISCONNECT, () => {
      logger.debug('Отключение:', socket.id);

      // Покинуть текстовый канал
      if (socket.currentChannel) {
        socket.leave(socket.currentChannel);
      }
    });
  }

  register(socket) {
    this.handleChannelJoin(socket);
    this.handleDirectMessageJoin(socket);
    this.handleDirectMessageLeave(socket);
    this.handleMessageSend(socket);
    this.handleMessageEdit(socket);
    this.handleMessageDelete(socket);
    this.handleReactionAdd(socket);
    this.handleReactionRemove(socket);
    this.handleDisconnect(socket);
  }
}

module.exports = ChatHandler;
