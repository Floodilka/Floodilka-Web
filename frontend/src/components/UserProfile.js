import React, { useState } from 'react';
import './UserProfile.css';
import UserSettingsModal from './UserSettingsModal';

const BACKEND_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : `${window.location.protocol}//${window.location.hostname}`;

function UserProfile({
  user,
  isMuted,
  isDeafened,
  isInVoice,
  isSpeaking,
  onToggleMute,
  onToggleDeafen,
  onDisconnect,
  onLogout,
  onAvatarUpdate
}) {
  const [showSettings, setShowSettings] = useState(false);

  const getStatusText = () => {
    if (isDeafened) return 'Отключен звук';
    if (isMuted) return 'Микрофон выключен';
    return 'Онлайн';
  };

  return (
    <>
      <div className="user-profile">
        <div className="user-profile-info">
          {user?.avatar ? (
            <img
              src={`${BACKEND_URL}${user.avatar}`}
              alt="Avatar"
              className={`user-profile-avatar-img ${isSpeaking ? 'speaking' : ''}`}
            />
          ) : (
            <div className={`user-profile-avatar ${isSpeaking ? 'speaking' : ''}`}>
              {(user?.displayName || user?.username)?.charAt(0).toUpperCase() || 'U'}
            </div>
          )}
          <div className="user-profile-details">
            <div className="user-profile-name">{user?.displayName || user?.username || 'Пользователь'}</div>
            <div className="user-profile-status">{getStatusText()}</div>
          </div>
        </div>

        <div className="user-profile-controls">
          {isInVoice && (
            <>
              <button
                className={`profile-control-btn ${isMuted ? 'active' : ''}`}
                onClick={onToggleMute}
                title={isMuted ? "Включить микрофон" : "Выключить микрофон"}
              >
                <img
                  src={isMuted ? "/icons/microphone_off.png" : "/icons/microphone.png"}
                  alt="mic"
                  className="control-icon"
                />
              </button>

              <button
                className={`profile-control-btn ${isDeafened ? 'active' : ''}`}
                onClick={onToggleDeafen}
                title={isDeafened ? "Включить звук" : "Отключить звук"}
              >
                <img
                  src={isDeafened ? "/icons/headset_off.png" : "/icons/headset.png"}
                  alt="audio"
                  className="control-icon"
                />
              </button>
            </>
          )}

          <button
            className="profile-control-btn"
            onClick={() => setShowSettings(true)}
            title="Настройки пользователя"
          >
            <img
              src="/icons/setting.png"
              alt="settings"
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
                alt="disconnect"
                className="control-icon"
              />
            </button>
          )}
        </div>
      </div>

      {showSettings && (
        <UserSettingsModal
          user={user}
          onClose={() => setShowSettings(false)}
          onLogout={onLogout}
          onAvatarUpdate={onAvatarUpdate}
        />
      )}
    </>
  );
}

export default UserProfile;
