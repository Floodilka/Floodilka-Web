import { useEffect, useState } from 'react';
import socketService from '../services/socket';
import { SOCKET_EVENTS } from '../constants/events';
import { useChat } from '../context/ChatContext';
import { useVoice } from '../context/VoiceContext';
import { useAuth } from '../context/AuthContext';
import { useServer } from '../context/ServerContext';
import { useGlobalUsers } from '../context/GlobalUsersContext';

export const useSocket = () => {
  const [socket, setSocket] = useState(null);
  const { addMessage, editMessage, deleteMessage, setMessages, setHasUnreadDMs } = useChat();
  const { setVoiceChannelUsers } = useVoice();
  const { user } = useAuth();
  const { setChannels } = useServer();
  const { setGlobalOnlineUsers } = useGlobalUsers();

  useEffect(() => {
    const newSocket = socketService.connect();
    setSocket(newSocket);

    // Channel events
    socketService.on(SOCKET_EVENTS.CHANNEL_CREATED, (newChannel) => {
      setChannels(prev => [...prev, newChannel]);
    });

    // Message events
    socketService.on(SOCKET_EVENTS.MESSAGES_HISTORY, (history) => {
      setMessages(history);
    });

    socketService.on(SOCKET_EVENTS.MESSAGE_NEW, (message) => {
      addMessage(message);
    });

    socketService.on(SOCKET_EVENTS.MESSAGE_EDITED, (editedMessage) => {
      editMessage(editedMessage);
    });

    socketService.on(SOCKET_EVENTS.MESSAGE_DELETED, ({ messageId }) => {
      deleteMessage(messageId);
    });

    // Server user events (для онлайн статуса на уровне сервера)
    socketService.on(SOCKET_EVENTS.SERVER_USERS_UPDATE, ({ users: newUsers }) => {
      console.log('👥 SERVER_USERS_UPDATE событие получено:', newUsers);
      // Больше не используем setUsers - онлайн статус теперь управляется через globalOnlineUsers
    });

    // Global user events (для всех онлайн пользователей в приложении)
    socketService.on(SOCKET_EVENTS.GLOBAL_USERS_UPDATE, ({ users: newUsers }) => {
      console.log('🌍 GLOBAL_USERS_UPDATE событие получено:', newUsers);
      setGlobalOnlineUsers(newUsers);
    });

    // Voice events
    socketService.on(SOCKET_EVENTS.VOICE_CHANNELS_UPDATE, (voiceData) => {
      // Фильтруем себя из списка
      const filteredData = {};
      Object.keys(voiceData).forEach(channelId => {
        filteredData[channelId] = voiceData[channelId].filter(u => u.id !== newSocket.id);
      });
      setVoiceChannelUsers(filteredData);
    });

    // Direct message events
    socketService.on(SOCKET_EVENTS.DIRECT_MESSAGE_NEW, (message) => {
      console.log('📨 Получено новое личное сообщение:', message);
      if (message.receiver._id === user?.id) {
        console.log('🔴 Обновляем состояние непрочитанных сообщений');
        setHasUnreadDMs(true);
      }
    });

    // Error handling
    socketService.on(SOCKET_EVENTS.ERROR, ({ message }) => {
      alert(`Ошибка: ${message}`);
    });

    // Запросить текущее состояние голосовых каналов
    socketService.getAllVoiceUsers();

    return () => {
      socketService.removeAllListeners(SOCKET_EVENTS.CHANNEL_CREATED);
      socketService.removeAllListeners(SOCKET_EVENTS.MESSAGES_HISTORY);
      socketService.removeAllListeners(SOCKET_EVENTS.MESSAGE_NEW);
      socketService.removeAllListeners(SOCKET_EVENTS.MESSAGE_EDITED);
      socketService.removeAllListeners(SOCKET_EVENTS.MESSAGE_DELETED);
      socketService.removeAllListeners(SOCKET_EVENTS.SERVER_USERS_UPDATE);
      socketService.removeAllListeners(SOCKET_EVENTS.GLOBAL_USERS_UPDATE);
      socketService.removeAllListeners(SOCKET_EVENTS.VOICE_CHANNELS_UPDATE);
      socketService.removeAllListeners(SOCKET_EVENTS.ERROR);
      socketService.removeAllListeners(SOCKET_EVENTS.DIRECT_MESSAGE_NEW);

      socketService.disconnect();
    };
  }, [user?.id, addMessage, editMessage, deleteMessage, setMessages, setHasUnreadDMs, setVoiceChannelUsers, setChannels, setGlobalOnlineUsers]);

  return socket;
};

