const { SOCKET_EVENTS } = require('../constants/events');
const logger = require('../utils/logger');
const User = require('../models/User');

// Map для хранения онлайн пользователей на серверах
const onlineServerUsers = new Map(); // serverId -> Map(userId -> userData)

// Map для хранения всех глобально онлайн пользователей
const globalOnlineUsers = new Map(); // userId -> userData

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
        const userData = { userId, username, avatar, badge, badgeTooltip, displayName, socketId: socket.id };
        users.set(userId, userData);

        // Добавить в глобальный список онлайн пользователей (если еще не добавлен)
        if (!globalOnlineUsers.has(userId)) {
          globalOnlineUsers.set(userId, userData);

          // Обновить статус в БД на 'online'
          User.findByIdAndUpdate(userId, { status: 'online' })
            .catch(err => logger.error('Ошибка обновления статуса на online:', err));

          // Уведомить всех о том, что пользователь стал онлайн
          this.io.emit(SOCKET_EVENTS.GLOBAL_USERS_UPDATE, {
            users: Array.from(globalOnlineUsers.values())
          });
        }

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
      let disconnectedUserId = null;

      // Удалить пользователя из всех серверов
      if (socket.servers) {
        socket.servers.forEach(serverId => {
          const users = onlineServerUsers.get(serverId);
          if (users) {
            // Найти пользователя по socketId
            for (const [userId, userData] of users.entries()) {
              if (userData.socketId === socket.id) {
                users.delete(userId);
                disconnectedUserId = userId;

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

      // Удалить из глобального списка, если пользователь не на других серверах
      if (disconnectedUserId) {
        let stillOnline = false;
        for (const [serverId, users] of onlineServerUsers.entries()) {
          if (users.has(disconnectedUserId)) {
            stillOnline = true;
            break;
          }
        }

        if (!stillOnline) {
          globalOnlineUsers.delete(disconnectedUserId);

          // Обновить статус в БД на 'offline'
          User.findByIdAndUpdate(disconnectedUserId, { status: 'offline' })
            .catch(err => logger.error('Ошибка обновления статуса на offline:', err));

          // Уведомить всех о том, что пользователь стал оффлайн
          this.io.emit(SOCKET_EVENTS.GLOBAL_USERS_UPDATE, {
            users: Array.from(globalOnlineUsers.values())
          });
        }
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
module.exports.globalOnlineUsers = globalOnlineUsers;

