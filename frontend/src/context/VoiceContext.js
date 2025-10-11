import React, { createContext, useContext, useState, useCallback, useRef, useMemo } from 'react';

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
    setActiveVoiceChannel
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
    updateSpeakingUsers
  ]);

  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
};

