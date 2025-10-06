import React, { useState } from 'react';
import './ChannelList.css';

function ChannelList({ channels, currentChannel, onSelectChannel, onCreateChannel }) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [channelType, setChannelType] = useState('text');

  const handleCreate = (e) => {
    e.preventDefault();
    const trimmedName = newChannelName.trim();
    if (trimmedName) {
      onCreateChannel(trimmedName, channelType);
      setNewChannelName('');
      setChannelType('text');
      setShowCreateForm(false);
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
            onClick={() => setShowCreateForm(!showCreateForm)}
            title="Создать канал"
          >
            +
          </button>
        </div>

        {showCreateForm && (
          <form className="create-channel-form" onSubmit={handleCreate}>
            <input
              type="text"
              placeholder="Название канала"
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              maxLength={30}
              autoFocus
            />
            <div className="channel-type-selector">
              <label>
                <input
                  type="radio"
                  value="text"
                  checked={channelType === 'text'}
                  onChange={(e) => setChannelType(e.target.value)}
                />
                <span>💬 Текстовый</span>
              </label>
              <label>
                <input
                  type="radio"
                  value="voice"
                  checked={channelType === 'voice'}
                  onChange={(e) => setChannelType(e.target.value)}
                />
                <span>🎤 Голосовой</span>
              </label>
            </div>
            <div className="form-buttons">
              <button type="submit" disabled={!newChannelName.trim()}>
                Создать
              </button>
              <button type="button" onClick={() => {
                setShowCreateForm(false);
                setNewChannelName('');
                setChannelType('text');
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
        </div>
        <div className="channels">
          {voiceChannels.map(channel => (
            <div
              key={channel.id}
              className={`channel-item voice-channel ${currentChannel?.id === channel.id ? 'active' : ''}`}
              onClick={() => onSelectChannel(channel)}
            >
              <span className="channel-icon">🔊</span>
              <span className="channel-name">{channel.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ChannelList;

