const messageService = require('../services/messageService');
const { SOCKET_EVENTS } = require('../constants/events');
const logger = require('../utils/logger');

// Map для хранения пользователей в текстовых каналах
const onlineUsers = new Map(); // channelId -> Map(socketId -> userData)

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
          const users = onlineUsers.get(socket.currentChannel);
          if (users) {
            users.delete(socket.id);
            this.io.to(socket.currentChannel).emit(SOCKET_EVENTS.USERS_UPDATE, {
              channelId: socket.currentChannel,
              users: Array.from(users.values())
            });
          }
        }

        // Присоединиться к новому каналу
        socket.currentChannel = channelId;
        socket.currentUsername = username || `Гость${Math.floor(Math.random() * 1000)}`;
        socket.currentAvatar = avatar;
        socket.join(channelId);

        // Получить или создать Map пользователей для канала
        let users = onlineUsers.get(channelId);
        if (!users) {
          users = new Map();
          onlineUsers.set(channelId, users);
        }
        users.set(socket.id, { username: socket.currentUsername, avatar, badge, badgeTooltip, displayName, userId });

        // Загрузить сообщения из БД
        const messages = await messageService.getChannelMessages(channelId);
        
        // Отправить текущие сообщения
        socket.emit(SOCKET_EVENTS.MESSAGES_HISTORY, messages);

        // Уведомить всех о новом пользователе
        this.io.to(channelId).emit(SOCKET_EVENTS.USERS_UPDATE, {
          channelId,
          users: Array.from(users.values())
        });

        logger.debug(`Пользователь ${socket.currentUsername} присоединился к каналу ${channelId}`);
      } catch (error) {
        logger.error('Ошибка при присоединении к каналу:', error);
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Ошибка присоединения к каналу' });
      }
    });
  }

  handleMessageSend(socket) {
    socket.on(SOCKET_EVENTS.MESSAGE_SEND, async ({ channelId, content, username, avatar, badge, badgeTooltip, displayName, userId }) => {
      try {
        if (!content || content.trim() === '') {
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
          content
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
    socket.on(SOCKET_EVENTS.MESSAGE_DELETE, async ({ messageId }) => {
      try {
        const { messageId: deletedId, channelId } = await messageService.deleteMessage(messageId);
        
        // Отправляем уведомление об удалении всем в канале
        this.io.to(channelId).emit(SOCKET_EVENTS.MESSAGE_DELETED, { messageId: deletedId });
        
        logger.debug(`Сообщение ${messageId} удалено`);
      } catch (error) {
        logger.error('Ошибка удаления сообщения:', error);
        socket.emit(SOCKET_EVENTS.ERROR, { message: error.message || 'Ошибка удаления сообщения' });
      }
    });
  }

  handleDisconnect(socket) {
    socket.on(SOCKET_EVENTS.DISCONNECT, () => {
      logger.debug('Отключение:', socket.id);

      // Обработка текстовых каналов
      if (socket.currentChannel) {
        const users = onlineUsers.get(socket.currentChannel);
        if (users) {
          users.delete(socket.id);
          this.io.to(socket.currentChannel).emit(SOCKET_EVENTS.USERS_UPDATE, {
            channelId: socket.currentChannel,
            users: Array.from(users.values())
          });
        }
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

