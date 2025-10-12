const { SOCKET_EVENTS } = require('../constants/events');
const logger = require('../utils/logger');

// Map для хранения пользователей в голосовых каналах
const voiceUsers = new Map(); // channelId -> Map(socketId -> userData)
// Map для отслеживания демонстраций экрана
const screenSharingUsers = new Map(); // channelId -> Map(socketId -> { username, userId })

class VoiceHandler {
  constructor(io) {
    this.io = io;
  }

  broadcastVoiceChannelUsers() {
    const voiceChannelsData = {};

    voiceUsers.forEach((users, channelId) => {
      voiceChannelsData[channelId] = Array.from(users.entries()).map(([id, data]) => ({
        id,
        username: data.username,
        avatar: data.avatar,
        badge: data.badge,
        badgeTooltip: data.badgeTooltip,
        displayName: data.displayName,
        userId: data.userId,
        isMuted: data.isMuted,
        isDeafened: data.isDeafened
      }));
    });

    // Добавить информацию о screen sharing для каждого канала
    const screenSharingData = {};
    screenSharingUsers.forEach((channelSharing, channelId) => {
      screenSharingData[channelId] = Array.from(channelSharing.entries()).map(([socketId, data]) => ({
        socketId,
        username: data.username,
        userId: data.userId
      }));
    });

    this.io.emit(SOCKET_EVENTS.VOICE_CHANNELS_UPDATE, voiceChannelsData);
    // Отправить отдельное событие с информацией о screen sharing
    this.io.emit(SOCKET_EVENTS.SCREEN_SHARING_UPDATE, screenSharingData);
    logger.debug('📡 Обновление списка пользователей в голосовых каналах и screen sharing');
  }

  handleVoiceJoin(socket) {
    socket.on(SOCKET_EVENTS.VOICE_JOIN, ({ channelId, username, avatar, badge, badgeTooltip, displayName, userId }) => {
      // Получить или создать Map пользователей для голосового канала
      let users = voiceUsers.get(channelId);
      if (!users) {
        users = new Map();
        voiceUsers.set(channelId, users);
      }
      users.set(socket.id, {
        username,
        avatar,
        badge,
        badgeTooltip,
        displayName,
        userId,
        isMuted: false,
        isDeafened: false
      });

      // Присоединиться к комнате
      socket.join(channelId);
      socket.currentVoiceChannel = channelId;

      // Получить список других пользователей в канале
      const otherUsers = Array.from(users.entries())
        .filter(([id]) => id !== socket.id)
        .map(([id, data]) => ({
          id,
          username: data.username,
          avatar: data.avatar,
          badge: data.badge,
          badgeTooltip: data.badgeTooltip,
          displayName: data.displayName,
          userId: data.userId,
          isMuted: data.isMuted,
          isDeafened: data.isDeafened
        }));

      // Отправить текущему пользователю список других пользователей
      socket.emit(SOCKET_EVENTS.VOICE_USERS, otherUsers);

      // Отправить информацию о текущих демонстрациях экрана
      const channelScreenSharing = screenSharingUsers.get(channelId);
      if (channelScreenSharing && channelScreenSharing.size > 0) {
        channelScreenSharing.forEach((data, sharingSocketId) => {
          // Уведомляем нового пользователя о демонстрации
          socket.emit(SOCKET_EVENTS.SCREEN_SHARE_START, {
            id: sharingSocketId,
            username: data.username,
            userId: data.userId
          });
          logger.debug(`📺 Уведомляем ${username} о демонстрации экрана от ${data.username}`);

          // ВАЖНО: Уведомляем демонстрирующего о новом зрителе!
          this.io.to(sharingSocketId).emit(SOCKET_EVENTS.SCREEN_SHARE_NEW_VIEWER, {
            viewerId: socket.id,
            viewerUsername: username
          });
          logger.debug(`👁️ Уведомляем ${data.username} о новом зрителе ${username}`);
        });
      }

      // Уведомить других пользователей о новом участнике
      socket.to(channelId).emit(SOCKET_EVENTS.VOICE_USER_JOINED, {
        id: socket.id,
        username,
        avatar,
        badge,
        badgeTooltip,
        displayName,
        userId,
        isMuted: false,
        isDeafened: false
      });

      // Отправить обновленный список всем пользователям для сайдбара
      this.broadcastVoiceChannelUsers();

      logger.debug(`${username} присоединился к голосовому каналу ${channelId}`);
    });
  }

