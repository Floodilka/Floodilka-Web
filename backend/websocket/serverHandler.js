const { SOCKET_EVENTS } = require('../constants/events');
const logger = require('../utils/logger');

// Map для хранения онлайн пользователей на серверах
const onlineServerUsers = new Map(); // serverId -> Map(userId -> userData)

class ServerHandler {
  constructor(io) {
    this.io = io;
  }

  handleServerJoin(socket) {
    socket.on(SOCKET_EVENTS.SERVER_JOIN, ({ serverId, userId, username, avatar, badge, badgeTooltip, displayName }) => {
      try {
        // Сохраняем информацию о сервере пользователя
        if (!socket.servers) {
          socket.servers = new Set();
        }
        socket.servers.add(serverId);

        // Присоединяемся к комнате сервера
        socket.join(`server:${serverId}`);

        // Получить или создать Map пользователей для сервера
        let users = onlineServerUsers.get(serverId);
        if (!users) {
          users = new Map();
          onlineServerUsers.set(serverId, users);
        }

        // Добавить пользователя
        users.set(userId, { userId, username, avatar, badge, badgeTooltip, displayName, socketId: socket.id });

        // Уведомить всех на сервере об обновлении списка пользователей
        this.io.to(`server:${serverId}`).emit(SOCKET_EVENTS.SERVER_USERS_UPDATE, {
          serverId,
          users: Array.from(users.values())
        });

        logger.debug(`Пользователь ${username} присоединился к серверу ${serverId}`);
      } catch (error) {
        logger.error('Ошибка при присоединении к серверу:', error);
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Ошибка присоединения к серверу' });
      }
    });
  }

  handleServerLeave(socket) {
    socket.on(SOCKET_EVENTS.SERVER_LEAVE, ({ serverId, userId }) => {
      try {
        // Удаляем из списка серверов пользователя
        if (socket.servers) {
          socket.servers.delete(serverId);
        }

        // Покидаем комнату сервера
        socket.leave(`server:${serverId}`);

        // Удалить пользователя из списка
        const users = onlineServerUsers.get(serverId);
        if (users) {
          users.delete(userId);

          // Уведомить всех на сервере об обновлении
          this.io.to(`server:${serverId}`).emit(SOCKET_EVENTS.SERVER_USERS_UPDATE, {
            serverId,
            users: Array.from(users.values())
          });
        }

        logger.debug(`Пользователь ${userId} покинул сервер ${serverId}`);
      } catch (error) {
        logger.error('Ошибка при выходе с сервера:', error);
      }
    });
  }

  handleDisconnect(socket) {
    socket.on(SOCKET_EVENTS.DISCONNECT, () => {
      // Удалить пользователя из всех серверов
      if (socket.servers) {
        socket.servers.forEach(serverId => {
          const users = onlineServerUsers.get(serverId);
          if (users) {
            // Найти пользователя по socketId
            for (const [userId, userData] of users.entries()) {
              if (userData.socketId === socket.id) {
                users.delete(userId);

                // Уведомить всех на сервере
                this.io.to(`server:${serverId}`).emit(SOCKET_EVENTS.SERVER_USERS_UPDATE, {
                  serverId,
                  users: Array.from(users.values())
                });
                break;
              }
            }
          }
        });
      }
    });
  }

  register(socket) {
    this.handleServerJoin(socket);
    this.handleServerLeave(socket);
    this.handleDisconnect(socket);
  }
}

module.exports = ServerHandler;

