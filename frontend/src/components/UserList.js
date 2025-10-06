import React, { useState } from 'react';
import './UserList.css';

const BACKEND_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : `${window.location.protocol}//${window.location.hostname}`;

function UserList({ users }) {
  const [selectedUser, setSelectedUser] = useState(null);
  const [profilePosition, setProfilePosition] = useState({ top: 0, left: 0 });

  const handleUserClick = async (user, event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setProfilePosition({
      top: rect.top,
      left: rect.left - 8
    });

    // Если есть userId, загрузить актуальные данные пользователя
    if (user.userId) {
      try {
        const response = await fetch(`${BACKEND_URL}/api/auth/user/${user.userId}`);
        if (response.ok) {
          const userData = await response.json();
          setSelectedUser(userData);
          return;
        }
      } catch (err) {
        console.error('Ошибка загрузки данных пользователя:', err);
      }
    }

    // Fallback: использовать данные из списка
    setSelectedUser(user);
  };

  const handleCloseProfile = () => {
    setSelectedUser(null);
  };

  return (
    <div className="user-list">
      <div className="user-list-header">
        <span>ОНЛАЙН — {users.length}</span>
      </div>
      <div className="users">
        {users.map((user, index) => {
          const isUserObject = typeof user === 'object' && user !== null;
          const username = isUserObject ? user.username : user;
          const avatar = isUserObject ? user.avatar : null;
          const badge = isUserObject ? user.badge : null;
          const badgeTooltip = isUserObject ? user.badgeTooltip : null;
          const displayName = isUserObject ? user.displayName : null;

          return (
            <div
              key={index}
              className="user-item"
              onClick={(e) => handleUserClick(isUserObject ? user : { username, avatar, displayName, badge, badgeTooltip }, e)}
            >
              {avatar ? (
                <img
                  src={`${BACKEND_URL}${avatar}`}
                  alt="Avatar"
                  className="user-avatar-img"
                />
              ) : (
                <div className="user-avatar">
                  {username[0].toUpperCase()}
                </div>
              )}
              <div className="user-info">
                <div className="user-name-row">
                  <div className="user-name">{displayName || username}</div>
                  {badge && badge !== 'User' && (
                    <span
                      className={`user-badge badge-${badge.toLowerCase()}`}
                      title={badgeTooltip || badge}
                    >
                      {badge}
                    </span>
                  )}
                </div>
                <div className="user-status">
                  <span className="status-indicator online"></span>
                  <span className="status-text">В сети</span>
                </div>
              </div>
            </div>
          );
        })}
        {users.length === 0 && (
          <div className="no-users">
            Пока никого нет
          </div>
        )}
      </div>

      {selectedUser && (
        <>
          <div className="user-profile-overlay" onClick={handleCloseProfile} />
          <div
            className="user-profile-card"
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
                      <span className={`user-profile-badge badge-${selectedUser.badge.toLowerCase()}`}>
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
          </div>
        </>
      )}
    </div>
  );
}

export default UserList;

