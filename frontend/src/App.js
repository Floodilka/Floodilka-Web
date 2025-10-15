import React, { useEffect, useMemo, useCallback, useRef } from 'react';
import { Routes, Route, useNavigate, useParams, Navigate } from 'react-router-dom';
import './App.css';

// Contexts
import { AppProvider, useSettings } from './context/AppContext';
import { useAuth } from './context/AuthContext';
import { useGlobalUsers } from './context/GlobalUsersContext';
import { useServer } from './context/ServerContext';
import { useChat } from './context/ChatContext';
import { useVoice } from './context/VoiceContext';
import { useFriends } from './context/FriendsContext';

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
  const { incomingRequests } = useFriends();
  const { isSettingsOpen } = useSettings();
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
  const socket = useSocket(); // Получаем уже инициализированный сокет

  // Мемоизируем обработчики для предотвращения лишних перерендеров
  const handleServerSelect = useCallback((server) => {
    console.log(`[APP] Switching to server:`, {
      serverId: server._id,
      serverName: server.name,
      from: 'DirectMessagesRoute'
    });
    localStorage.setItem('lastServerId', server._id);
    navigate(`/channels/${server._id}`);
  }, [navigate]);

  const handleSelectDirectMessages = useCallback(() => {
    console.log(`[APP] Switching to Direct Messages from:`, 'DirectMessagesRoute');
    navigate('/channels/@me');
  }, [navigate]);

  const handleAutoSelectComplete = useCallback(() => {}, []);

  const handleExitDirectMessages = useCallback(() => {
    navigate(`/channels/${servers[0]?._id}`);
  }, [navigate, servers]);

  // Мемоизируем объекты и вычисляемые значения
  const autoSelectUser = useMemo(() =>
    userId ? { userId } : null
  , [userId]);

  const isSpeaking = useMemo(() =>
    activeVoiceChannel && speakingUsers[activeVoiceChannel.id]?.has('me')
  , [activeVoiceChannel, speakingUsers]);

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
          onRefreshMembers={async () => []}
          onUpdateChannel={() => {}}
          onDeleteChannel={() => {}}
          onlineUsers={[]}
          allServerMembers={[]}
          socket={socket}
          messages={[]}
          onSendMessage={() => {}}
          autoSelectUser={autoSelectUser}
          onAutoSelectComplete={handleAutoSelectComplete}
          onUnreadDMsUpdate={setHasUnreadDMs}
          exitDirectMessages={handleExitDirectMessages}
          isLoadingMessages={false}
          preloadedMessages={false}
        />
      </div>
    );
  }

  // Десктоп версия
  const hasNotifications = hasUnreadDMs || incomingRequests.length > 0;

  return (
    <div className="app">
      {!isSettingsOpen && (
        <ServerSidebar
          servers={servers}
          currentServer={null}
          onSelectServer={handleServerSelect}
          onCreateServer={createServer}
          user={user}
          onSelectDirectMessages={handleSelectDirectMessages}
          showDirectMessages={true}
          hasUnreadDMs={hasNotifications}
          activeVoiceChannel={activeVoiceChannel}
        />
      )}
      <DirectMessages
        user={user}
        socket={socket}
        onLogout={logout}
        onAvatarUpdate={updateUser}
        autoSelectUser={autoSelectUser}
        onAutoSelectComplete={handleAutoSelectComplete}
        onUnreadDMsUpdate={setHasUnreadDMs}
        isMuted={globalMuted}
        isDeafened={globalDeafened}
        isInVoice={!!activeVoiceChannel}
        isSpeaking={isSpeaking}
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
    deleteChannel,
    refreshServerMembers
  } = useServer();
  const {
    currentTextChannel,
    messages,
    hasUnreadDMs,
    preloadedMessages,
    isLoadingMessages,
    selectTextChannel,
    clearChannelState,
    sendMessage: handleMessageSent
  } = useChat();
  const { incomingRequests } = useFriends();
  const { isSettingsOpen } = useSettings();
  const {
    currentVoiceChannel,
    activeVoiceChannel,
    voiceChannelUsers,
    speakingUsers,
    globalMuted,
    globalDeafened,
    isScreenSharing,
    screenSharingUsers,
    voiceDisconnectRef,
    joinVoiceChannel,
    leaveVoiceChannel,
    toggleMute,
    toggleDeafen,
    toggleScreenShare,
    updateSpeakingUsers
  } = useVoice();
  const { isMobile } = useDevice();
  const socket = useSocket(); // Получаем уже инициализированный сокет
  const { sendMessage } = useChannel();
  const { globalOnlineUsers } = useGlobalUsers();

  // Используем ref для clearChannelState чтобы избежать лишних вызовов useEffect
  const clearChannelStateRef = useRef(clearChannelState);
  clearChannelStateRef.current = clearChannelState;

  // 🔍 ЛОГ: Отслеживаем изменения isSettingsOpen в ServerRoute
  useEffect(() => {
    console.log('[🔍 SETTINGS DEBUG] isSettingsOpen изменился в ServerRoute:', {
      isSettingsOpen,
      channelId: currentTextChannel?.id,
      messagesCount: messages.length,
      serverId,
      channelIdParam: channelId,
      timestamp: new Date().toISOString()
    });
  }, [isSettingsOpen, currentTextChannel?.id, messages.length, serverId, channelId]);

  // Синхронизируем URL с выбранным сервером
  useEffect(() => {
    console.log('[🔍 SERVER SYNC DEBUG] useEffect сервера сработал:', {
      serverId,
      serversCount: servers.length,
      currentServerId: currentServer?._id,
      willClearChannel: currentServer?._id !== serverId
    });

    if (serverId && servers.length > 0) {
      const server = servers.find(s => s._id === serverId);
      if (!server) {
        // Сервер недоступен или не существует — редиректим в ЛС
        console.log('[🔍 SERVER SYNC DEBUG] Сервер не найден, редирект в ЛС');
        navigate('/channels/@me', { replace: true });
        return;
      }

      if (currentServer?._id !== serverId) {
        console.log('[🔍 SERVER SYNC DEBUG] Меняем сервер, будет вызван clearChannelState');
        // Сначала выбираем новый сервер
        selectServer(server);
        // Очищаем только текущее состояние канала (не весь кеш!)
        requestAnimationFrame(() => {
          console.log('[🔍 SERVER SYNC DEBUG] ВЫЗЫВАЕМ clearChannelState()');
          clearChannelStateRef.current();
        });
      }
    }
  }, [serverId, servers, currentServer, selectServer]);

  // Синхронизируем URL с выбранным каналом и корректно обрабатываем отсутствие текстовых каналов
  useEffect(() => {
    console.log('[🔍 CHANNEL SYNC DEBUG] useEffect канала сработал:', {
      currentServer: currentServer?._id,
      channelsCount: channels.length,
      channelId,
      currentTextChannelId: currentTextChannel?.id
    });

    if (!currentServer) return;

    // Если каналов нет вообще: чистим состояние и уходим на страницу сервера без channelId
    if (channels.length === 0) {
      if (channelId) {
        navigate(`/channels/${serverId}`, { replace: true });
      }
      if (currentTextChannel) {
        console.log('[🔍 CHANNEL SYNC DEBUG] Нет каналов, ВЫЗЫВАЕМ clearChannelState()');
        clearChannelStateRef.current();
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
          console.log('[🔍 CHANNEL SYNC DEBUG] Канал не найден, ВЫЗЫВАЕМ clearChannelState()');
          clearChannelStateRef.current();
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
        console.log('[🔍 CHANNEL SYNC DEBUG] Канал изменился, выбираем новый:', channelId);
        if (channel.type === 'voice') {
          if (activeVoiceChannel?.id !== channel.id) {
            joinVoiceChannel(channel);
          }
        } else {
          localStorage.setItem('lastChannelId', channel.id);
          selectTextChannel(channel);
        }
      }
      return;
    }

    // Если channelId нет в URL, но каналы есть — редиректим на первый текстовый канал (если он есть)
    const firstTextChannel = channels.find(c => c.type === 'text');
    if (firstTextChannel) {
      localStorage.setItem('lastChannelId', firstTextChannel.id);
      navigate(`/channels/${serverId}/${firstTextChannel.id}`, { replace: true });
    } else {
      // Нет текстовых каналов — чистим возможное старое состояние выбранного канала
      if (currentTextChannel) {
        console.log('[🔍 CHANNEL SYNC DEBUG] Нет текстовых каналов, ВЫЗЫВАЕМ clearChannelState()');
        clearChannelStateRef.current();
      }
    }
  }, [channelId, channels, currentTextChannel, selectTextChannel, joinVoiceChannel, activeVoiceChannel, navigate, serverId, currentServer]);

  const handleServerSelect = (server) => {
    console.log(`[APP] Switching to server:`, {
      serverId: server._id,
      serverName: server.name,
      from: 'MainApp'
    });
    localStorage.setItem('lastServerId', server._id);
    navigate(`/channels/${server._id}`);
  };

  const handleChannelSelect = (channel) => {
    console.log(`[APP] Selecting channel:`, {
      channelId: channel.id,
      channelName: channel.name,
      channelType: channel.type,
      serverId
    });
    if (channel.type === 'voice') {
      if (activeVoiceChannel?.id === channel.id) {
        return;
      }
      joinVoiceChannel(channel);
      // Для голосовых каналов не меняем URL, остаемся на текстовом канале
    } else {
      localStorage.setItem('lastChannelId', channel.id);
      navigate(`/channels/${serverId}/${channel.id}`);
    }
  };

  const handleSelectDirectMessages = () => {
    console.log(`[APP] Switching to Direct Messages from:`, 'MainApp');
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
          onRefreshMembers={refreshServerMembers}
          onUpdateChannel={updateChannel}
          onDeleteChannel={deleteChannel}
          onlineUsers={globalOnlineUsers}
          allServerMembers={allServerMembers}
          socket={socket}
          messages={messages}
          onSendMessage={sendMessage}
          hasTextChannels={!serverLoading && channels.some(c => c.type === 'text')}
          serverLoading={serverLoading}
          isLoadingMessages={isLoadingMessages}
          preloadedMessages={preloadedMessages}
        />
      </div>
    );
  }

  // Десктоп версия
  const hasNotifications = hasUnreadDMs || incomingRequests.length > 0;

  return (
    <div className="app">
      {!isSettingsOpen && (
        <ServerSidebar
          servers={servers}
          currentServer={currentServer}
          onSelectServer={handleServerSelect}
          onCreateServer={createServer}
          user={user}
          onSelectDirectMessages={handleSelectDirectMessages}
          showDirectMessages={false}
          hasUnreadDMs={hasNotifications}
          activeVoiceChannel={activeVoiceChannel}
        />
      )}

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
        isScreenSharing={isScreenSharing}
        screenSharingUsers={screenSharingUsers}
        serverName={currentServer?.name}
        currentServer={currentServer}
        serverMembers={allServerMembers}
        onToggleMute={toggleMute}
        onToggleDeafen={toggleDeafen}
        onToggleScreenShare={toggleScreenShare}
        onDisconnect={leaveVoiceChannel}
        onLogout={logout}
        onAvatarUpdate={updateUser}
        onSelectChannel={handleChannelSelect}
        onCreateChannel={createChannel}
        onUpdateChannel={updateChannel}
        onDeleteChannel={deleteChannel}
        onMessageSent={handleMessageSent}
        onRefreshMembers={refreshServerMembers}
      />

      <Chat
        channel={currentTextChannel}
        messages={messages}
        username={user?.username}
        user={user}
        currentServer={currentServer}
        channels={channels}
        onSendMessage={sendMessage}
        hasServer={!!currentServer}
        hasTextChannels={!serverLoading && channels.some(c => c.type === 'text')}
        serverLoading={serverLoading}
        socket={socket}
        onMessageSent={handleMessageSent}
        preloadedMessages={preloadedMessages}
        isLoadingMessages={isLoadingMessages}
      />

      <UserList
        onlineUsers={globalOnlineUsers}
        allMembers={allServerMembers}
        currentUser={user}
        currentServer={currentServer}
        onMessageSent={handleMessageSent}
        onRefreshMembers={refreshServerMembers}
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

// Обёртка для VoiceChannel вне маршрутов
const VoiceChannelWrapper = () => {
  const { currentVoiceChannel, globalMuted, globalDeafened, voiceDisconnectRef, updateSpeakingUsers } = useVoice();
  const { user } = useAuth();
  const socket = useSocket(); // Получаем уже инициализированный сокет

  if (!currentVoiceChannel) return null;

  return (
    <VoiceChannel
      socket={socket}
      channel={currentVoiceChannel}
      user={user}
      globalMuted={globalMuted}
      globalDeafened={globalDeafened}
      onDisconnectRef={voiceDisconnectRef}
      onSpeakingUpdate={updateSpeakingUsers}
    />
  );
};

function App() {
  return (
    <AppProvider>
      <AppContent />
      {/* VoiceChannel живёт здесь и не размонтируется при смене маршрутов */}
      <VoiceChannelWrapper />
    </AppProvider>
  );
}

export default App;