  handleVoiceLeave(socket) {
    socket.on(SOCKET_EVENTS.VOICE_LEAVE, ({ channelId }) => {
      const users = voiceUsers.get(channelId);
      if (users) {
        users.delete(socket.id);
        socket.leave(channelId);
        socket.to(channelId).emit(SOCKET_EVENTS.VOICE_USER_LEFT, { id: socket.id });

        // Обновить сайдбар у всех
        this.broadcastVoiceChannelUsers();

        logger.debug(`Пользователь ${socket.id} покинул голосовой канал ${channelId}`);
      }

      // Очистить демонстрацию экрана при выходе из канала
      const channelScreenSharing = screenSharingUsers.get(channelId);
      if (channelScreenSharing && channelScreenSharing.has(socket.id)) {
        channelScreenSharing.delete(socket.id);
        if (channelScreenSharing.size === 0) {
          screenSharingUsers.delete(channelId);
        }
        socket.to(channelId).emit(SOCKET_EVENTS.SCREEN_SHARE_STOP, {
          id: socket.id
        });
        logger.debug(`Очищена демонстрация экрана для ${socket.id} при выходе из канала`);
      }

      socket.currentVoiceChannel = null;
    });
  }

  handleMuteToggle(socket) {
    socket.on(SOCKET_EVENTS.VOICE_MUTE_TOGGLE, ({ channelId, isMuted }) => {
      const users = voiceUsers.get(channelId);
      if (users && users.has(socket.id)) {
        const userData = users.get(socket.id);
        userData.isMuted = isMuted;
        users.set(socket.id, userData);

        // Уведомить всех в канале
        this.io.to(channelId).emit(SOCKET_EVENTS.VOICE_USER_MUTED, {
          id: socket.id,
          isMuted
        });

        // Обновить сайдбар у всех
        this.broadcastVoiceChannelUsers();
      }
    });
  }

  handleDeafenToggle(socket) {
    socket.on(SOCKET_EVENTS.VOICE_DEAFEN_TOGGLE, ({ channelId, isDeafened }) => {
      const users = voiceUsers.get(channelId);
      if (users && users.has(socket.id)) {
        const userData = users.get(socket.id);
        userData.isDeafened = isDeafened;
        users.set(socket.id, userData);

        // Уведомить всех в канале
        this.io.to(channelId).emit(SOCKET_EVENTS.VOICE_USER_DEAFENED, {
          id: socket.id,
          isDeafened
        });

        // Обновить сайдбар у всех
        this.broadcastVoiceChannelUsers();
      }
    });
  }

  handleWebRTC(socket) {
    // WebRTC offer
    socket.on(SOCKET_EVENTS.VOICE_OFFER, ({ offer, to }) => {
      socket.to(to).emit(SOCKET_EVENTS.VOICE_OFFER, {
        offer,
        from: socket.id
      });
    });

    // WebRTC answer
    socket.on(SOCKET_EVENTS.VOICE_ANSWER, ({ answer, to }) => {
      socket.to(to).emit(SOCKET_EVENTS.VOICE_ANSWER, {
        answer,
        from: socket.id
      });
    });

    // ICE candidate
    socket.on(SOCKET_EVENTS.VOICE_ICE_CANDIDATE, ({ candidate, to }) => {
      socket.to(to).emit(SOCKET_EVENTS.VOICE_ICE_CANDIDATE, {
        candidate,
        from: socket.id
      });
    });
  }

  handleScreenShare(socket) {
    // Screen share start
    socket.on(SOCKET_EVENTS.SCREEN_SHARE_START, ({ channelId, username, userId }) => {
      // Добавить пользователя в список демонстрирующих экран
      let channelScreenSharing = screenSharingUsers.get(channelId);
      if (!channelScreenSharing) {
        channelScreenSharing = new Map();
        screenSharingUsers.set(channelId, channelScreenSharing);
      }
      channelScreenSharing.set(socket.id, { username, userId });

      // Уведомить всех в канале о начале демонстрации экрана
      socket.to(channelId).emit(SOCKET_EVENTS.SCREEN_SHARE_START, {
        id: socket.id,
        username,
        userId
      });

      // Обновить sidebar у всех пользователей (включая тех, кто не в канале)
      this.broadcastVoiceChannelUsers();

      logger.debug(`${username} начал демонстрацию экрана в канале ${channelId}`);
    });

    // Screen share stop
    socket.on(SOCKET_EVENTS.SCREEN_SHARE_STOP, ({ channelId }) => {
      // Удалить пользователя из списка демонстрирующих экран
      const channelScreenSharing = screenSharingUsers.get(channelId);
      if (channelScreenSharing) {
        channelScreenSharing.delete(socket.id);
        if (channelScreenSharing.size === 0) {
          screenSharingUsers.delete(channelId);
        }
      }

      // Уведомить всех в канале об остановке демонстрации экрана
      socket.to(channelId).emit(SOCKET_EVENTS.SCREEN_SHARE_STOP, {
        id: socket.id
      });

      // Обновить sidebar у всех пользователей (включая тех, кто не в канале)
      this.broadcastVoiceChannelUsers();

      logger.debug(`Пользователь ${socket.id} остановил демонстрацию экрана в канале ${channelId}`);
    });

    // Screen share WebRTC offer
    socket.on(SOCKET_EVENTS.SCREEN_SHARE_OFFER, ({ offer, to }) => {
      logger.debug(`📨 Screen share OFFER от ${socket.id} -> ${to}`);
      socket.to(to).emit(SOCKET_EVENTS.SCREEN_SHARE_OFFER, {
        offer,
        from: socket.id
      });
      logger.debug(`✅ Screen share OFFER переслан ${to}`);
    });

    // Screen share WebRTC answer
    socket.on(SOCKET_EVENTS.SCREEN_SHARE_ANSWER, ({ answer, to }) => {
      socket.to(to).emit(SOCKET_EVENTS.SCREEN_SHARE_ANSWER, {
        answer,
        from: socket.id
      });
    });

    // Screen share ICE candidate
    socket.on(SOCKET_EVENTS.SCREEN_SHARE_ICE_CANDIDATE, ({ candidate, to }) => {
      socket.to(to).emit(SOCKET_EVENTS.SCREEN_SHARE_ICE_CANDIDATE, {
        candidate,
        from: socket.id
      });
    });

    // Screen share OFFER request убран - больше не нужен
  }

