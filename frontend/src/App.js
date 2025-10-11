import React, { useEffect } from 'react';
import { Routes, Route, useNavigate, useParams, Navigate } from 'react-router-dom';
import './App.css';

// Contexts
import { AppProvider } from './context/AppContext';
import { useAuth } from './context/AuthContext';
import { GlobalUsersProvider, useGlobalUsers } from './context/GlobalUsersContext';
import { useServer } from './context/ServerContext';
import { useChat } from './context/ChatContext';
import { useVoice } from './context/VoiceContext';

// Hooks
import { useSocket } from './hooks/useSocket';
import { useChannel } from './hooks/useChannel';
import { useDevice } from './hooks/useDevice';

// Components
import ServerSidebar from './components/ServerSidebar';
import ChannelList from './components/ChannelList';
import Chat from './components/Chat';
import VoiceChannel from './components/VoiceChannel';
import UserList from './components/UserList';
import DirectMessages from './components/DirectMessages';
import AuthModal from './components/Auth/AuthModal';
import EmptyServerState from './components/EmptyServerState';
import MobileLayout from './components/MobileLayout';

// Компонент для маршрута личных сообщений
const DirectMessagesRoute = () => {
  const navigate = useNavigate();
  const { userId } = useParams(); // ID пользователя из URL
  const { user, logout, updateUser } = useAuth();
  const { servers, createServer } = useServer();
  const { hasUnreadDMs, setHasUnreadDMs } = useChat();
  const {
    activeVoiceChannel,
    globalMuted,
    globalDeafened,
    voiceChannelUsers,
    speakingUsers,
    toggleMute,
    toggleDeafen,
    leaveVoiceChannel,
    currentVoiceChannel,
    voiceDisconnectRef,
    updateSpeakingUsers
  } = useVoice();
  const { isMobile } = useDevice();
  const socket = useSocket();

  const handleServerSelect = (server) => {
    // Навигация на сервер через URL
    navigate(`/channels/${server._id}`);
  };

  const handleSelectDirectMessages = () => {
    navigate('/channels/@me');
  };

  // Для мобильной версии
  if (isMobile) {
    return (
      <div className="app">
        <MobileLayout
          servers={servers}
          currentServer={null}
          onSelectServer={handleServerSelect}
          onCreateServer={createServer}
          user={user}
          onSelectDirectMessages={handleSelectDirectMessages}
          showDirectMessages={true}
          channels={[]}
          currentTextChannel={null}
          currentVoiceChannel={currentVoiceChannel}
          activeVoiceChannel={activeVoiceChannel}
          voiceChannelUsers={voiceChannelUsers}
          speakingUsers={speakingUsers}
          isMuted={globalMuted}
          isDeafened={globalDeafened}
          isInVoice={!!activeVoiceChannel}
          onToggleMute={toggleMute}
          onToggleDeafen={toggleDeafen}
          onDisconnect={leaveVoiceChannel}
          onLogout={logout}
          onAvatarUpdate={updateUser}
          onSelectChannel={() => {}}
          onCreateChannel={() => {}}
          onUpdateChannel={() => {}}
          onDeleteChannel={() => {}}
          onlineUsers={[]}
          allServerMembers={[]}
          socket={socket}
          messages={[]}
          onSendMessage={() => {}}
          autoSelectUser={userId ? { userId } : null}
          onAutoSelectComplete={() => {}}
          onUnreadDMsUpdate={setHasUnreadDMs}
          exitDirectMessages={() => navigate(`/channels/${servers[0]?._id}`)}
        />
        {currentVoiceChannel && (
          <VoiceChannel
            socket={socket}
            channel={currentVoiceChannel}
            user={user}
            globalMuted={globalMuted}
            globalDeafened={globalDeafened}
            onDisconnectRef={voiceDisconnectRef}
            onSpeakingUpdate={updateSpeakingUsers}
          />
        )}
      </div>
    );
  }

  // Десктоп версия
  return (
    <div className="app">
      <ServerSidebar
        servers={servers}
        currentServer={null}
        onSelectServer={handleServerSelect}
        onCreateServer={createServer}
        user={user}
        onSelectDirectMessages={handleSelectDirectMessages}
        showDirectMessages={true}
        hasUnreadDMs={hasUnreadDMs}
        activeVoiceChannel={activeVoiceChannel}
      />
      <DirectMessages
        user={user}
        socket={socket}
        onLogout={logout}
        onAvatarUpdate={updateUser}
        autoSelectUser={userId ? { userId } : null}
        onAutoSelectComplete={() => {}}
        onUnreadDMsUpdate={setHasUnreadDMs}
        isMuted={globalMuted}
        isDeafened={globalDeafened}
        isInVoice={!!activeVoiceChannel}
        isSpeaking={activeVoiceChannel && speakingUsers[activeVoiceChannel.id]?.has('me')}
        onToggleMute={toggleMute}
        onToggleDeafen={toggleDeafen}
        onDisconnect={leaveVoiceChannel}
      />
    </div>
  );
};

