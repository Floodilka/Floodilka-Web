import React from 'react';
import './UserProfile.css';

function UserProfile({ username, isMuted, isDeafened, isInVoice, isSpeaking, onToggleMute, onToggleDeafen, onDisconnect }) {
  return (
    <div className="user-profile">
      <div className="user-profile-info">
        <div className={`user-profile-avatar ${isSpeaking ? 'speaking' : ''}`}>
          {username ? username[0].toUpperCase() : 'U'}
        </div>
        <div className="user-profile-details">
          <div className="user-profile-name">{username || 'Гость'}</div>
          <div className="user-profile-status">
            {isDeafened ? (
              <span className="status-deafened">Не слышу</span>
            ) : isMuted ? (
              <span className="status-muted">Выключен</span>
            ) : (
              <span className="status-online">В сети</span>
            )}
          </div>
        </div>
      </div>

      <div className="user-profile-controls">
        <button
          className={`profile-control-btn ${isMuted ? 'active' : ''}`}
          onClick={onToggleMute}
          title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
          disabled={isDeafened}
        >
          <img
            src={isMuted ? '/icons/microphone_off.png' : '/icons/microphone.png'}
            alt={isMuted ? 'Выкл' : 'Вкл'}
            className="control-icon"
          />
        </button>
        <button
          className={`profile-control-btn ${isDeafened ? 'active' : ''}`}
          onClick={onToggleDeafen}
          title={isDeafened ? 'Включить звук' : 'Отключить звук'}
        >
          <img
            src={isDeafened ? '/icons/headset_off.png' : '/icons/headset.png'}
            alt={isDeafened ? 'Не слышу' : 'Слышу'}
            className="control-icon"
          />
        </button>
        {isInVoice && (
          <button
            className="profile-control-btn disconnect-btn"
            onClick={onDisconnect}
            title="Отключиться от голосового канала"
          >
            <img
              src="/icons/call_down.png"
              alt="Отключиться"
              className="control-icon"
            />
          </button>
        )}
      </div>
    </div>
  );
}

export default UserProfile;

