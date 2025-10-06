import React, { useState } from 'react';
import './ChannelList.css';

function ChannelList({ channels, currentChannel, voiceChannelUsers, onSelectChannel, onCreateChannel }) {
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
              className={`channel-item ${currentChannel?.id === channel.id ? 'active' : ''}`}
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

            return (
              <div key={channel.id} className="voice-channel-container">
                <div
                  className={`channel-item voice-channel ${currentChannel?.id === channel.id ? 'active' : ''}`}
                  onClick={() => onSelectChannel(channel)}
                >
                  <span className="channel-icon">🔊</span>
                  <span className="channel-name">{channel.name}</span>
                </div>

                {usersInChannel.length > 0 && (
                  <div className="voice-users-list">
                    {usersInChannel.map(user => (
                      <div key={user.id} className="voice-user">
                        <div className="voice-user-avatar-small">
                          {user.username[0].toUpperCase()}
                        </div>
                        <span className="voice-user-name-small">{user.username}</span>
                        {user.isMuted && <span className="voice-user-muted">🔇</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default ChannelList;

