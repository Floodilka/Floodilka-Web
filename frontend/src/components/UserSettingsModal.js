import React, { useState, useEffect } from 'react';
import './UserSettingsModal.css';
import AudioSettingsModal from './AudioSettingsModal';

const BACKEND_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : `${window.location.protocol}//${window.location.hostname}`;

function UserSettingsModal({ user, onClose, onLogout, onAvatarUpdate }) {
  const [uploading, setUploading] = useState(false);
  const [isEditingDisplayName, setIsEditingDisplayName] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState('');
  const [displayNameError, setDisplayNameError] = useState('');
  const [showAudioSettings, setShowAudioSettings] = useState(false);

  // Состояния для вкладок
  const [activeTab, setActiveTab] = useState('account');

  // Состояния для управления тегами (только для puncher)
  const [targetUsername, setTargetUsername] = useState('');
  const [badgeText, setBadgeText] = useState('');
  const [badgeTooltipText, setBadgeTooltipText] = useState('');
  const [badgeError, setBadgeError] = useState('');
  const [badgeSuccess, setBadgeSuccess] = useState('');
  const [isAssigningBadge, setIsAssigningBadge] = useState(false);

  // Актуальные данные пользователя
  const [currentUser, setCurrentUser] = useState(user);

  const isPuncher = currentUser?.username === 'puncher';

  // Загрузка актуальных данных пользователя при открытии
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${BACKEND_URL}/api/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const userData = await response.json();
          setCurrentUser(userData);
          // Обновить в localStorage
          localStorage.setItem('user', JSON.stringify(userData));
          if (onAvatarUpdate) {
            onAvatarUpdate(userData);
          }
        }
      } catch (error) {
        console.error('Ошибка загрузки данных пользователя:', error);
      }
    };

    fetchUserData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = () => {
    onLogout();
    onClose();
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Проверка типа файла
    if (!file.type.startsWith('image/')) {
      alert('Пожалуйста, выберите изображение');
      return;
    }

    // Проверка размера (макс 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Размер файла не должен превышать 5MB');
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const token = localStorage.getItem('token');
      const response = await fetch(`${BACKEND_URL}/api/auth/avatar`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка загрузки');
      }

      // Обновить аватар в localStorage и состоянии
      const updatedUser = { ...currentUser, avatar: data.avatar };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setCurrentUser(updatedUser);

      if (onAvatarUpdate) {
        onAvatarUpdate(updatedUser);
      }

      alert('Аватар успешно обновлен!');
    } catch (error) {
      console.error('Ошибка загрузки аватара:', error);
      alert(error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDisplayNameEdit = () => {
    setNewDisplayName(currentUser?.displayName || currentUser?.username || '');
    setDisplayNameError('');
    setIsEditingDisplayName(true);
  };

  const handleDisplayNameSave = async () => {
    const trimmedName = newDisplayName.trim();

    if (!trimmedName) {
      setDisplayNameError('Имя не может быть пустым');
      return;
    }

    if (trimmedName.length > 32) {
      setDisplayNameError('Имя не может превышать 32 символа');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${BACKEND_URL}/api/auth/displayname`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ displayName: trimmedName })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка обновления');
      }

      // Обновить пользователя в localStorage и состоянии
      const updatedUser = { ...currentUser, displayName: data.displayName };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setCurrentUser(updatedUser);

      if (onAvatarUpdate) {
        onAvatarUpdate(updatedUser);
      }

      setIsEditingDisplayName(false);
      setDisplayNameError('');
    } catch (error) {
      setDisplayNameError(error.message);
    }
  };

  const handleDisplayNameCancel = () => {
    setIsEditingDisplayName(false);
    setDisplayNameError('');
  };

  const handleAssignBadge = async () => {
    setBadgeError('');
    setBadgeSuccess('');

    if (!targetUsername.trim()) {
      setBadgeError('Введите имя пользователя');
      return;
    }

    if (!badgeText.trim()) {
      setBadgeError('Введите тег');
      return;
    }

    if (badgeText.trim().length > 4) {
      setBadgeError('Тег не может превышать 4 символа');
      return;
    }

    setIsAssigningBadge(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${BACKEND_URL}/api/auth/assign-badge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          username: targetUsername.trim(),
          badge: badgeText.trim(),
          badgeTooltip: badgeTooltipText.trim() || badgeText.trim()
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка назначения тега');
      }

      setBadgeSuccess(`Тег "${badgeText}" успешно назначен пользователю ${targetUsername}!`);
      setTargetUsername('');
      setBadgeText('');
      setBadgeTooltipText('');

      // Очистить сообщение об успехе через 3 секунды
      setTimeout(() => {
        setBadgeSuccess('');
      }, 3000);
    } catch (error) {
      setBadgeError(error.message);
    } finally {
      setIsAssigningBadge(false);
    }
  };

  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div className="settings-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="settings-modal-header">
          <h2>Настройки</h2>
          <button className="settings-close-btn" onClick={onClose}>
            <span>✕</span>
          </button>
        </div>

        {/* Вкладки */}
        <div className="settings-tabs">
          <button
            className={`settings-tab ${activeTab === 'account' ? 'active' : ''}`}
            onClick={() => setActiveTab('account')}
          >
            Моя учётная запись
          </button>
          {isPuncher && (
            <button
              className={`settings-tab ${activeTab === 'admin' ? 'active' : ''}`}
              onClick={() => setActiveTab('admin')}
            >
              <span className="tab-admin-icon">Admin panel</span>
            </button>
          )}
        </div>

        <div className="settings-profile-section">
          {activeTab === 'account' && (
            <>
          <div className="settings-profile-banner">
            <label className="settings-profile-avatar-wrapper" title="Изменить аватар">
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                disabled={uploading}
                style={{ display: 'none' }}
              />
              {currentUser?.avatar ? (
                <img
                  src={`${BACKEND_URL}${currentUser.avatar}`}
                  alt="Avatar"
                  className="settings-profile-avatar-img"
                />
              ) : (
                <div className="settings-profile-avatar">
                  {(currentUser?.displayName || currentUser?.username)?.charAt(0).toUpperCase() || 'U'}
                </div>
              )}
              <div className="avatar-edit-overlay">
                {uploading ? (
                  <span className="avatar-uploading">⏳</span>
                ) : (
                  <svg className="avatar-edit-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="white"/>
                  </svg>
                )}
              </div>
            </label>
            <div className="settings-profile-info">
              <h3>{currentUser?.displayName || currentUser?.username || 'Пользователь'}</h3>
              {currentUser?.badge && currentUser.badge !== 'User' && (
                <div className="settings-profile-badge" title={currentUser.badgeTooltip || currentUser.badge}>
                  {currentUser.badge}
                </div>
              )}
            </div>
          </div>

          <div className="settings-info-item">
            <div className="settings-info-label">Отображаемое имя</div>
            {isEditingDisplayName ? (
              <div className="settings-info-edit">
                <input
                  type="text"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  placeholder="Введите имя"
                  className="settings-info-input"
                  maxLength={32}
                  autoFocus
                />
                {displayNameError && <span className="settings-error">{displayNameError}</span>}
                <div className="settings-info-actions">
                  <button className="settings-save-btn" onClick={handleDisplayNameSave}>Сохранить</button>
                  <button className="settings-cancel-btn" onClick={handleDisplayNameCancel}>Отмена</button>
                </div>
              </div>
            ) : (
              <>
                <div className="settings-info-value">{currentUser?.displayName || currentUser?.username || 'Пользователь'}</div>
                <button className="settings-change-btn" onClick={handleDisplayNameEdit}>Изменить</button>
              </>
            )}
          </div>

          <div className="settings-info-item">
            <div className="settings-info-label">Имя пользователя</div>
            <div className="settings-info-value">{currentUser?.username || 'Пользователь'}</div>
          </div>

          <div className="settings-info-item">
            <div className="settings-info-label">Электронная почта</div>
            <div className="settings-info-value">
              {currentUser?.email ? `${currentUser.email.substring(0, 3)}***${currentUser.email.substring(currentUser.email.indexOf('@'))}` : '***@gmail.com'}
            </div>
            <button className="settings-change-btn">Изменить</button>
          </div>

          <div className="settings-info-item">
            <div className="settings-info-label">Настройки звука</div>
            <div className="settings-info-value">Качество голосового чата</div>
            <button className="settings-change-btn" onClick={() => setShowAudioSettings(true)}>
              Настроить
            </button>
          </div>
            </>
          )}

          {activeTab === 'admin' && isPuncher && (
            <div className="settings-admin-section-content">
              <div className="settings-admin-header">
                <h3>Admin panel</h3>
                <span className="admin-badge">ADMIN</span>
              </div>
              <p className="admin-description">
                Вы можете назначать любые теги пользователям. Теги будут отображаться рядом с их именами.
              </p>
              <div className="badge-assign-form">
                <div className="badge-form-group">
                  <label>Имя пользователя</label>
                  <input
                    type="text"
                    value={targetUsername}
                    onChange={(e) => setTargetUsername(e.target.value)}
                    placeholder="Введите username"
                    className="badge-input"
                    disabled={isAssigningBadge}
                  />
                </div>
                <div className="badge-form-group">
                  <label>Тег (макс. 4 символа)</label>
                  <input
                    type="text"
                    value={badgeText}
                    onChange={(e) => setBadgeText(e.target.value)}
                    placeholder="Например: Dev, VIP, Mod"
                    className="badge-input"
                    disabled={isAssigningBadge}
                    maxLength={4}
                  />
                </div>
                <div className="badge-form-group">
                  <label>Подсказка (опционально)</label>
                  <input
                    type="text"
                    value={badgeTooltipText}
                    onChange={(e) => setBadgeTooltipText(e.target.value)}
                    placeholder="Описание тега"
                    className="badge-input"
                    disabled={isAssigningBadge}
                  />
                </div>
                {badgeError && <div className="badge-error">{badgeError}</div>}
                {badgeSuccess && <div className="badge-success">{badgeSuccess}</div>}
                <button
                  className="badge-assign-btn"
                  onClick={handleAssignBadge}
                  disabled={isAssigningBadge}
                >
                  {isAssigningBadge ? 'Назначение...' : 'Назначить тег'}
                </button>
              </div>
            </div>
          )}
        </div>

        <button className="settings-logout-btn" onClick={handleLogout}>
          Выйти из аккаунта
        </button>

        <AudioSettingsModal
          isOpen={showAudioSettings}
          onClose={() => setShowAudioSettings(false)}
          onSettingsChange={(settings) => {
            // Сохранить настройки в localStorage
            localStorage.setItem('audioSettings', JSON.stringify(settings));
          }}
        />
      </div>
    </div>
  );
}

export default UserSettingsModal;

