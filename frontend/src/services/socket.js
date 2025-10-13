import io from 'socket.io-client';
import { BACKEND_URL } from '../constants';
import { SOCKET_EVENTS } from '../constants/events';

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
    this.connectionOptions = {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      forceNew: false,
      withCredentials: true
    };
  }

  connect() {
    if (this.socket) {
      return this.socket;
    }

    this.socket = io(BACKEND_URL, this.connectionOptions);

    this.socket.on('connect', () => {
      console.log('✅ Socket connected:', this.socket.id);
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Socket disconnected');
    });

    if (this.socket.io?.engine) {
      this.socket.io.engine.on('upgrade', (transport) => {
        console.log('📦 Socket transport upgraded:', transport.name);
      });
    }

    this.socket.on('connect_error', (error) => {
      console.warn('⚠️  Socket connection error:', error.message);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  getSocket() {
    return this.socket;
  }

  // Event emitters
  joinServer(serverData) {
    this.socket?.emit(SOCKET_EVENTS.SERVER_JOIN, serverData);
  }

  leaveServer(serverId, userId) {
    this.socket?.emit(SOCKET_EVENTS.SERVER_LEAVE, { serverId, userId });
  }

  joinChannel(channelData) {
    this.socket?.emit(SOCKET_EVENTS.CHANNEL_JOIN, channelData);
  }

  sendMessage(messageData) {
    this.socket?.emit(SOCKET_EVENTS.MESSAGE_SEND, messageData);
  }

  editMessage(messageId, content) {
    this.socket?.emit(SOCKET_EVENTS.MESSAGE_EDIT, { messageId, content });
  }

  deleteMessage(messageId) {
    this.socket?.emit(SOCKET_EVENTS.MESSAGE_DELETE, { messageId });
  }

  joinVoiceChannel(voiceData) {
    this.socket?.emit(SOCKET_EVENTS.VOICE_JOIN, voiceData);
  }

  leaveVoiceChannel(channelId) {
    this.socket?.emit(SOCKET_EVENTS.VOICE_LEAVE, { channelId });
  }

  toggleMute(channelId, isMuted) {
    this.socket?.emit(SOCKET_EVENTS.VOICE_MUTE_TOGGLE, { channelId, isMuted });
  }

  toggleDeafen(channelId, isDeafened) {
    this.socket?.emit(SOCKET_EVENTS.VOICE_DEAFEN_TOGGLE, { channelId, isDeafened });
  }

  getAllVoiceUsers() {
    this.socket?.emit(SOCKET_EVENTS.VOICE_GET_ALL_USERS);
  }

  // WebRTC
  sendOffer(offer, to) {
    this.socket?.emit(SOCKET_EVENTS.VOICE_OFFER, { offer, to });
  }

  sendAnswer(answer, to) {
    this.socket?.emit(SOCKET_EVENTS.VOICE_ANSWER, { answer, to });
  }

  sendIceCandidate(candidate, to) {
    this.socket?.emit(SOCKET_EVENTS.VOICE_ICE_CANDIDATE, { candidate, to });
  }

  // Event listeners
  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback);

      // Сохраняем ссылку на callback для возможности отписки
      if (!this.listeners.has(event)) {
        this.listeners.set(event, new Set());
      }
      this.listeners.get(event).add(callback);
    }
  }

  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);

      // Удаляем из сохраненных listeners
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.listeners.delete(event);
        }
      }
    }
  }

  removeAllListeners(event) {
    if (this.socket) {
      this.socket.removeAllListeners(event);
      this.listeners.delete(event);
    }
  }
}

const socketServiceInstance = new SocketService();
export default socketServiceInstance;
