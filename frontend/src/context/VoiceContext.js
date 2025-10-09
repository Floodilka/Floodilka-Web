import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

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
    console.log('🎤 VoiceContext joinVoiceChannel:', channel);
    console.log('🎤 VoiceContext channel.serverId:', channel.serverId);
    setCurrentVoiceChannel(channel);
    setActiveVoiceChannel(channel);
    console.log('🎤 VoiceContext activeVoiceChannel установлен:', channel);
  }, [activeVoiceChannel]);

  const leaveVoiceChannel = useCallback(() => {
    if (voiceDisconnectRef.current) {
      voiceDisconnectRef.current();
    }
    setCurrentVoiceChannel(null);
    setActiveVoiceChannel(null);
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

  const value = {
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
  };

  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
};

