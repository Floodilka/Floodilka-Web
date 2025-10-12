import React, { createContext, useContext, useState, useCallback, useRef, useMemo, useEffect } from 'react';

const VoiceContext = createContext();

export const useVoice = () => {
  const context = useContext(VoiceContext);
  if (!context) {
    throw new Error('useVoice must be used within VoiceProvider');
  }
  return context;
};

export const VoiceProvider = ({ children }) => {
  const [currentVoiceChannel, setCurrentVoiceChannel] = useState(null);
  const [activeVoiceChannel, setActiveVoiceChannel] = useState(null);
  const [voiceChannelUsers, setVoiceChannelUsers] = useState({});
  const [speakingUsers, setSpeakingUsers] = useState({});
  const [globalMuted, setGlobalMuted] = useState(false);
  const [globalDeafened, setGlobalDeafened] = useState(false);
  const [pendingReconnect, setPendingReconnect] = useState(null);

  const voiceDisconnectRef = useRef(null);
  const speakingUsersRef = useRef({});

  const joinVoiceChannel = useCallback((channel) => {
    if (activeVoiceChannel?.id === channel.id) {
      return;
    }

    // Просто меняем канал - React автоматически размонтирует старый VoiceChannel
    // и смонтирует новый, cleanup функция всё очистит
    setCurrentVoiceChannel(channel);
    setActiveVoiceChannel(channel);

    // Сохраняем информацию о подключении для восстановления после перезагрузки
    try {
      localStorage.setItem('voiceChannelConnection', JSON.stringify({
        channelId: channel.id,
        serverId: channel.serverId,
        timestamp: Date.now()
      }));
    } catch (err) {
      console.warn('Не удалось сохранить информацию о голосовом канале:', err);
    }
  }, [activeVoiceChannel]);

  const leaveVoiceChannel = useCallback(() => {
    // Вызываем функцию отключения из VoiceChannel
    if (voiceDisconnectRef.current) {
      voiceDisconnectRef.current();
    }

    // Очищаем все состояния
    setCurrentVoiceChannel(null);
    setActiveVoiceChannel(null);

    // Сбрасываем состояния mute/deafen
    setGlobalMuted(false);
    setGlobalDeafened(false);

    // Удаляем информацию о подключении из localStorage
    try {
      localStorage.removeItem('voiceChannelConnection');
    } catch (err) {
      console.warn('Не удалось удалить информацию о голосовом канале:', err);
    }
  }, []);

  const toggleMute = useCallback(() => {
    setGlobalMuted(prev => !prev);
  }, []);

  const toggleDeafen = useCallback(() => {
    setGlobalDeafened(prev => {
      const newDeafened = !prev;
      if (newDeafened) {
        setGlobalMuted(true);
      }
      return newDeafened;
    });
  }, []);

  const updateSpeakingUsers = useCallback((speaking) => {
    if (currentVoiceChannel?.id) {
      speakingUsersRef.current[currentVoiceChannel.id] = speaking;
      setSpeakingUsers({...speakingUsersRef.current});
    }
  }, [currentVoiceChannel]);

  // Функция для попытки восстановления соединения с голосовым каналом
  const tryRestoreVoiceConnection = useCallback((servers) => {
    if (currentVoiceChannel || !servers || servers.length === 0) {
      return;
    }

    try {
      const savedConnection = localStorage.getItem('voiceChannelConnection');
      if (!savedConnection) {
        return;
      }

      const { channelId, serverId, timestamp } = JSON.parse(savedConnection);

      // Проверяем, что сохраненная информация не слишком старая (максимум 24 часа)
      const MAX_AGE = 24 * 60 * 60 * 1000; // 24 часа
      if (Date.now() - timestamp > MAX_AGE) {
        localStorage.removeItem('voiceChannelConnection');
        return;
      }

      // Ищем сервер среди доступных
      const server = servers.find(s => s._id === serverId);

      if (!server) {
        // Сервер не найден (возможно, пользователь был удален), удаляем информацию
        console.log('❌ Сервер для голосового канала не найден');
        localStorage.removeItem('voiceChannelConnection');
        return;
      }

      console.log('🔄 Восстанавливаем подключение к голосовому каналу на сервере:', server.name);
      // Сохраняем информацию для последующей загрузки каналов и переподключения
      setPendingReconnect({ channelId, serverId, serverName: server.name });
    } catch (err) {
      console.warn('Ошибка при восстановлении голосового подключения:', err);
      localStorage.removeItem('voiceChannelConnection');
    }
  }, [currentVoiceChannel]);

  // Функция для завершения переподключения (вызывается извне после загрузки каналов)
  const finishVoiceReconnect = useCallback((channels) => {
    if (!pendingReconnect || !channels || channels.length === 0) {
      return false;
    }

    // Ищем канал среди загруженных
    const channel = channels.find(ch => ch.id === pendingReconnect.channelId && ch.type === 'voice');

    if (channel) {
      console.log('✅ Переподключаемся к голосовому каналу:', channel.name);
      joinVoiceChannel(channel);
      setPendingReconnect(null);
      return true;
    } else {
      // Канал не найден, удаляем информацию
      console.log('❌ Голосовой канал не найден');
      localStorage.removeItem('voiceChannelConnection');
      setPendingReconnect(null);
      return false;
    }
  }, [pendingReconnect, joinVoiceChannel]);

  // Мемоизируем value для предотвращения лишних обновлений контекста
  const value = useMemo(() => ({
    currentVoiceChannel,
    activeVoiceChannel,
    voiceChannelUsers,
    speakingUsers,
    globalMuted,
    globalDeafened,
    voiceDisconnectRef,
    joinVoiceChannel,
    leaveVoiceChannel,
    toggleMute,
    toggleDeafen,
    setVoiceChannelUsers,
    updateSpeakingUsers,
    setCurrentVoiceChannel,
    setActiveVoiceChannel,
    tryRestoreVoiceConnection,
    finishVoiceReconnect,
    pendingReconnect
  }), [
    currentVoiceChannel,
    activeVoiceChannel,
    voiceChannelUsers,
    speakingUsers,
    globalMuted,
    globalDeafened,
    joinVoiceChannel,
    leaveVoiceChannel,
    toggleMute,
    toggleDeafen,
    updateSpeakingUsers,
    tryRestoreVoiceConnection,
    finishVoiceReconnect,
    pendingReconnect
  ]);

  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
};

