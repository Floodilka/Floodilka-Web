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

  handleMessageSend(socket) {
    socket.on(SOCKET_EVENTS.MESSAGE_SEND, async ({ channelId, content, username, avatar, badge, badgeTooltip, displayName, userId, attachments }) => {
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
          attachments
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
    socket.on(SOCKET_EVENTS.MESSAGE_EDIT, async ({ messageId, content }) => {
      try {
        const message = await messageService.editMessage(messageId, content);

        // Отправляем обновление всем в канале
        this.io.to(message.channelId).emit(SOCKET_EVENTS.MESSAGE_EDITED, message);

        logger.debug(`Сообщение ${messageId} отредактировано`);
      } catch (error) {
        logger.error('Ошибка редактирования сообщения:', error);
        socket.emit(SOCKET_EVENTS.ERROR, { message: error.message || 'Ошибка редактирования сообщения' });
      }
    });
  }

  handleMessageDelete(socket) {
    socket.on(SOCKET_EVENTS.MESSAGE_DELETE, async ({ messageId, userId }) => {
      try {
        // Получаем сообщение
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
    this.handleMessageSend(socket);
    this.handleMessageEdit(socket);
    this.handleMessageDelete(socket);
    this.handleDisconnect(socket);
  }
}

module.exports = ChatHandler;

