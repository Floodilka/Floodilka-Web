import React, { useState, useEffect, useMemo } from 'react';
import './UserSettingsModal.css';
import './ServerSettingsModal.css';
import './Chat.css';

const BACKEND_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : `${window.location.protocol}//${window.location.hostname}`;

function ServerSettingsModal({
  server,
  members,
  currentUserId,
  canBanMembers,
  onBanMember,
  banLoadingId,
  banError,
  onClose
}) {
  const [activeSection, setActiveSection] = useState('members');
  const [contextMenu, setContextMenu] = useState(null);
  const [bannedMembers, setBannedMembers] = useState([]);
  const [bansLoading, setBansLoading] = useState(false);
  const [bansError, setBansError] = useState('');
  const [showBannedUserModal, setShowBannedUserModal] = useState(false);
  const [selectedBannedUser, setSelectedBannedUser] = useState(null);
  const [sortBy, setSortBy] = useState('newest'); // 'newest', 'oldest', 'name'

  const sortedMembers = useMemo(() => {
    if (!Array.isArray(members)) {
      return [];
    }
    return [...members].sort((a, b) => {
      if (sortBy === 'newest') {
        // Самые новые наверху (по id, createdAt или joinedAt)
        const idA = a.id || a._id || 0;
        const idB = b.id || b._id || 0;
        return idB.toString().localeCompare(idA.toString());
      } else if (sortBy === 'oldest') {
        // Самые старые наверху
        const idA = a.id || a._id || 0;
        const idB = b.id || b._id || 0;
        return idA.toString().localeCompare(idB.toString());
      } else {
        // По алфавиту
        const nameA = (a.displayName || a.username || '').toLowerCase();
        const nameB = (b.displayName || b.username || '').toLowerCase();
        return nameA.localeCompare(nameB);
      }
    });
  }, [members, sortBy]);

  // Загружаем забаненных пользователей при открытии секции банов
  useEffect(() => {
    if (activeSection === 'bans' && canBanMembers) {
      loadBannedMembers();
    }
  }, [activeSection, canBanMembers]);

  const loadBannedMembers = async () => {
    if (!server?._id) return;

    setBansLoading(true);
    setBansError('');

    try {
      const token = localStorage.getItem('token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const response = await fetch(`${BACKEND_URL}/api/servers/${server._id}/bans`, {
        headers,
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Не удалось загрузить список банов');
      }

      const data = await response.json();
      setBannedMembers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Ошибка загрузки забаненных пользователей:', error);
      setBansError('Не удалось загрузить список банов');
      setBannedMembers([]);
    } finally {
      setBansLoading(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (contextMenu) {
          setContextMenu(null);
        } else {
          onClose();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [contextMenu, onClose]);

  useEffect(() => {
    if (!contextMenu) {
      return;
    }

    const handleClickOutside = (event) => {
      if (!event.target.closest('.message-context-menu') && !event.target.closest('.server-member-action-btn')) {
        setContextMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [contextMenu]);

  const canBanMember = (member) => {
    if (!canBanMembers) return false;
    if (!member || !member.id) return false;
    if (member.id === currentUserId) return false;
    if (server?.ownerId && server.ownerId === member.id) return false;
    return true;
  };

  const handleMemberMenu = (event, member) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 200;
    const menuHeight = 48;
    const padding = 12;
    const left = Math.min(window.innerWidth - menuWidth - padding, Math.max(padding, rect.right - menuWidth));
    const top = Math.min(window.innerHeight - menuHeight - padding, rect.bottom + 6);

    setContextMenu({
      member,
      position: {
        top,
        left
      }
    });
  };

  const handleBanClick = async (member) => {
    if (!onBanMember || !member) {
      return;
    }

    try {
      await onBanMember(member);
      setContextMenu(null);
    } catch (err) {
      // Ошибка отображается через banError
    }
  };

  const handleBannedUserClick = (bannedUser) => {
    setSelectedBannedUser(bannedUser);
    setShowBannedUserModal(true);
  };

  const handleUnbanClick = async (bannedUser) => {
    if (!server?._id || !bannedUser?.id) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const response = await fetch(`${BACKEND_URL}/api/servers/${server._id}/bans/${bannedUser.id}`, {
        method: 'DELETE',
        headers,
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Не удалось разбанить пользователя');
      }

      // Удаляем пользователя из списка банов
      setBannedMembers(prev => prev.filter(user => user.id !== bannedUser.id));
      setShowBannedUserModal(false);
      setSelectedBannedUser(null);
    } catch (error) {
      console.error('Ошибка разбана пользователя:', error);
      setBansError('Не удалось разбанить пользователя');
    }
  };

  const renderMembersSection = () => (
    <div className="server-members-section">
      <div className="settings-page-header">
        <h1 className="settings-page-title">Участники сервера</h1>
        <p className="settings-page-subtitle">Управляйте участниками сервера и их правами</p>
      </div>
      {banError && (
        <div className="server-settings-error">{banError}</div>
      )}

      {/* Переключатель сортировки */}
      <div className="server-members-sort">
        <span className="server-members-sort-label">Сортировка:</span>
        <div className="server-members-sort-buttons">
          <button
            className={`server-sort-btn ${sortBy === 'newest' ? 'active' : ''}`}
            onClick={() => setSortBy('newest')}
          >
            Новые
          </button>
          <button
            className={`server-sort-btn ${sortBy === 'oldest' ? 'active' : ''}`}
            onClick={() => setSortBy('oldest')}
          >
            Старые
          </button>
          <button
            className={`server-sort-btn ${sortBy === 'name' ? 'active' : ''}`}
            onClick={() => setSortBy('name')}
          >
            По имени
          </button>
        </div>
      </div>

      <div className="server-members-list">
        {sortedMembers.length === 0 ? (
          <div className="server-members-empty">
            <h3>Участников пока нет</h3>
            <p>Пригласите людей на сервер, чтобы начать общение.</p>
          </div>
        ) : (
          sortedMembers.map(member => {
            const displayName = member.displayName || member.username || 'Пользователь';
            const username = member.username || 'unknown';
            const isOwner = server?.ownerId === member.id;
            const isSelf = currentUserId === member.id;
            const canBan = canBanMember(member);

            return (
              <div className="server-member-row" key={member.id}>
                <div className="server-member-info">
                  {member.avatar ? (
                    <img
                      src={member.avatar.startsWith('http') ? member.avatar : `${BACKEND_URL}${member.avatar}`}
                      alt={displayName}
                      className="server-member-avatar"
                    />
                  ) : (
                    <div className="server-member-avatar placeholder">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="server-member-meta">
                    <div className="server-member-name">
                      <span>{displayName}</span>
                      {isOwner && (
                        <span className="server-member-chip owner">Владелец</span>
                      )}
                      {isSelf && !isOwner && (
                        <span className="server-member-chip self">Вы</span>
                      )}
                    </div>
                    <div className="server-member-username">@{username}</div>
                  </div>
                </div>
                <div className="server-member-actions">
                  {canBan ? (
                    <button
                      type="button"
                      className="server-member-action-btn"
                      onClick={(e) => handleMemberMenu(e, member)}
                      disabled={banLoadingId === member.id}
                    >
                      ⋮
                    </button>
                  ) : (
                    <span className="server-member-status-label">
                      {member.status === 'online' ? 'В сети' : 'Не в сети'}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  const renderBansSection = () => (
    <div className="server-members-section">
      <div className="settings-page-header">
        <h1 className="settings-page-title">Баны сервера</h1>
        <p className="settings-page-subtitle">Управляйте забаненными пользователями</p>
      </div>
      {bansError && (
        <div className="server-settings-error">{bansError}</div>
      )}

      <div className="server-members-list">
        {bansLoading ? (
          <div className="server-members-empty">
            <h3>Загрузка...</h3>
            <p>Получение списка забаненных пользователей</p>
          </div>
        ) : bannedMembers.length === 0 ? (
          <div className="server-members-empty">
            <h3>Банов пока нет</h3>
            <p>Здесь будут отображаться забаненные пользователи</p>
          </div>
        ) : (
          bannedMembers.map(bannedUser => {
            const user = bannedUser.user;
            const displayName = user?.displayName || user?.username || 'Пользователь';
            const username = user?.username || 'unknown';
            const banReason = bannedUser.reason || 'Не указана причина бана';

            return (
              <div
                className="server-member-row banned-member-row"
                key={bannedUser.id}
                onClick={() => handleBannedUserClick(bannedUser)}
                style={{ cursor: 'pointer' }}
              >
                <div className="server-member-info">
                  {user?.avatar ? (
                    <img
                      src={user.avatar.startsWith('http') ? user.avatar : `${BACKEND_URL}${user.avatar}`}
                      alt={displayName}
                      className="server-member-avatar"
                    />
                  ) : (
                    <div className="server-member-avatar placeholder">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="server-member-meta">
                    <div className="server-member-name">
                      <span>{displayName}</span>
                      <span className="server-member-chip banned">Забанен</span>
                    </div>
                    <div className="server-member-username">@{username}</div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <>
      <div className="settings-overlay" onClick={onClose}>
        <div className="settings-container server-settings-container" onClick={(e) => e.stopPropagation()}>
          <button className="settings-close-btn" onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
          <div className="settings-content">
            <div className="settings-sidebar">
              <div className="settings-nav-section">
                <h3>Настройки сервера</h3>
                <button
                  className={`settings-nav-item ${activeSection === 'members' ? 'active' : ''}`}
                  onClick={() => setActiveSection('members')}
                >
                  Участники
                </button>
                {canBanMembers && (
                  <button
                    className={`settings-nav-item ${activeSection === 'bans' ? 'active' : ''}`}
                    onClick={() => setActiveSection('bans')}
                  >
                    Баны
                  </button>
                )}
              </div>
            </div>
            <div className="settings-profile-section server-settings-main">
              {activeSection === 'members' && renderMembersSection()}
              {activeSection === 'bans' && renderBansSection()}
            </div>
          </div>
        </div>
      </div>
      {contextMenu && (
        <div
          className="message-context-menu"
          style={{
            top: contextMenu.position.top,
            left: contextMenu.position.left
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="message-context-menu-item danger"
            onClick={() => handleBanClick(contextMenu.member)}
            disabled={banLoadingId === contextMenu.member.id}
          >
            Забанить {contextMenu.member.displayName || contextMenu.member.username}
          </button>
        </div>
      )}

      {showBannedUserModal && selectedBannedUser && (
        <div className="join-server-overlay" onClick={() => setShowBannedUserModal(false)}>
          <div className="join-server-modal" onClick={(e) => e.stopPropagation()}>
            <button className="join-server-close" onClick={() => setShowBannedUserModal(false)}>×</button>

            <h2>Информация о бане</h2>
            <p className="modal-subtitle">
              Детали бана пользователя
            </p>

            <div className="form-group">
              <label>Пользователь</label>
              <div className="banned-user-info">
                <div className="banned-user-avatar">
                  {selectedBannedUser.user?.avatar ? (
                    <img
                      src={selectedBannedUser.user.avatar.startsWith('http') ? selectedBannedUser.user.avatar : `${BACKEND_URL}${selectedBannedUser.user.avatar}`}
                      alt={selectedBannedUser.user?.displayName || selectedBannedUser.user?.username}
                    />
                  ) : (
                    <div className="avatar-placeholder">
                      {(selectedBannedUser.user?.displayName || selectedBannedUser.user?.username || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="banned-user-details">
                  <div className="banned-user-name">
                    {selectedBannedUser.user?.displayName || selectedBannedUser.user?.username || 'Пользователь'}
                  </div>
                  <div className="banned-user-username">
                    @{selectedBannedUser.user?.username || 'unknown'}
                  </div>
                </div>
              </div>
            </div>

            <div className="form-group">
              <label>Причина бана</label>
              <div className="ban-reason-display">
                {selectedBannedUser.reason || 'Не указана причина бана'}
              </div>
            </div>

            <div className="form-group">
              <label>Дата бана</label>
              <div className="ban-date-display">
                {new Date(selectedBannedUser.bannedAt).toLocaleString('ru-RU', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn-secondary-gray"
                onClick={() => setShowBannedUserModal(false)}
              >
                Закрыть
              </button>
              <button
                className="btn-primary"
                onClick={() => handleUnbanClick(selectedBannedUser)}
              >
                Разбанить
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default ServerSettingsModal;
