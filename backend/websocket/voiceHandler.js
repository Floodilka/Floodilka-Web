const { SOCKET_EVENTS } = require('../constants/events');
const logger = require('../utils/logger');

// Map для хранения пользователей в голосовых каналах
const voiceUsers = new Map(); // channelId -> Map(socketId -> userData)

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

    this.io.emit(SOCKET_EVENTS.VOICE_CHANNELS_UPDATE, voiceChannelsData);
    logger.debug('📡 Обновление списка пользователей в голосовых каналах');
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
      }
    });
  }

  register(socket) {
    this.handleVoiceJoin(socket);
    this.handleVoiceLeave(socket);
    this.handleMuteToggle(socket);
    this.handleDeafenToggle(socket);
    this.handleWebRTC(socket);
    this.handleGetAllUsers(socket);
    this.handleDisconnect(socket);
  }
}

module.exports = VoiceHandler;

