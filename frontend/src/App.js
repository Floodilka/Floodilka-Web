import React from 'react';
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

const AppContent = () => {
  const { user, showAuthModal, logout, updateUser } = useAuth();
  const {
    servers,
    currentServer,
    channels,
    allServerMembers,
    selectServer,
    createServer,
    createChannel,
    updateChannel,
    deleteChannel
  } = useServer();
  const {
    currentTextChannel,
    messages,
    showDirectMessages,
    autoSelectUser,
    hasUnreadDMs,
    selectTextChannel,
    selectDirectMessages,
    exitDirectMessages,
    sendMessage: handleMessageSent,
    clearAutoSelectUser,
    setHasUnreadDMs
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

  const handleServerSelect = (server) => {
    selectServer(server);
    // Сбрасываем режим личных сообщений при выборе сервера
    exitDirectMessages();
  };

  const handleChannelSelect = (channel) => {
    if (channel.type === 'voice') {
      if (activeVoiceChannel?.id === channel.id) {
        return;
      }
      joinVoiceChannel(channel);
    } else {
      selectTextChannel(channel);
    }
  };

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

  // Если выбран режим личных сообщений
  if (showDirectMessages) {
    // Для мобильных устройств используем MobileLayout
    if (isMobile) {
      return (
        <div className="app">
          <MobileLayout
            servers={servers}
            currentServer={currentServer}
            onSelectServer={handleServerSelect}
            onCreateServer={createServer}
            user={user}
            onSelectDirectMessages={selectDirectMessages}
            showDirectMessages={showDirectMessages}
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
            autoSelectUser={autoSelectUser}
            onAutoSelectComplete={clearAutoSelectUser}
            onUnreadDMsUpdate={setHasUnreadDMs}
            exitDirectMessages={exitDirectMessages}
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
              onSpeakingUpdate={updateSpeakingUsers}
            />
          )}
        </div>
      );
    }

    // Для десктопа используем обычный DirectMessages
    return (
      <div className="app">
        <ServerSidebar
          servers={servers}
          currentServer={currentServer}
          onSelectServer={handleServerSelect}
          onCreateServer={createServer}
          user={user}
          onSelectDirectMessages={selectDirectMessages}
          showDirectMessages={showDirectMessages}
          hasUnreadDMs={hasUnreadDMs}
          activeVoiceChannel={activeVoiceChannel}
        />
        <DirectMessages
          user={user}
          socket={socket}
          onLogout={logout}
          onAvatarUpdate={updateUser}
          autoSelectUser={autoSelectUser}
          onAutoSelectComplete={clearAutoSelectUser}
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
  }

  // Если мобильное устройство
  if (isMobile) {
    return (
      <div className="app">
        <MobileLayout
          servers={servers}
          currentServer={currentServer}
          onSelectServer={handleServerSelect}
          onCreateServer={createServer}
          user={user}
          onSelectDirectMessages={selectDirectMessages}
          showDirectMessages={showDirectMessages}
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
            onSpeakingUpdate={updateSpeakingUsers}
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
        onSelectServer={handleServerSelect}
        onCreateServer={createServer}
        user={user}
        onSelectDirectMessages={selectDirectMessages}
        showDirectMessages={showDirectMessages}
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

      {/* Голосовой канал (скрытый, работает в фоне) */}
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

      {/* Текстовый чат */}
      <Chat
        channel={currentTextChannel}
        messages={messages}
        username={user?.username}
        onSendMessage={sendMessage}
        hasServer={!!currentServer}
        socket={socket}
        onMessageSent={handleMessageSent}
      />

      <UserList
        onlineUsers={globalOnlineUsers}
        allMembers={allServerMembers}
        currentUser={user}
        onMessageSent={handleMessageSent}
      />
    </div>
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

