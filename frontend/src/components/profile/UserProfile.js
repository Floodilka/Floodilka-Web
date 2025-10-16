import React from 'react';
import FriendActionButton from '../FriendActionButton';
import { isUserBlocked } from '../../utils/messageUtils';

const BACKEND_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : `${window.location.protocol}//${window.location.hostname}`;

/**
 * Компонент профиля пользователя
 */
const UserProfile = ({
  selectedUser,
  profilePosition,
  user,
  messageText,
  setMessageText,
  sendingMessage,
  onCloseProfile,
  onSendDirectMessage,
  onKeyPress
}) => {
  if (!selectedUser) {
    return null;
  }

  const isBlocked = isUserBlocked(selectedUser, user);

  return (
    <>
      <div className="user-profile-overlay" onClick={onCloseProfile} />
      <div
        className="user-profile-card-chat"
        style={{
          top: `${profilePosition.top}px`,
          left: `${profilePosition.left}px`
        }}
      >
        <div className="user-profile-banner" />
        <div className="user-profile-content">
          <div className="user-profile-avatar-wrapper">
            {selectedUser.avatar ? (
              <img
                src={`${BACKEND_URL}${selectedUser.avatar}`}
                alt="Avatar"
                className="user-profile-avatar-large"
              />
            ) : (
              <div className="user-profile-avatar-large user-profile-avatar-fallback">
                {(selectedUser.displayName || selectedUser.username)[0].toUpperCase()}
              </div>
            )}
          </div>
          {selectedUser.displayName ? (
            <>
              <div className="user-profile-display-name">
                {selectedUser.displayName}
              </div>
              <div className="user-profile-username-row">
                <div className="user-profile-username">
                  {selectedUser.username}
                </div>
                {selectedUser.badge && selectedUser.badge !== 'User' && (
                  <span className="user-profile-badge">
                    {selectedUser.badge}
                  </span>
                )}
              </div>
            </>
          ) : (
            <div className="user-profile-username-row">
              <div className="user-profile-display-name">
                {selectedUser.username}
              </div>
              {selectedUser.badge && selectedUser.badge !== 'User' && (
                <span className={`user-profile-badge badge-${selectedUser.badge.toLowerCase()}`}>
                  {selectedUser.badge}
                </span>
              )}
            </div>
          )}
        </div>

        <FriendActionButton
          targetUser={selectedUser}
          currentUserId={user?.id}
        />

        {/* Поле для отправки личного сообщения */}
        {selectedUser && (selectedUser.userId !== user?.username && selectedUser.username !== user?.username) && (
          <div className="user-profile-message-input">
            <div className="message-input-container">
              <input
                type="text"
                placeholder={
                  isBlocked
                    ? `Вы не можете написать @${selectedUser.username}`
                    : `Сообщение для @${selectedUser.username}`
                }
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyPress={onKeyPress}
                disabled={sendingMessage || isBlocked}
                className="message-input-field"
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default UserProfile;
