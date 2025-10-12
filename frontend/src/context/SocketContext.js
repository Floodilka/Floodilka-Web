import React, { createContext, useContext, useEffect, useState } from 'react';
import socketService from '../services/socket';
import { SOCKET_EVENTS } from '../constants/events';
import { useChat } from './ChatContext';
import { useVoice } from './VoiceContext';
import { useAuth } from './AuthContext';
import { useServer } from './ServerContext';
import { useGlobalUsers } from './GlobalUsersContext';

const SocketContext = createContext();

export const useSocketContext = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocketContext must be used within SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const { addMessage, editMessage, deleteMessage, updateMessageReactions, setMessages, setHasUnreadDMs } = useChat();
  const { setVoiceChannelUsers, setScreenSharingUsers } = useVoice();
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

    // Reaction events
    socketService.on(SOCKET_EVENTS.REACTION_ADDED, ({ messageId, reactions }) => {
      updateMessageReactions(messageId, reactions);
    });

    socketService.on(SOCKET_EVENTS.REACTION_REMOVED, ({ messageId, reactions }) => {
      updateMessageReactions(messageId, reactions);
    });

    // Server user events (для онлайн статуса на уровне сервера)
    socketService.on(SOCKET_EVENTS.SERVER_USERS_UPDATE, ({ users: newUsers }) => {
      // Больше не используем setUsers - онлайн статус теперь управляется через globalOnlineUsers
    });

    // Global user events (для всех онлайн пользователей в приложении)
    socketService.on(SOCKET_EVENTS.GLOBAL_USERS_UPDATE, ({ users: newUsers }) => {
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

    // Screen sharing update event (обновление для всех пользователей)
    socketService.on(SOCKET_EVENTS.SCREEN_SHARING_UPDATE, (screenSharingData) => {
      console.log('📺 Получено глобальное обновление screen sharing:', screenSharingData);
      // Обновляем состояние screen sharing для всех каналов
      const updatedScreenSharing = {};
      Object.keys(screenSharingData).forEach(channelId => {
        const channelMap = new Map();
        screenSharingData[channelId].forEach(({ socketId, username, userId }) => {
          console.log(`  🎥 Канал ${channelId}: ${username} (userId: ${userId}, socketId: ${socketId})`);
          channelMap.set(userId, { userId, username, socketId });
        });
        updatedScreenSharing[channelId] = channelMap;
      });
      console.log('✅ Обновлено состояние screenSharingUsers:', updatedScreenSharing);
      setScreenSharingUsers(updatedScreenSharing);
    });

    // Direct message events
    socketService.on(SOCKET_EVENTS.DIRECT_MESSAGE_NEW, (message) => {
      if (message.receiver._id === user?.id) {
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
      socketService.removeAllListeners(SOCKET_EVENTS.REACTION_ADDED);
      socketService.removeAllListeners(SOCKET_EVENTS.REACTION_REMOVED);
      socketService.removeAllListeners(SOCKET_EVENTS.SERVER_USERS_UPDATE);
      socketService.removeAllListeners(SOCKET_EVENTS.GLOBAL_USERS_UPDATE);
      socketService.removeAllListeners(SOCKET_EVENTS.VOICE_CHANNELS_UPDATE);
      socketService.removeAllListeners(SOCKET_EVENTS.ERROR);
      socketService.removeAllListeners(SOCKET_EVENTS.DIRECT_MESSAGE_NEW);

      socketService.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const value = {
    socket
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

