import React, { useState } from 'react';
import './UserList.css';

const BACKEND_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : `${window.location.protocol}//${window.location.hostname}`;

function UserList({ onlineUsers, allMembers }) {
  const [selectedUser, setSelectedUser] = useState(null);
  const [profilePosition, setProfilePosition] = useState({ top: 0, left: 0 });

  // Создаем Map из онлайн пользователей по userId для быстрой проверки
  const onlineUsersMap = new Map();
  onlineUsers.forEach(u => {
    if (u.userId) {
      onlineUsersMap.set(u.userId, u);
    }
  });

  // Разделяем участников на онлайн и оффлайн
  const onlineMembers = allMembers.filter(member => onlineUsersMap.has(member.id));
  const offlineMembers = allMembers.filter(member => !onlineUsersMap.has(member.id));

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

  const renderUserItem = (member, isOnline) => {
    const username = member.username;
    const avatar = member.avatar;
    const badge = member.badge;
    const badgeTooltip = member.badgeTooltip;
    const displayName = member.displayName;

    return (
      <div
        key={member.id}
        className="user-item"
        onClick={(e) => handleUserClick(member, e)}
      >
        {avatar ? (
          <img
            src={`${BACKEND_URL}${avatar}`}
            alt="Avatar"
            className="user-avatar-img"
          />
        ) : (
          <div className="user-avatar">
            {(displayName || username)[0].toUpperCase()}
          </div>
        )}
        <div className="user-info">
          <div className="user-name-row">
            <div className="user-name">{displayName || username}</div>
            {badge && badge !== 'User' && (
              <span
                className="user-badge"
                title={badgeTooltip || badge}
              >
                {badge}
              </span>
            )}
          </div>
          <div className="user-status">
            <span className={`status-indicator ${isOnline ? 'online' : 'offline'}`}></span>
            <span className="status-text">{isOnline ? 'В сети' : 'Не в сети'}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="user-list">
      {/* Общий заголовок */}
      <div className="user-list-header main-header">
        <span>Участники — {allMembers.length}</span>
      </div>

      {/* Онлайн пользователи */}
      {onlineMembers.length > 0 && (
        <>
          <div className="user-list-subheader">
            <span>В СЕТИ — {onlineMembers.length}</span>
          </div>
          <div className="users">
            {onlineMembers.map(member => renderUserItem(member, true))}
          </div>
        </>
      )}

      {/* Оффлайн пользователи */}
      {offlineMembers.length > 0 && (
        <>
          <div className="user-list-subheader">
            <span>НЕ В СЕТИ — {offlineMembers.length}</span>
          </div>
          <div className="users">
            {offlineMembers.map(member => renderUserItem(member, false))}
          </div>
        </>
      )}

      {allMembers.length === 0 && (
        <div className="no-users">
          Пока никого нет
        </div>
      )}

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
          </div>
        </>
      )}
    </div>
  );
}

export default UserList;

