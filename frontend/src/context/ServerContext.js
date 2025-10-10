import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import apiService from '../services/api';
import socketService from '../services/socket';
import { useAuth } from './AuthContext';

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
  const [servers, setServers] = useState([]);
  const [currentServer, setCurrentServer] = useState(null);
  const [channels, setChannels] = useState([]);
  const [allServerMembers, setAllServerMembers] = useState([]);
  const [loading, setLoading] = useState(false);

  // Загрузка серверов пользователя
  useEffect(() => {
    if (!user || showAuthModal) return;

    const loadServers = async () => {
      try {
        setLoading(true);
        const data = await apiService.getServers();
        const serversArray = Array.isArray(data) ? data : [];
        setServers(serversArray);
      } catch (err) {
        console.error('Ошибка загрузки серверов:', err);
        setServers([]);
      } finally {
        setLoading(false);
      }
    };

    loadServers();
  }, [user, showAuthModal]);

  // Присоединение ко ВСЕМ серверам пользователя для отображения онлайн-статуса
  useEffect(() => {
    if (!servers.length || !user) return;

    console.log('🌐 Присоединяемся ко всем серверам для онлайн-статуса:', servers.length);

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
    if (!currentServer || !user) return;

    const loadServerData = async () => {
      try {
        setLoading(true);

        // Загрузить каналы
        const channelsData = await apiService.getServerChannels(currentServer._id);
        const channelsArray = Array.isArray(channelsData) ? channelsData : [];
        setChannels(channelsArray);

        // Загрузить всех участников сервера
        const membersData = await apiService.getServerMembers(currentServer._id);
        const membersArray = Array.isArray(membersData) ? membersData : [];
        setAllServerMembers(membersArray);
      } catch (err) {
        console.error('Ошибка загрузки данных сервера:', err);
        setChannels([]);
        setAllServerMembers([]);
      } finally {
        setLoading(false);
      }
    };

    loadServerData();
  }, [currentServer, user]);

  const selectServer = useCallback((server) => {
    if (currentServer && currentServer._id === server._id) {
      return;
    }

    setCurrentServer(server);
    // Очищаем каналы при смене сервера
    setChannels([]);
    setAllServerMembers([]);
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
    setChannels
  };

  return <ServerContext.Provider value={value}>{children}</ServerContext.Provider>;
};