  handleGetAllUsers(socket) {
    socket.on(SOCKET_EVENTS.VOICE_GET_ALL_USERS, () => {
      const voiceChannelsData = {};
      voiceUsers.forEach((users, channelId) => {
        voiceChannelsData[channelId] = Array.from(users.entries()).map(([id, data]) => ({
          id,
          username: data.username,
          avatar: data.avatar,
          badge: data.badge,
          badgeTooltip: data.badgeTooltip,
          displayName: data.displayName,
          userId: data.userId,
          isMuted: data.isMuted,
          isDeafened: data.isDeafened
        }));
      });
      socket.emit(SOCKET_EVENTS.VOICE_CHANNELS_UPDATE, voiceChannelsData);

      // Также отправить информацию о screen sharing
      const screenSharingData = {};
      screenSharingUsers.forEach((channelSharing, channelId) => {
        screenSharingData[channelId] = Array.from(channelSharing.entries()).map(([socketId, data]) => ({
          socketId,
          username: data.username,
          userId: data.userId
        }));
      });
      socket.emit(SOCKET_EVENTS.SCREEN_SHARING_UPDATE, screenSharingData);
      logger.debug(`📡 Отправлено текущее состояние voice и screen sharing пользователю ${socket.id}`);
    });
  }

  handleDisconnect(socket) {
    socket.on(SOCKET_EVENTS.DISCONNECT, () => {
      // Обработка голосовых каналов
      if (socket.currentVoiceChannel) {
        const users = voiceUsers.get(socket.currentVoiceChannel);
        if (users) {
          users.delete(socket.id);
          socket.to(socket.currentVoiceChannel).emit(SOCKET_EVENTS.VOICE_USER_LEFT, { id: socket.id });
          this.broadcastVoiceChannelUsers();
        }

        // Очистить демонстрацию экрана при отключении
        const channelScreenSharing = screenSharingUsers.get(socket.currentVoiceChannel);
        if (channelScreenSharing && channelScreenSharing.has(socket.id)) {
          channelScreenSharing.delete(socket.id);
          if (channelScreenSharing.size === 0) {
            screenSharingUsers.delete(socket.currentVoiceChannel);
          }
          socket.to(socket.currentVoiceChannel).emit(SOCKET_EVENTS.SCREEN_SHARE_STOP, {
            id: socket.id
          });
          logger.debug(`Пользователь ${socket.id} отключился, остановлена демонстрация экрана`);
        }
      }

      // Также очищаем из всех других каналов (на случай багов)
      screenSharingUsers.forEach((channelSharing, channelId) => {
        if (channelSharing.has(socket.id)) {
          channelSharing.delete(socket.id);
          if (channelSharing.size === 0) {
            screenSharingUsers.delete(channelId);
          }
          logger.debug(`Очищена демонстрация экрана для ${socket.id} из канала ${channelId}`);
        }
      });
    });
  }

  register(socket) {
    this.handleVoiceJoin(socket);
    this.handleVoiceLeave(socket);
    this.handleMuteToggle(socket);
    this.handleDeafenToggle(socket);
    this.handleWebRTC(socket);
    this.handleScreenShare(socket);
    this.handleGetAllUsers(socket);
    this.handleDisconnect(socket);
  }
}

module.exports = VoiceHandler;

