import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import './App.css';
import ChannelList from './components/ChannelList';
import Chat from './components/Chat';
import VoiceChannel from './components/VoiceChannel';
import UserList from './components/UserList';
import UsernameModal from './components/UsernameModal';

const BACKEND_URL = 'https://boltushka.fitronyx.com';

function App() {
  const [socket, setSocket] = useState(null);
  const [channels, setChannels] = useState([]);
  const [currentChannel, setCurrentChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [username, setUsername] = useState(null);
  const [showUsernameModal, setShowUsernameModal] = useState(true);

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
        // Автоматически выбрать первый канал
        if (data.length > 0 && !currentChannel) {
          setCurrentChannel(data[0]);
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

    socket.on('error', ({ message }) => {
      alert(`Ошибка: ${message}`);
    });

    return () => {
      socket.off('channel:created');
      socket.off('messages:history');
      socket.off('message:new');
      socket.off('users:update');
      socket.off('error');
    };
  }, [socket]);

  // Присоединиться к каналу при выборе
  useEffect(() => {
    if (socket && currentChannel && username) {
      setMessages([]);
      socket.emit('channel:join', {
        channelId: currentChannel.id,
        username
      });
    }
  }, [socket, currentChannel, username]);

  const handleUsernameSubmit = (name) => {
    setUsername(name);
    setShowUsernameModal(false);
  };

  const handleChannelSelect = (channel) => {
    setCurrentChannel(channel);
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
        setCurrentChannel(newChannel);
      })
      .catch(err => console.error('Ошибка создания канала:', err));
  };

  const handleSendMessage = (content) => {
    if (socket && currentChannel) {
      socket.emit('message:send', {
        channelId: currentChannel.id,
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
        currentChannel={currentChannel}
        onSelectChannel={handleChannelSelect}
        onCreateChannel={handleCreateChannel}
      />
      {currentChannel?.type === 'voice' ? (
        <VoiceChannel
          socket={socket}
          channel={currentChannel}
          username={username}
        />
      ) : (
        <Chat
          channel={currentChannel}
          messages={messages}
          username={username}
          onSendMessage={handleSendMessage}
        />
      )}
      {currentChannel?.type !== 'voice' && <UserList users={users} />}
    </div>
  );
}

export default App;

