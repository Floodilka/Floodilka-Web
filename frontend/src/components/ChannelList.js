import React, { useState } from 'react';
import './ChannelList.css';
import UserProfile from './UserProfile';

function ChannelList({ channels, currentTextChannel, currentVoiceChannel, voiceChannelUsers, speakingUsers, username, isMuted, isDeafened, isInVoice, onToggleMute, onToggleDeafen, onDisconnect, onSelectChannel, onCreateChannel }) {
  const [showTextForm, setShowTextForm] = useState(false);
  const [showVoiceForm, setShowVoiceForm] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');

  const handleCreateText = (e) => {
    e.preventDefault();
    const trimmedName = newChannelName.trim();
    if (trimmedName) {
      onCreateChannel(trimmedName, 'text');
      setNewChannelName('');
      setShowTextForm(false);
    }
  };

  const handleCreateVoice = (e) => {
    e.preventDefault();
    const trimmedName = newChannelName.trim();
    if (trimmedName) {
      onCreateChannel(trimmedName, 'voice');
      setNewChannelName('');
      setShowVoiceForm(false);
    }
  };

  const textChannels = channels.filter(ch => ch.type === 'text');
  const voiceChannels = channels.filter(ch => ch.type === 'voice');

  return (
    <div className="channel-list">
      <div className="channel-list-header">
        <h2>Болтушка</h2>
      </div>

      <div className="channels-section">
        <div className="section-header">
          <span>ТЕКСТОВЫЕ КАНАЛЫ</span>
          <button
            className="add-channel-btn"
            onClick={() => {
              setShowTextForm(!showTextForm);
              setShowVoiceForm(false);
              setNewChannelName('');
            }}
            title="Создать текстовый канал"
          >
            +
          </button>
        </div>

        {showTextForm && (
          <form className="create-channel-form" onSubmit={handleCreateText}>
            <input
              type="text"
              placeholder="Название текстового канала"
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              maxLength={30}
              autoFocus
            />
            <div className="form-buttons">
              <button type="submit" disabled={!newChannelName.trim()}>
                Создать
              </button>
              <button type="button" onClick={() => {
                setShowTextForm(false);
                setNewChannelName('');
              }}>
                Отмена
              </button>
            </div>
          </form>
        )}

        <div className="channels">
          {textChannels.map(channel => (
            <div
              key={channel.id}
              className={`channel-item ${currentTextChannel?.id === channel.id ? 'active' : ''}`}
              onClick={() => onSelectChannel(channel)}
            >
              <span className="channel-icon">#</span>
              <span className="channel-name">{channel.name}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="channels-section voice-section">
        <div className="section-header">
          <span>ГОЛОСОВЫЕ КАНАЛЫ</span>
          <button
            className="add-channel-btn"
            onClick={() => {
              setShowVoiceForm(!showVoiceForm);
              setShowTextForm(false);
              setNewChannelName('');
            }}
            title="Создать голосовой канал"
          >
            +
          </button>
        </div>

        {showVoiceForm && (
          <form className="create-channel-form" onSubmit={handleCreateVoice}>
            <input
              type="text"
              placeholder="Название голосового канала"
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              maxLength={30}
              autoFocus
            />
            <div className="form-buttons">
              <button type="submit" disabled={!newChannelName.trim()}>
                Создать
              </button>
              <button type="button" onClick={() => {
                setShowVoiceForm(false);
                setNewChannelName('');
              }}>
                Отмена
              </button>
            </div>
          </form>
        )}

        <div className="channels">
          {voiceChannels.map(channel => {
            const usersInChannel = voiceChannelUsers[channel.id] || [];
            const channelSpeaking = speakingUsers[channel.id] || new Set();
            const isCurrentInChannel = currentVoiceChannel?.id === channel.id;

            // Объединяем текущего пользователя с другими если он в этом канале
            const allUsers = isCurrentInChannel
              ? [{ id: 'me', username, isMuted, isDeafened }, ...usersInChannel]
              : usersInChannel;

            return (
              <div key={channel.id} className="voice-channel-wrapper">
                <div
                  className="channel-item"
                  onClick={() => onSelectChannel(channel)}
                >
                  <img src="/icons/channel.png" alt="Голосовой канал" className="channel-icon-img" />
                  <span className="channel-name">{channel.name}</span>
                </div>

                {allUsers.length > 0 && (
                  <div className="voice-users-in-sidebar">
                    {allUsers.map(user => {
                      const isSpeaking = user.id === 'me'
                        ? channelSpeaking.has('me')
                        : channelSpeaking.has(user.id);
                      return (
                        <div key={user.id} className="voice-user-sidebar">
                          <div className={`voice-user-avatar-tiny ${isSpeaking ? 'speaking' : ''}`}>
                            {user.username[0].toUpperCase()}
                          </div>
                          <span className="voice-user-name-tiny">{user.username}</span>
                          <div className="voice-user-status-icons">
                            {user.isDeafened && (
                              <img src="/icons/headset_off.png" alt="Не слышит" className="status-icon" />
                            )}
                            {user.isMuted && (
                              <img src="/icons/microphone_off.png" alt="Микрофон выкл" className="status-icon mic-icon" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <UserProfile
        username={username}
        isMuted={isMuted}
        isDeafened={isDeafened}
        isInVoice={isInVoice}
        isSpeaking={currentVoiceChannel && speakingUsers[currentVoiceChannel.id]?.has('me')}
        onToggleMute={onToggleMute}
        onToggleDeafen={onToggleDeafen}
        onDisconnect={onDisconnect}
      />
    </div>
  );
}

export default ChannelList;

