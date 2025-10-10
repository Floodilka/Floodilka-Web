import React, { useState } from 'react';
import './EmptyServerState.css';
import CreateServerModal from './CreateServerModal';
import UserSettingsModal from './UserSettingsModal';

const BACKEND_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : `${window.location.protocol}//${window.location.hostname}`;

function EmptyServerState({ onCreateServer, user, onLogout, onAvatarUpdate }) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreateServer = (serverData) => {
    onCreateServer(serverData);
    setShowCreateModal(false);
  };

  const extractInviteCode = (input) => {
    // Извлекаем код из разных форматов:
    // - просто код: abc123
    // - URL: http://example.com/invite/abc123
    // - путь: /invite/abc123
    const match = input.match(/(?:invite\/)?([a-f0-9]+)$/i);
    return match ? match[1] : input.trim();
  };

  const handleJoinByLink = async () => {
    if (!inviteLink.trim()) return;

    setLoading(true);
    setError('');

    try {
      const code = extractInviteCode(inviteLink);
      const token = localStorage.getItem('token');

      const response = await fetch(`${BACKEND_URL}/api/servers/join/${code}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (response.ok) {
        // Успешно присоединились, перезагружаем список серверов
        window.location.reload();
      } else {
        setError(data.error || 'Не удалось присоединиться к серверу');
      }
    } catch (err) {
      console.error('Ошибка присоединения:', err);
      setError('Ошибка подключения к серверу');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="empty-server-state">
      <div className="empty-server-content">
        {!showCreateModal && (
          <>
            <div className="empty-server-icon">🏠</div>
            <h1>У вас пока нет серверов</h1>
            <p className="empty-server-subtitle">
              Создайте свой собственный сервер и начните общаться с друзьями
              или присоединитесь к существующему серверу по ссылке-приглашению
            </p>
          </>
        )}

        {!showJoinModal && !showCreateModal ? (
          <>
            <div className="empty-server-actions">
              <button
                className="action-card create-card"
                onClick={() => setShowCreateModal(true)}
              >
                <div className="action-icon">➕</div>
                <h3>Создать сервер</h3>
                <p>Создайте новый сервер и пригласите друзей</p>
              </button>

              <button
                className="action-card join-card"
                onClick={() => setShowJoinModal(true)}
              >
                <div className="action-icon">🔗</div>
                <h3>Присоединиться</h3>
                <p>Есть ссылка-приглашение? Вступите в сервер</p>
              </button>
            </div>

            <div className="profile-section">
              <button
                className="profile-button"
                onClick={() => setShowSettings(true)}
              >
                {user?.avatar ? (
                  <img
                    src={`${BACKEND_URL}${user.avatar}`}
                    alt="Avatar"
                    className="profile-button-avatar-img"
                  />
                ) : (
                  <div className="profile-button-avatar">
                    {(user?.displayName || user?.username)?.charAt(0).toUpperCase() || 'U'}
                  </div>
                )}
                <div className="profile-button-info">
                  <div className="profile-button-name">
                    {user?.displayName || user?.username || 'Пользователь'}
                  </div>
                  <div className="profile-button-action">Редактировать профиль</div>
                </div>
                <img src="/icons/setting.png" alt="Настройки" className="profile-button-icon" />
              </button>
            </div>
          </>
        ) : showJoinModal ? (
          <div className="join-form-inline">
            <button
              className="close-join-form"
              onClick={() => {
                setShowJoinModal(false);
                setInviteLink('');
                setError('');
              }}
              title="Закрыть"
            >
              ×
            </button>

            <h2>Присоединиться к серверу</h2>
            <p className="join-form-subtitle">
              Введите ссылку-приглашение для присоединения к существующему серверу
            </p>

            <div className="form-group">
              <label>Ссылка-приглашение</label>
              <input
                type="text"
                placeholder="https://floodilka.com/invite/abc123 или abc123"
                value={inviteLink}
                onChange={(e) => {
                  setInviteLink(e.target.value);
                  setError('');
                }}
                onKeyPress={(e) => e.key === 'Enter' && !loading && handleJoinByLink()}
                autoFocus
                disabled={loading}
              />
              {error && <div className="error-message">{error}</div>}
            </div>

            <div className="form-actions">
              <button
                className="btn-secondary"
                onClick={() => {
                  setShowJoinModal(false);
                  setInviteLink('');
                  setError('');
                }}
                disabled={loading}
              >
                Отмена
              </button>
              <button
                className="btn-primary"
                onClick={handleJoinByLink}
                disabled={!inviteLink.trim() || loading}
              >
                {loading ? 'Подключение...' : 'Присоединиться'}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {showCreateModal && (
        <CreateServerModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateServer}
        />
      )}

      {showSettings && (
        <UserSettingsModal
          user={user}
          onClose={() => setShowSettings(false)}
          onLogout={onLogout}
          onAvatarUpdate={onAvatarUpdate}
        />
      )}
    </div>
  );
}

export default EmptyServerState;

