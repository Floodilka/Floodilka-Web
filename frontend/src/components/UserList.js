import React, { useState, memo, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import './UserList.css';
import FriendActionButton from './FriendActionButton';
import api from '../services/api';
import { useLiveUser } from '../hooks/useLiveUser';

const BACKEND_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : `${window.location.protocol}//${window.location.hostname}`;

const UserList = memo(function UserList({ onlineUsers, allMembers, currentUser, currentServer, onMessageSent }) {
  const navigate = useNavigate();
  const [selectedUser, setSelectedUser] = useState(null);
  const liveSelectedUser = useLiveUser(selectedUser);
  const [profilePosition, setProfilePosition] = useState({ top: 0, left: 0 });
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showOwnerTooltip, setShowOwnerTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });

  // Функция для проверки блокировки пользователя
  const isUserBlocked = (targetUser, currentUser) => {
    if (!targetUser || !currentUser || !currentUser.blockedUsers) {
      return false;
    }

    const targetUserId = targetUser.userId || targetUser.id || targetUser._id;
    if (!targetUserId) return false;

    return currentUser.blockedUsers.some(blockedUser => {
      const blockedUserId = blockedUser.userId?._id || blockedUser.userId;
      return blockedUserId && blockedUserId.toString() === targetUserId.toString();
    });
  };

  // Мемоизируем создание Map из онлайн пользователей для быстрой проверки
  const onlineUsersMap = useMemo(() => {
    const map = new Map();
    onlineUsers.forEach(u => {
      if (u.userId) {
        map.set(u.userId, u);
      }
    });
    return map;
  }, [onlineUsers]);

  // Мемоизируем разделение участников на онлайн и оффлайн
  const { onlineMembers, offlineMembers } = useMemo(() => {
    const online = allMembers.filter(member => onlineUsersMap.has(member.id));
    const offline = allMembers.filter(member => !onlineUsersMap.has(member.id));
    return { onlineMembers: online, offlineMembers: offline };
  }, [allMembers, onlineUsersMap]);

  const handleUserClick = async (user, event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const cardWidth = 320;
    const cardHeight = 400;

    // Рассчитываем позицию слева от элемента
    let left = rect.left - cardWidth - 8;

    // Если карточка выходит за левый край экрана, показываем справа
    if (left < 8) {
      left = rect.right + 8;
    }

    // Если карточка выходит за правый край экрана, корректируем
    if (left + cardWidth > window.innerWidth - 8) {
      left = window.innerWidth - cardWidth - 8;
    }

    // Корректируем вертикальную позицию
    let top = rect.top;
    if (top + cardHeight > window.innerHeight - 8) {
      top = window.innerHeight - cardHeight - 8;
    }
    if (top < 8) {
      top = 8;
    }

    setProfilePosition({
      top: top,
      left: left
    });

    // Если есть userId, загрузить актуальные данные пользователя
    if (user.userId) {
      try {
        const userData = await api.getUserById(user.userId);
        if (userData) {
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
    setMessageText('');
  };

  const handleSendDirectMessage = async () => {
    if (!messageText.trim() || !selectedUser || sendingMessage) return;

    // Не отправляем сообщение самому себе
    if (selectedUser.userId === currentUser?.id || selectedUser.username === currentUser?.username) return;

    setSendingMessage(true);
    try {
      await api.sendDirectMessage(selectedUser.userId || selectedUser.id, messageText.trim());
      setMessageText('');
      handleCloseProfile();

      // Переходим на страницу личных сообщений с этим пользователем
      const userId = selectedUser.userId || selectedUser.id;
      navigate(`/channels/@me/${userId}`);
    } catch (error) {
      console.error('Ошибка отправки сообщения:', error);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendDirectMessage();
    }
  };

  const handleOwnerIconMouseEnter = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPosition({
      top: rect.top - 40,
      left: rect.left + rect.width / 2
    });
    setShowOwnerTooltip(true);
  };

  const handleOwnerIconMouseLeave = () => {
    setShowOwnerTooltip(false);
  };

  const renderUserItem = (member, isOnline) => {
    const username = member.username;
    const avatar = member.avatar;
    const badge = member.badge;
    const badgeTooltip = member.badgeTooltip;
    const displayName = member.displayName;
    const isOwner = currentServer && currentServer.ownerId === member.id;

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
            {isOwner && (
              <img
                src="/icons/owner.png"
                alt="Владелец"
                className="owner-icon"
                onMouseEnter={handleOwnerIconMouseEnter}
                onMouseLeave={handleOwnerIconMouseLeave}
              />
            )}
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

      {selectedUser && createPortal(
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
                {liveSelectedUser?.avatar ? (
                  <img
                    src={`${BACKEND_URL}${liveSelectedUser.avatar}`}
                    alt="Avatar"
                    className="user-profile-avatar-large"
                  />
                ) : (
                  <div className="user-profile-avatar-large user-profile-avatar-fallback">
                    {(liveSelectedUser?.displayName || liveSelectedUser?.username)[0].toUpperCase()}
                  </div>
                )}
              </div>
              {liveSelectedUser?.displayName ? (
                <>
                  <div className="user-profile-display-name">
                    {liveSelectedUser.displayName}
                  </div>
                  <div className="user-profile-username-row">
                    <div className="user-profile-username">
                      {liveSelectedUser.username}
                    </div>
                    {liveSelectedUser.badge && liveSelectedUser.badge !== 'User' && (
                      <span className="user-profile-badge">
                        {liveSelectedUser.badge}
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <div className="user-profile-username-row">
                  <div className="user-profile-display-name">
                    {liveSelectedUser?.username}
                  </div>
                  {liveSelectedUser?.badge && liveSelectedUser.badge !== 'User' && (
                    <span className={`user-profile-badge badge-${liveSelectedUser.badge.toLowerCase()}`}>
                      {liveSelectedUser.badge}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Кнопка добавления в друзья */}
            {selectedUser && currentUser && (selectedUser.userId !== currentUser.id && selectedUser.username !== currentUser.username) && (
              <FriendActionButton
                targetUser={selectedUser}
                currentUserId={currentUser?.id}
              />
            )}

            {/* Поле для отправки личного сообщения - только если не свой профиль */}
            {selectedUser && currentUser && (selectedUser.userId !== currentUser.id && selectedUser.username !== currentUser.username) && (
              <div className="user-profile-message-input">
                <div className="message-input-container">
                  <input
                    type="text"
                    placeholder={
                      isUserBlocked(selectedUser, currentUser)
                        ? `Вы не можете написать @${selectedUser.username}`
                        : `Сообщение для @${selectedUser.username}`
                    }
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={sendingMessage || isUserBlocked(selectedUser, currentUser)}
                    className="message-input-field"
                  />
                </div>
              </div>
            )}

          </div>
        </>,
        document.body
      )}

      {/* Информационное меню для иконки владельца */}
      {showOwnerTooltip && (
        <div
          className="owner-tooltip"
          style={{
            top: `${tooltipPosition.top}px`,
            left: `${tooltipPosition.left}px`
          }}
        >
          <div className="owner-tooltip-content">
            <div className="owner-tooltip-title">Владелец сервера</div>
            <div className="owner-tooltip-arrow"></div>
          </div>
        </div>
      )}
    </div>
  );
});

export default UserList;
