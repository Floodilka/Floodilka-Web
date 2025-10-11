import React, { useState } from 'react';
import './MobileLayout.css';
import ServerSidebar from './ServerSidebar';
import ChannelList from './ChannelList';
import Chat from './Chat';
import UserList from './UserList';
import DirectMessages from './DirectMessages';

function MobileLayout({
  servers,
  currentServer,
  onSelectServer,
  onCreateServer,
  user,
  onSelectDirectMessages,
  showDirectMessages,
  channels,
  currentTextChannel,
  currentVoiceChannel,
  activeVoiceChannel,
  voiceChannelUsers,
  speakingUsers,
  isMuted,
  isDeafened,
  isInVoice,
  onToggleMute,
  onToggleDeafen,
  onDisconnect,
  onLogout,
  onAvatarUpdate,
  onSelectChannel,
  onCreateChannel,
  onlineUsers,
  allServerMembers,
  socket,
  messages,
  onSendMessage,
  hasTextChannels,
  serverLoading,
  autoSelectUser,
  onAutoSelectComplete,
  onUnreadDMsUpdate,
  exitDirectMessages
}) {
  const [isChatMode, setIsChatMode] = useState(false);
  const [isDMChatMode, setIsDMChatMode] = useState(false);
  const [selectedDMUser, setSelectedDMUser] = useState(null);

  // Вычисляем, говорит ли текущий пользователь
  const isSpeaking = activeVoiceChannel && speakingUsers[activeVoiceChannel.id]?.has('me');

  const handleChannelSelect = (channel) => {
    onSelectChannel(channel);
    if (channel.type === 'text') {
      setIsChatMode(true);
    }
  };

  const handleBackToChannels = () => {
    setIsChatMode(false);
  };

  const handleBackToDMList = () => {
    setIsDMChatMode(false);
    setSelectedDMUser(null);
  };

  const handleDMUserSelect = (dm) => {
    setSelectedDMUser(dm);
    setIsDMChatMode(true);
  };

  // Если открыты личные сообщения
  if (showDirectMessages) {
    // Если выбран конкретный пользователь для чата
    if (isDMChatMode && selectedDMUser) {
      return (
        <div className="mobile-layout mobile-dm-mode">
          <div className="mobile-dm-fullscreen">
            <div className="mobile-dm-header">
              <button
                className="mobile-dm-back-btn"
                onClick={handleBackToDMList}
                title="Назад к списку"
              >
                ←
              </button>
              <div className="mobile-dm-title">
                {selectedDMUser.user?.displayName || selectedDMUser.user?.username || 'Пользователь'}
              </div>
              <div className="mobile-dm-spacer"></div>
            </div>

            <div className="mobile-dm-chat-content">
              <DirectMessages
                user={user}
                socket={socket}
                onLogout={onLogout}
                onAvatarUpdate={onAvatarUpdate}
                autoSelectUser={selectedDMUser}
                onAutoSelectComplete={onAutoSelectComplete}
                onUnreadDMsUpdate={onUnreadDMsUpdate}
                isMuted={isMuted}
                isDeafened={isDeafened}
                isInVoice={isInVoice}
                isSpeaking={isSpeaking}
                onToggleMute={onToggleMute}
                onToggleDeafen={onToggleDeafen}
                onDisconnect={onDisconnect}
                onDMUserSelect={handleDMUserSelect}
                showOnlyChat={true}
              />
            </div>
          </div>
        </div>
      );
    }

    // Показываем список пользователей
    return (
      <div className="mobile-layout mobile-dm-mode">
        <div className="mobile-dm-fullscreen">
          <div className="mobile-dm-header">
            <button
              className="mobile-dm-close-btn"
              onClick={exitDirectMessages}
              title="Закрыть личные сообщения"
            >
              ✕
            </button>
            <div className="mobile-dm-title">Личные сообщения</div>
            <div className="mobile-dm-spacer"></div>
          </div>

          <div className="mobile-dm-content">
            <DirectMessages
              user={user}
              socket={socket}
              onLogout={onLogout}
              onAvatarUpdate={onAvatarUpdate}
              onUnreadDMsUpdate={onUnreadDMsUpdate}
              isMuted={isMuted}
              isDeafened={isDeafened}
              isInVoice={isInVoice}
              isSpeaking={isSpeaking}
              onToggleMute={onToggleMute}
              onToggleDeafen={onToggleDeafen}
              onDisconnect={onDisconnect}
              onDMUserSelect={handleDMUserSelect}
              showOnlyList={true}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-layout">
      {!isChatMode ? (
        <>
          {/* Левая панель с серверами */}
          <div className="mobile-servers-panel">
        <ServerSidebar
          servers={servers}
          currentServer={currentServer}
          onSelectServer={onSelectServer}
          onCreateServer={onCreateServer}
          user={user}
          onSelectDirectMessages={onSelectDirectMessages}
          showDirectMessages={showDirectMessages}
          activeVoiceChannel={activeVoiceChannel}
        />
          </div>

          {/* Основная секция с каналами */}
          <div className="mobile-channels-panel">
            <ChannelList
              channels={channels}
              currentTextChannel={currentTextChannel}
              currentVoiceChannel={currentVoiceChannel}
              voiceChannelUsers={voiceChannelUsers}
              speakingUsers={speakingUsers}
              user={user}
              isMuted={isMuted}
              isDeafened={isDeafened}
              isInVoice={isInVoice}
              serverName={currentServer?.name}
              currentServer={currentServer}
              onToggleMute={onToggleMute}
              onToggleDeafen={onToggleDeafen}
              onDisconnect={onDisconnect}
              onLogout={onLogout}
              onAvatarUpdate={onAvatarUpdate}
              onSelectChannel={handleChannelSelect}
              onCreateChannel={onCreateChannel}
            />
          </div>
        </>
      ) : (
        /* Полноэкранный режим чата */
        <div className="mobile-chat-fullscreen">
          <div className="mobile-chat-header">
            <button
              className="mobile-back-to-channels-btn"
              onClick={handleBackToChannels}
            >
              ☰
            </button>
            <div className="mobile-chat-title">
              #{currentTextChannel?.name || 'chat'}
            </div>
            <div className="mobile-chat-spacer"></div>
          </div>

          <div className="mobile-chat-content">
            <Chat
              channel={currentTextChannel}
              messages={messages}
              username={user?.username}
              user={user}
              currentServer={currentServer}
              onSendMessage={onSendMessage}
              hasServer={!!currentServer}
              hasTextChannels={hasTextChannels}
              serverLoading={serverLoading}
              socket={socket}
            />
          </div>
        </div>
      )}
      {/* Список пользователей (скрыт на мобильных) */}
      <div className="mobile-user-list-hidden">
        <UserList
          onlineUsers={onlineUsers}
          allMembers={allServerMembers}
          currentUser={user}
          currentServer={currentServer}
        />
      </div>
    </div>
  );
}

export default MobileLayout;