// Редирект с "/channels" на личные сообщения
const ChannelsRootRoute = () => {
  const navigate = useNavigate();
  const { servers } = useServer();

  useEffect(() => {
    // Независимо от наличия серверов ведём в ЛС
    navigate('/channels/@me', { replace: true });
  }, [servers, navigate]);

  return null;
};

// Компонент для маршрута сервера
const ServerRoute = () => {
  const navigate = useNavigate();
  const { serverId, channelId } = useParams();
  const { user, logout, updateUser } = useAuth();
  const {
    servers,
    currentServer,
    channels,
    allServerMembers,
    loading: serverLoading,
    selectServer,
    createServer,
    createChannel,
    updateChannel,
    deleteChannel
  } = useServer();
  const {
    currentTextChannel,
    messages,
    hasUnreadDMs,
    selectTextChannel,
    clearChannelState,
    sendMessage: handleMessageSent
  } = useChat();
  const {
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
    updateSpeakingUsers
  } = useVoice();
  const { isMobile } = useDevice();
  const socket = useSocket();
  const { sendMessage } = useChannel();
  const { globalOnlineUsers } = useGlobalUsers();

  // Синхронизируем URL с выбранным сервером
  useEffect(() => {
    if (serverId && servers.length > 0) {
      const server = servers.find(s => s._id === serverId);
      if (!server) {
        // Сервер недоступен или не существует — редиректим в ЛС
        navigate('/channels/@me', { replace: true });
        return;
      }

      if (currentServer?._id !== serverId) {
        // Очищаем состояние канала при смене сервера
        clearChannelState();
        selectServer(server);
      }
    }
  }, [serverId, servers, currentServer, selectServer, clearChannelState]);

  // Синхронизируем URL с выбранным каналом и корректно обрабатываем отсутствие текстовых каналов
  useEffect(() => {
    if (!currentServer) return;

    // Если каналов нет вообще: чистим состояние и уходим на страницу сервера без channelId
    if (channels.length === 0) {
      if (channelId) {
        navigate(`/channels/${serverId}`, { replace: true });
      }
      if (currentTextChannel) {
        clearChannelState();
      }
      return;
    }

    // Если channelId есть в URL
    if (channelId) {
      const channel = channels.find(c => c.id === channelId);

      // Если канал с таким ID не существует в текущем сервере
      if (!channel) {
        // Сбрасываем состояние выбранного текстового канала
        if (currentTextChannel) {
          clearChannelState();
        }
        // Редиректим на первый текстовый канал, если он есть, иначе на страницу сервера
        const firstTextChannel = channels.find(c => c.type === 'text');
        if (firstTextChannel) {
          navigate(`/channels/${serverId}/${firstTextChannel.id}`, { replace: true });
        } else {
          navigate(`/channels/${serverId}`, { replace: true });
        }
        return;
      }

      // Если канал найден, выбираем его
      if (currentTextChannel?.id !== channelId) {
        if (channel.type === 'voice') {
          if (activeVoiceChannel?.id !== channel.id) {
            joinVoiceChannel(channel);
          }
        } else {
          selectTextChannel(channel);
        }
      }
      return;
    }

    // Если channelId нет в URL, но каналы есть — редиректим на первый текстовый канал (если он есть)
    const firstTextChannel = channels.find(c => c.type === 'text');
    if (firstTextChannel) {
      navigate(`/channels/${serverId}/${firstTextChannel.id}`, { replace: true });
    } else {
      // Нет текстовых каналов — чистим возможное старое состояние выбранного канала
      if (currentTextChannel) {
        clearChannelState();
      }
    }
  }, [channelId, channels, currentTextChannel, selectTextChannel, joinVoiceChannel, activeVoiceChannel, navigate, serverId, currentServer, clearChannelState]);

  const handleServerSelect = (server) => {
    navigate(`/channels/${server._id}`);
  };

  const handleChannelSelect = (channel) => {
    if (channel.type === 'voice') {
      if (activeVoiceChannel?.id === channel.id) {
        return;
      }
      joinVoiceChannel(channel);
      // Для голосовых каналов не меняем URL, остаемся на текстовом канале
    } else {
      navigate(`/channels/${serverId}/${channel.id}`);
    }
  };

  const handleSelectDirectMessages = () => {
    navigate('/channels/@me');
  };

  // Мобильная версия
  if (isMobile) {
    return (
      <div className="app">
        <MobileLayout
          servers={servers}
          currentServer={currentServer}
          onSelectServer={handleServerSelect}
          onCreateServer={createServer}
          user={user}
          onSelectDirectMessages={handleSelectDirectMessages}
          showDirectMessages={false}
          channels={channels}
          currentTextChannel={currentTextChannel}
          currentVoiceChannel={currentVoiceChannel}
          activeVoiceChannel={activeVoiceChannel}
          voiceChannelUsers={voiceChannelUsers}
          speakingUsers={speakingUsers}
          isMuted={globalMuted}
          isDeafened={globalDeafened}
          isInVoice={!!activeVoiceChannel}
          onToggleMute={toggleMute}
          onToggleDeafen={toggleDeafen}
          onDisconnect={leaveVoiceChannel}
          onLogout={logout}
          onAvatarUpdate={updateUser}
          onSelectChannel={handleChannelSelect}
          onCreateChannel={createChannel}
          onUpdateChannel={updateChannel}
          onDeleteChannel={deleteChannel}
          onlineUsers={globalOnlineUsers}
          allServerMembers={allServerMembers}
          socket={socket}
          messages={messages}
          onSendMessage={sendMessage}
          hasTextChannels={!serverLoading && channels.some(c => c.type === 'text')}
          serverLoading={serverLoading}
        />
        {currentVoiceChannel && (
          <VoiceChannel
            socket={socket}
            channel={currentVoiceChannel}
            user={user}
            globalMuted={globalMuted}
            globalDeafened={globalDeafened}
            onDisconnectRef={voiceDisconnectRef}
            onSpeakingUpdate={updateSpeakingUsers}
          />
        )}
      </div>
    );
  }

  // Десктоп версия
  return (
    <div className="app">
      <ServerSidebar
        servers={servers}
        currentServer={currentServer}
        onSelectServer={handleServerSelect}
        onCreateServer={createServer}
        user={user}
        onSelectDirectMessages={handleSelectDirectMessages}
        showDirectMessages={false}
        hasUnreadDMs={hasUnreadDMs}
        activeVoiceChannel={activeVoiceChannel}
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
        isInVoice={!!activeVoiceChannel}
        serverName={currentServer?.name}
        currentServer={currentServer}
        onToggleMute={toggleMute}
        onToggleDeafen={toggleDeafen}
        onDisconnect={leaveVoiceChannel}
        onLogout={logout}
        onAvatarUpdate={updateUser}
        onSelectChannel={handleChannelSelect}
        onCreateChannel={createChannel}
        onUpdateChannel={updateChannel}
        onDeleteChannel={deleteChannel}
        onMessageSent={handleMessageSent}
      />

      {currentVoiceChannel && (
        <VoiceChannel
          socket={socket}
          channel={currentVoiceChannel}
          user={user}
          globalMuted={globalMuted}
          globalDeafened={globalDeafened}
          onDisconnectRef={voiceDisconnectRef}
          onSpeakingUpdate={updateSpeakingUsers}
        />
      )}

      <Chat
        channel={currentTextChannel}
        messages={messages}
        username={user?.username}
        user={user}
        currentServer={currentServer}
        onSendMessage={sendMessage}
        hasServer={!!currentServer}
        hasTextChannels={!serverLoading && channels.some(c => c.type === 'text')}
        serverLoading={serverLoading}
        socket={socket}
        onMessageSent={handleMessageSent}
      />

      <UserList
        onlineUsers={globalOnlineUsers}
        allMembers={allServerMembers}
        currentUser={user}
        currentServer={currentServer}
        onMessageSent={handleMessageSent}
      />
    </div>
  );
};

