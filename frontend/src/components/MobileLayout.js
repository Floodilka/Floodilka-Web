import React, { useState } from 'react';
import './MobileLayout.css';
import ServerSidebar from './ServerSidebar';
import ChannelList from './ChannelList';
import Chat from './Chat';
import VoiceChannel from './VoiceChannel';
import UserList from './UserList';

function MobileLayout({
  servers,
  currentServer,
  onSelectServer,
  onCreateServer,
  channels,
  currentTextChannel,
  currentVoiceChannel,
  voiceChannelUsers,
  speakingUsers,
  user,
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
  onSendMessage
}) {
  const [isChatMode, setIsChatMode] = useState(false);

  const handleChannelSelect = (channel) => {
    onSelectChannel(channel);
    if (channel.type === 'text') {
      setIsChatMode(true);
    }
  };

  const handleBackToChannels = () => {
    setIsChatMode(false);
  };

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
              onSendMessage={onSendMessage}
              hasServer={!!currentServer}
              socket={socket}
            />
          </div>
        </div>
      )}



      {/* Голосовой канал (скрытый, работает в фоне) */}
      {currentVoiceChannel && (
        <VoiceChannel
          socket={socket}
          channel={currentVoiceChannel}
          user={user}
          globalMuted={isMuted}
          globalDeafened={isDeafened}
          onDisconnectRef={null}
          onSpeakingUpdate={() => {}}
        />
      )}

      {/* Список пользователей (скрыт на мобильных) */}
      <div className="mobile-user-list-hidden">
        <UserList
          onlineUsers={onlineUsers}
          allMembers={allServerMembers}
        />
      </div>
    </div>
  );
}

export default MobileLayout;
