import React, { useState } from 'react';
import './UserSettingsModal.css';

const BACKEND_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : `${window.location.protocol}//${window.location.hostname}`;

function UserSettingsModal({ user, onClose, onLogout, onAvatarUpdate }) {
  const [uploading, setUploading] = useState(false);
  const [isEditingDisplayName, setIsEditingDisplayName] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState('');
  const [displayNameError, setDisplayNameError] = useState('');

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
      const updatedUser = { ...user, avatar: data.avatar };
      localStorage.setItem('user', JSON.stringify(updatedUser));

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
    setNewDisplayName(user?.displayName || user?.username || '');
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

      // Обновить пользователя в localStorage
      const updatedUser = { ...user, displayName: data.displayName };
      localStorage.setItem('user', JSON.stringify(updatedUser));

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

  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div className="settings-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="settings-modal-header">
          <h2>Моя учётная запись</h2>
          <button className="settings-close-btn" onClick={onClose}>
            <span>✕</span>
          </button>
        </div>

        <div className="settings-profile-section">
          <div className="settings-profile-banner">
            <label className="settings-profile-avatar-wrapper" title="Изменить аватар">
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                disabled={uploading}
                style={{ display: 'none' }}
              />
              {user?.avatar ? (
                <img
                  src={`${BACKEND_URL}${user.avatar}`}
                  alt="Avatar"
                  className="settings-profile-avatar-img"
                />
              ) : (
                <div className="settings-profile-avatar">
                  {(user?.displayName || user?.username)?.charAt(0).toUpperCase() || 'U'}
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
              <h3>{user?.displayName || user?.username || 'Пользователь'}</h3>
              {user?.badge && user.badge !== 'User' && (
                <div className="settings-profile-badge" title={user.badgeTooltip || user.badge}>
                  {user.badge}
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
                <div className="settings-info-value">{user?.displayName || user?.username || 'Пользователь'}</div>
                <button className="settings-change-btn" onClick={handleDisplayNameEdit}>Изменить</button>
              </>
            )}
          </div>

          <div className="settings-info-item">
            <div className="settings-info-label">Имя пользователя</div>
            <div className="settings-info-value">{user?.username || 'Пользователь'}</div>
          </div>

          <div className="settings-info-item">
            <div className="settings-info-label">Электронная почта</div>
            <div className="settings-info-value">
              {user?.email ? `${user.email.substring(0, 3)}***${user.email.substring(user.email.indexOf('@'))}` : '***@gmail.com'}
            </div>
            <button className="settings-change-btn">Изменить</button>
          </div>
        </div>

        <button className="settings-logout-btn" onClick={handleLogout}>
          Выйти из аккаунта
        </button>
      </div>
    </div>
  );
}

export default UserSettingsModal;