const AppContent = () => {
  const { user, showAuthModal, logout, updateUser } = useAuth();
  const { servers, createServer } = useServer();
  const navigate = useNavigate();

  // Редирект на первый сервер при загрузке, если нет маршрута
  useEffect(() => {
    if (user && servers.length > 0 && window.location.pathname === '/') {
      navigate(`/channels/${servers[0]._id}`, { replace: true });
    }
  }, [user, servers, navigate]);

  if (showAuthModal) {
    return <AuthModal />;
  }

  // Если у пользователя нет серверов
  if (!servers || servers.length === 0) {
    return (
      <div className="app">
        <EmptyServerState
          onCreateServer={createServer}
          user={user}
          onLogout={logout}
          onAvatarUpdate={updateUser}
        />
      </div>
    );
  }

  // Маршрутизация
  return (
    <Routes>
      <Route path="/" element={<Navigate to={`/channels/${servers[0]._id}`} replace />} />
      <Route path="/channels" element={<ChannelsRootRoute />} />
      <Route path="/channels/@me" element={<DirectMessagesRoute />} />
      <Route path="/channels/@me/:userId" element={<DirectMessagesRoute />} />
      <Route path="/channels/:serverId" element={<ServerRoute />} />
      <Route path="/channels/:serverId/:channelId" element={<ServerRoute />} />
      {/* Любой неизвестный/недоступный маршрут ведёт в ЛС */}
      <Route path="*" element={<Navigate to="/channels/@me" replace />} />
    </Routes>
  );
};

function App() {
  return (
    <AppProvider>
      <GlobalUsersProvider>
        <AppContent />
      </GlobalUsersProvider>
    </AppProvider>
  );
}

export default App;

