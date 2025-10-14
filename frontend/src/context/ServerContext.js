import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import apiService from '../services/api';
import socketService from '../services/socket';
import { useAuth } from './AuthContext';
import { useVoice } from './VoiceContext';
import { useChat } from './ChatContext';

const ServerContext = createContext();

export const useServer = () => {
  const context = useContext(ServerContext);
  if (!context) {
    throw new Error('useServer must be used within ServerProvider');
  }
  return context;
};

export const ServerProvider = ({ children }) => {
  const { user, showAuthModal } = useAuth();
  const { tryRestoreVoiceConnection, finishVoiceReconnect, pendingReconnect } = useVoice();
  const { preloadChannelMessages, currentTextChannel } = useChat();
  const [servers, setServers] = useState([]);
  const [currentServer, setCurrentServer] = useState(null);
  const [channels, setChannels] = useState([]);
  const [allServerMembers, setAllServerMembers] = useState([]);
  const [loading, setLoading] = useState(true); // Изначально true для первой загрузки

  // Загрузка серверов пользователя
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    // Не ждем пока showAuthModal станет false - начинаем загрузку сразу
    const loadServers = async () => {
      try {
        setLoading(true);
        const data = await apiService.getServers();
        const serversArray = Array.isArray(data) ? data : [];
        setServers(serversArray);

        // Предзагружаем данные сервера для быстрого отображения
        if (serversArray.length > 0) {
          // Проверяем, есть ли сохраненный сервер
          const lastServerId = localStorage.getItem('lastServerId');
          let targetServer = serversArray[0]; // По умолчанию первый сервер

          if (lastServerId) {
            const savedServer = serversArray.find(s => s._id === lastServerId);
            if (savedServer) {
              targetServer = savedServer;
            }
          }

          try {
            const [channelsData, membersData] = await Promise.all([
              apiService.getServerChannels(targetServer._id),
              apiService.getServerMembers(targetServer._id)
            ]);

            const channelsArray = Array.isArray(channelsData) ? channelsData : [];
            const membersArray = Array.isArray(membersData) ? membersData : [];

            setChannels(channelsArray);
            setAllServerMembers(membersArray);

            // Предзагружаем сообщения канала
            const lastChannelId = localStorage.getItem('lastChannelId');
            let targetChannel = channelsArray.find(c => c.type === 'text'); // По умолчанию первый текстовый канал

            if (lastChannelId) {
              const savedChannel = channelsArray.find(c => c.id === lastChannelId && c.type === 'text');
              if (savedChannel) {
                targetChannel = savedChannel;
              }
            }

            // Предзагружаем сообщения ТОЛЬКО если канал еще не выбран
            if (targetChannel && !currentTextChannel) {
              console.log('[ServerContext] Предзагружаем сообщения для канала:', targetChannel.id);
              await preloadChannelMessages(targetChannel.id, targetServer._id);
            } else {
              console.log('[ServerContext] Пропускаем предзагрузку - канал уже выбран:', currentTextChannel?.id);
            }
          } catch (err) {
            console.error('Ошибка предзагрузки данных сервера:', err);
          }
        }
      } catch (err) {
        console.error('Ошибка загрузки серверов:', err);
        setServers([]);
      } finally {
        setLoading(false);
      }
    };

    loadServers();
  }, [user]);

  // Попытка восстановить соединение после загрузки серверов
  useEffect(() => {
    if (servers.length > 0) {
      tryRestoreVoiceConnection(servers);
    }
  }, [servers, tryRestoreVoiceConnection]);

  // Если есть pendingReconnect, но пользователь на другом сервере или в ЛС,
  // загружаем каналы нужного сервера для переподключения
  useEffect(() => {
    if (!pendingReconnect || !user) return;

    // Проверяем, загружены ли каналы для нужного сервера
    const needServer = servers.find(s => s._id === pendingReconnect.serverId);
    if (!needServer) return;

    // Если текущий сервер - не тот, где нужно переподключиться, загружаем каналы вручную
    if (!currentServer || currentServer._id !== pendingReconnect.serverId) {
      console.log('📡 Загружаем каналы сервера для восстановления голосового соединения:', needServer.name);

      const loadChannelsForReconnect = async () => {
        try {
          const channelsData = await apiService.getServerChannels(pendingReconnect.serverId);
          const channelsArray = Array.isArray(channelsData) ? channelsData : [];

          // Пытаемся восстановить соединение
          finishVoiceReconnect(channelsArray);
        } catch (err) {
          console.error('Ошибка загрузки каналов для восстановления:', err);
          localStorage.removeItem('voiceChannelConnection');
        }
      };

      loadChannelsForReconnect();
    }
  }, [pendingReconnect, currentServer, servers, user, finishVoiceReconnect]);

  // Присоединение ко ВСЕМ серверам пользователя для отображения онлайн-статуса
  useEffect(() => {
    if (!servers.length || !user) return;

    // Присоединиться ко всем серверам пользователя
    servers.forEach(server => {
      socketService.joinServer({
        serverId: server._id,
        userId: user.id,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
        badge: user.badge,
        badgeTooltip: user.badgeTooltip
      });
    });

    // Cleanup: покинуть все серверы при размонтировании
    return () => {
      if (user) {
        servers.forEach(server => {
          socketService.leaveServer(server._id, user.id);
        });
      }
    };
  }, [servers, user]);

  // Загрузка каналов и участников текущего сервера
  useEffect(() => {
    if (!currentServer || !user) {
      setChannels([]);
      setAllServerMembers([]);
      return;
    }

    const loadServerData = async () => {
      try {
        setLoading(true);

        // Загружаем данные параллельно
        const [channelsData, membersData] = await Promise.all([
          apiService.getServerChannels(currentServer._id),
          apiService.getServerMembers(currentServer._id)
        ]);

        const channelsArray = Array.isArray(channelsData) ? channelsData : [];
        const membersArray = Array.isArray(membersData) ? membersData : [];

        setChannels(channelsArray);
        setAllServerMembers(membersArray);

        // Проверяем, нужно ли восстановить голосовое соединение для этого сервера
        if (pendingReconnect && pendingReconnect.serverId === currentServer._id) {
          finishVoiceReconnect(channelsArray);
        }
      } catch (err) {
        console.error('Ошибка загрузки данных сервера:', err);
        setChannels([]);
        setAllServerMembers([]);
      } finally {
        setLoading(false);
      }
    };

    loadServerData();
  }, [currentServer, user, pendingReconnect, finishVoiceReconnect]);

  const selectServer = useCallback((server) => {
    if (currentServer && currentServer._id === server._id) {
      return;
    }

    // Устанавливаем новый сервер БЕЗ очистки каналов
    // Каналы обновятся автоматически в useEffect при смене currentServer
    setCurrentServer(server);
  }, [currentServer]);

  const createServer = useCallback(async (serverData) => {
    try {
      const newServer = await apiService.createServer(serverData);
      setServers(prev => [...prev, newServer]);
      setCurrentServer(newServer);
      return newServer;
    } catch (err) {
      console.error('Ошибка создания сервера:', err);
      throw err;
    }
  }, []);

  const createChannel = useCallback(async (channelName, channelType = 'text') => {
    if (!currentServer) return;

    try {
      const newChannel = await apiService.createChannel(currentServer._id, {
        name: channelName,
        type: channelType
      });

      setChannels(prev => [...prev, newChannel]);
      return newChannel;
    } catch (err) {
      console.error('Ошибка создания канала:', err);
      throw err;
    }
  }, [currentServer]);

  const updateChannel = useCallback(async (channelId, updateData) => {
    if (!currentServer) return;

    try {
      const updatedChannel = await apiService.updateChannel(currentServer._id, channelId, updateData);

      setChannels(prev =>
        prev.map(channel =>
          channel.id === updatedChannel.id ? updatedChannel : channel
        )
      );

      return updatedChannel;
    } catch (err) {
      console.error('Ошибка обновления канала:', err);
      throw err;
    }
  }, [currentServer]);

  const deleteChannel = useCallback(async (channelId) => {
    if (!currentServer) return;

    try {
      await apiService.deleteChannel(currentServer._id, channelId);
      setChannels(prev => prev.filter(channel => channel.id !== channelId));
    } catch (err) {
      console.error('Ошибка удаления канала:', err);
      throw err;
    }
  }, [currentServer]);

  const refreshServerMembers = useCallback(async (serverId = currentServer?._id) => {
    if (!serverId) {
      return [];
    }

    try {
      const membersData = await apiService.getServerMembers(serverId);
      const membersArray = Array.isArray(membersData) ? membersData : [];
      setAllServerMembers(membersArray);
      return membersArray;
    } catch (err) {
      console.error('Ошибка обновления участников сервера:', err);
      return [];
    }
  }, [currentServer]);

  const removeServer = useCallback((serverId) => {
    setServers(prev => prev.filter(s => s._id !== serverId));

    // Если удаляется текущий сервер, сбрасываем его
    if (currentServer?._id === serverId) {
      setCurrentServer(null);
      setChannels([]);
      setAllServerMembers([]);

      // Очищаем сохраненный ID сервера
      localStorage.removeItem('lastServerId');
      localStorage.removeItem('lastChannelId');
    }
  }, [currentServer]);

  const value = {
    servers,
    currentServer,
    channels,
    allServerMembers,
    loading,
    selectServer,
    createServer,
    createChannel,
    updateChannel,
    deleteChannel,
    setChannels,
    refreshServerMembers,
    removeServer
  };

  return <ServerContext.Provider value={value}>{children}</ServerContext.Provider>;
};
