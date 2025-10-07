import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import './App.css';
import ServerSidebar from './components/ServerSidebar';
import ChannelList from './components/ChannelList';
import Chat from './components/Chat';
import VoiceChannel from './components/VoiceChannel';
import UserList from './components/UserList';
import AuthModal from './components/Auth/AuthModal';
import EmptyServerState from './components/EmptyServerState';
import MobileLayout from './components/MobileLayout';

// Автоматически определяем URL в зависимости от окружения
const BACKEND_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : `${window.location.protocol}//${window.location.hostname}`;

function App() {
  const [socket, setSocket] = useState(null);
  const [servers, setServers] = useState([]);
  const [currentServer, setCurrentServer] = useState(null);
  const [channels, setChannels] = useState([]);
  const [currentTextChannel, setCurrentTextChannel] = useState(null);
  const [currentVoiceChannel, setCurrentVoiceChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [allServerMembers, setAllServerMembers] = useState([]);
  const [voiceChannelUsers, setVoiceChannelUsers] = useState({}); // {channelId: [{id, username, isMuted}]}
  const [speakingUsers, setSpeakingUsers] = useState({}); // {channelId: Set of userIds}
  const [user, setUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(true);
  const [globalMuted, setGlobalMuted] = useState(false);
  const [globalDeafened, setGlobalDeafened] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const voiceDisconnectRef = useRef(null);
  const speakingUsersRef = useRef({});

  // Определение мобильного устройства
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Инициализация socket
  useEffect(() => {
    const newSocket = io(BACKEND_URL);
    setSocket(newSocket);

    return () => newSocket.close();
  }, []);

  // Загрузка серверов пользователя
  useEffect(() => {
    if (!user) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    fetch(`${BACKEND_URL}/api/servers`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => res.json())
      .then(data => {
        setServers(data);

        // Попытаться восстановить последний выбранный сервер
        const lastServerId = localStorage.getItem('lastServerId');
        if (lastServerId && data.length > 0) {
          const lastServer = data.find(s => s._id === lastServerId);
          if (lastServer) {
            setCurrentServer(lastServer);
            return;
          }
        }

        // Если не получилось восстановить, выбрать первый сервер
        if (data.length > 0 && !currentServer) {
          setCurrentServer(data[0]);
        }
      })
      .catch(err => console.error('Ошибка загрузки серверов:', err));
  }, [user]);

  // Загрузка каналов и участников текущего сервера
  useEffect(() => {
    if (!currentServer || !user) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    // Загрузить каналы
    fetch(`${BACKEND_URL}/api/servers/${currentServer._id}/channels`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
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

    // Загрузить всех участников сервера
    fetch(`${BACKEND_URL}/api/servers/${currentServer._id}/members`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => res.json())
      .then(data => {
        setAllServerMembers(data);
      })
      .catch(err => console.error('Ошибка загрузки участников:', err));
  }, [currentServer, user, currentTextChannel]);

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

    socket.on('message:edited', (editedMessage) => {
      setMessages(prev => prev.map(msg =>
        msg.id === editedMessage.id ? editedMessage : msg
      ));
    });

    socket.on('message:deleted', ({ messageId }) => {
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
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
      socket.off('message:edited');
      socket.off('message:deleted');
      socket.off('users:update');
      socket.off('voice:channels-update');
      socket.off('error');
    };
  }, [socket]);

  // Присоединиться к текстовому каналу при выборе
  useEffect(() => {
    if (socket && currentTextChannel && user) {
      setMessages([]);
      socket.emit('channel:join', {
        channelId: currentTextChannel.id,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
        badge: user.badge,
        badgeTooltip: user.badgeTooltip,
        userId: user.id
      });
    }
  }, [socket, currentTextChannel, user]);

  const handleAuth = (userData) => {
    setUser(userData);
    setShowAuthModal(false);

    // Принудительно переподключиться к текущему каналу после небольшой задержки
    setTimeout(() => {
      if (socket && currentTextChannel) {
        setMessages([]);
        socket.emit('channel:join', {
          channelId: currentTextChannel.id,
          username: userData.username,
          displayName: userData.displayName,
          avatar: userData.avatar,
          badge: userData.badge,
          badgeTooltip: userData.badgeTooltip,
          userId: userData.id
        });
      }
    }, 100);
  };

  const handleLogout = () => {
    // Очистить токен и данные пользователя
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('lastServerId');

    // Отключиться от голосового канала если подключен
    if (voiceDisconnectRef.current) {
      voiceDisconnectRef.current();
    }

    // Сбросить состояние
    setUser(null);
    setShowAuthModal(true);
    setServers([]);
    setCurrentServer(null);
    setChannels([]);
    setCurrentTextChannel(null);
    setCurrentVoiceChannel(null);
    setMessages([]);
    setUsers([]);
    setGlobalMuted(false);
    setGlobalDeafened(false);
  };

  const handleSelectServer = (server) => {
    // Если уже выбран этот сервер, ничего не делаем
    if (currentServer && currentServer._id === server._id) {
      return;
    }

    setCurrentServer(server);
    setCurrentTextChannel(null);
    setCurrentVoiceChannel(null);
    setMessages([]);
    setUsers([]);
    setAllServerMembers([]);

    // Сохранить выбранный сервер
    localStorage.setItem('lastServerId', server._id);
  };

  const handleCreateServer = (serverData) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    fetch(`${BACKEND_URL}/api/servers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(serverData)
    })
      .then(res => res.json())
      .then(newServer => {
        setServers(prev => [...prev, newServer]);
        setCurrentServer(newServer);

        // Сохранить новый сервер как текущий
        localStorage.setItem('lastServerId', newServer._id);
      })
      .catch(err => console.error('Ошибка создания сервера:', err));
  };

  const handleAvatarUpdate = (updatedUser) => {
    setUser(updatedUser);
  };

  // Проверка сохраненного токена при загрузке
  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');

    if (token && savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        setUser(userData);
        setShowAuthModal(false);
      } catch (err) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
  }, []);

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
    if (!currentServer) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    fetch(`${BACKEND_URL}/api/servers/${currentServer._id}/channels`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ name: channelName, type: channelType }),
    })
      .then(res => res.json())
      .then(newChannel => {
        // Добавить канал в список
        setChannels(prev => [...prev, newChannel]);

        if (newChannel.type === 'text') {
          setCurrentTextChannel(newChannel);
        } else {
          setCurrentVoiceChannel(newChannel);
        }
      })
      .catch(err => console.error('Ошибка создания канала:', err));
  };

  const handleSendMessage = (content) => {
    if (socket && currentTextChannel && user) {
      socket.emit('message:send', {
        channelId: currentTextChannel.id,
        content,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
        badge: user.badge,
        badgeTooltip: user.badgeTooltip,
        userId: user.id
      });
    }
  };

  if (showAuthModal) {
    return <AuthModal onAuth={handleAuth} />;
  }

  // Если у пользователя нет серверов, показываем EmptyServerState
  if (servers.length === 0) {
    return (
      <div className="app">
        <EmptyServerState
          onCreateServer={handleCreateServer}
          user={user}
          onLogout={handleLogout}
          onAvatarUpdate={handleAvatarUpdate}
        />
      </div>
    );
  }

  // Если мобильное устройство, используем мобильный макет
  if (isMobile) {
    return (
      <div className="app">
        <MobileLayout
          servers={servers}
          currentServer={currentServer}
          onSelectServer={handleSelectServer}
          onCreateServer={handleCreateServer}
          channels={channels}
          currentTextChannel={currentTextChannel}
          currentVoiceChannel={currentVoiceChannel}
          voiceChannelUsers={voiceChannelUsers}
          speakingUsers={speakingUsers}
          user={user}
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
          onLogout={handleLogout}
          onAvatarUpdate={handleAvatarUpdate}
          onSelectChannel={handleChannelSelect}
          onCreateChannel={handleCreateChannel}
          onlineUsers={users}
          allServerMembers={allServerMembers}
          socket={socket}
          messages={messages}
          onSendMessage={handleSendMessage}
        />

        {/* Голосовой канал (скрытый, работает в фоне) */}
        {currentVoiceChannel && (
          <VoiceChannel
            socket={socket}
            channel={currentVoiceChannel}
            user={user}
            globalMuted={globalMuted}
            globalDeafened={globalDeafened}
            onDisconnectRef={voiceDisconnectRef}
            onSpeakingUpdate={(speaking) => {
              speakingUsersRef.current[currentVoiceChannel.id] = speaking;
              setSpeakingUsers({...speakingUsersRef.current});
            }}
          />
        )}
      </div>
    );
  }

  // Десктопная версия
  return (
    <div className="app">
      <ServerSidebar
        servers={servers}
        currentServer={currentServer}
        onSelectServer={handleSelectServer}
        onCreateServer={handleCreateServer}
      />

      <ChannelList
        channels={channels}
        currentTextChannel={currentTextChannel}
        currentVoiceChannel={currentVoiceChannel}
        voiceChannelUsers={voiceChannelUsers}
        speakingUsers={speakingUsers}
        user={user}
        isMuted={globalMuted}
        isDeafened={globalDeafened}
        isInVoice={!!currentVoiceChannel}
        serverName={currentServer?.name}
        currentServer={currentServer}
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
        onLogout={handleLogout}
        onAvatarUpdate={handleAvatarUpdate}
        onSelectChannel={handleChannelSelect}
        onCreateChannel={handleCreateChannel}
      />
      {/* Голосовой канал (скрытый, работает в фоне) */}
      {currentVoiceChannel && (
        <VoiceChannel
          socket={socket}
          channel={currentVoiceChannel}
          user={user}
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
        username={user?.username}
        onSendMessage={handleSendMessage}
        hasServer={!!currentServer}
        socket={socket}
      />

      <UserList
        onlineUsers={users}
        allMembers={allServerMembers}
      />
    </div>
  );
}

export default App;

