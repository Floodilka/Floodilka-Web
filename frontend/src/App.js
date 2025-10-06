import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import './App.css';
import ChannelList from './components/ChannelList';
import Chat from './components/Chat';
import VoiceChannel from './components/VoiceChannel';
import UserList from './components/UserList';
import UsernameModal from './components/UsernameModal';

// Автоматически определяем URL в зависимости от окружения
const BACKEND_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : `${window.location.protocol}//${window.location.hostname}`;

function App() {
  const [socket, setSocket] = useState(null);
  const [channels, setChannels] = useState([]);
  const [currentTextChannel, setCurrentTextChannel] = useState(null);
  const [currentVoiceChannel, setCurrentVoiceChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [voiceChannelUsers, setVoiceChannelUsers] = useState({}); // {channelId: [{id, username, isMuted}]}
  const [speakingUsers, setSpeakingUsers] = useState({}); // {channelId: Set of userIds}
  const [username, setUsername] = useState(null);
  const [showUsernameModal, setShowUsernameModal] = useState(true);
  const [globalMuted, setGlobalMuted] = useState(false);
  const [globalDeafened, setGlobalDeafened] = useState(false);
  const voiceDisconnectRef = useRef(null);
  const speakingUsersRef = useRef({});

  // Инициализация socket
  useEffect(() => {
    const newSocket = io(BACKEND_URL);
    setSocket(newSocket);

    return () => newSocket.close();
  }, []);

  // Загрузка каналов
  useEffect(() => {
    fetch(`${BACKEND_URL}/api/channels`)
      .then(res => res.json())
      .then(data => {
        setChannels(data);
        // Автоматически выбрать первый текстовый канал
        const firstTextChannel = data.find(ch => ch.type === 'text');
        if (firstTextChannel && !currentTextChannel) {
          setCurrentTextChannel(firstTextChannel);
        }
      })
      .catch(err => console.error('Ошибка загрузки каналов:', err));
  }, []);

  // Socket listeners
  useEffect(() => {
    if (!socket) return;

    socket.on('channel:created', (newChannel) => {
      setChannels(prev => [...prev, newChannel]);
    });

    socket.on('messages:history', (history) => {
      setMessages(history);
    });

    socket.on('message:new', (message) => {
      setMessages(prev => [...prev, message]);
    });

    socket.on('users:update', ({ users: newUsers }) => {
      setUsers(newUsers);
    });

    socket.on('voice:channels-update', (voiceData) => {
      console.log('📡 Получено voice:channels-update:', voiceData);
      // Фильтруем себя из списка - мы добавляем себя отдельно в ChannelList
      const filteredData = {};
      Object.keys(voiceData).forEach(channelId => {
        filteredData[channelId] = voiceData[channelId].filter(user => user.id !== socket.id);
      });
      setVoiceChannelUsers(filteredData);
    });

    socket.on('error', ({ message }) => {
      alert(`Ошибка: ${message}`);
    });

    // Запросить текущее состояние голосовых каналов
    console.log('📤 Запрашиваем voice:get-all-users');
    socket.emit('voice:get-all-users');

    return () => {
      socket.off('channel:created');
      socket.off('messages:history');
      socket.off('message:new');
      socket.off('users:update');
      socket.off('voice:channels-update');
      socket.off('error');
    };
  }, [socket]);

  // Присоединиться к текстовому каналу при выборе
  useEffect(() => {
    if (socket && currentTextChannel && username) {
      setMessages([]);
      socket.emit('channel:join', {
        channelId: currentTextChannel.id,
        username
      });
    }
  }, [socket, currentTextChannel, username]);

  const handleUsernameSubmit = (name) => {
    setUsername(name);
    setShowUsernameModal(false);
  };

  const handleChannelSelect = (channel) => {
    if (channel.type === 'voice') {
      // Для голосовых - подключаем если еще не подключены
      if (currentVoiceChannel?.id === channel.id) {
        // Уже подключены - игнорируем
        return;
      } else {
        setCurrentVoiceChannel(channel);
      }
    } else {
      // Для текстовых - просто переключаем
      setCurrentTextChannel(channel);
    }
  };

  const handleCreateChannel = (channelName, channelType = 'text') => {
    fetch(`${BACKEND_URL}/api/channels`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: channelName, type: channelType }),
    })
      .then(res => res.json())
      .then(newChannel => {
        if (newChannel.type === 'text') {
          setCurrentTextChannel(newChannel);
        } else {
          setCurrentVoiceChannel(newChannel);
        }
      })
      .catch(err => console.error('Ошибка создания канала:', err));
  };

  const handleSendMessage = (content) => {
    if (socket && currentTextChannel) {
      socket.emit('message:send', {
        channelId: currentTextChannel.id,
        content
      });
    }
  };

  if (showUsernameModal) {
    return <UsernameModal onSubmit={handleUsernameSubmit} />;
  }

  return (
    <div className="app">
      <ChannelList
        channels={channels}
        currentTextChannel={currentTextChannel}
        currentVoiceChannel={currentVoiceChannel}
        voiceChannelUsers={voiceChannelUsers}
        speakingUsers={speakingUsers}
        username={username}
        isMuted={globalMuted}
        isDeafened={globalDeafened}
        isInVoice={!!currentVoiceChannel}
        onToggleMute={() => setGlobalMuted(!globalMuted)}
        onToggleDeafen={() => {
          const newDeafened = !globalDeafened;
          setGlobalDeafened(newDeafened);
          if (newDeafened) setGlobalMuted(true); // Auto-mute при deafen
        }}
        onDisconnect={() => {
          // Отключение из голосового канала
          if (currentVoiceChannel && voiceDisconnectRef.current) {
            voiceDisconnectRef.current();
            setCurrentVoiceChannel(null);
          }
        }}
        onSelectChannel={handleChannelSelect}
        onCreateChannel={handleCreateChannel}
      />
      {/* Голосовой канал (скрытый, работает в фоне) */}
      {currentVoiceChannel && (
        <VoiceChannel
          socket={socket}
          channel={currentVoiceChannel}
          username={username}
          globalMuted={globalMuted}
          globalDeafened={globalDeafened}
          onDisconnectRef={voiceDisconnectRef}
          onSpeakingUpdate={(speaking) => {
            speakingUsersRef.current[currentVoiceChannel.id] = speaking;
            setSpeakingUsers({...speakingUsersRef.current});
          }}
        />
      )}

      {/* Текстовый чат - всегда отображается */}
      <Chat
        channel={currentTextChannel}
        messages={messages}
        username={username}
        onSendMessage={handleSendMessage}
      />

      <UserList users={users} />
    </div>
  );
}

export default App;

