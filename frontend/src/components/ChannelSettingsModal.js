import React, { useState, useEffect } from 'react';
import './ChannelSettingsModal.css';

const BACKEND_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : `${window.location.protocol}//${window.location.hostname}`;

function ChannelSettingsModal({ channel, currentServer, isOpen, onClose, onUpdateChannel, onDeleteChannel }) {
  const [channelName, setChannelName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (channel && isOpen) {
      setChannelName(channel.name || '');
    }
  }, [channel, isOpen]);

  const handleSave = async () => {
    if (!channel || !currentServer) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${BACKEND_URL}/api/servers/${currentServer._id}/channels/${channel.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: channelName
        })
      });

      if (response.ok) {
        const updatedChannel = await response.json();
        if (onUpdateChannel) {
          onUpdateChannel(updatedChannel);
        }
        onClose();
      } else {
        console.error('Ошибка обновления канала');
      }
    } catch (err) {
      console.error('Ошибка обновления канала:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!channel || !currentServer) return;

    if (window.confirm(`Вы уверены, что хотите удалить канал "${channel.name}"?`)) {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${BACKEND_URL}/api/servers/${currentServer._id}/channels/${channel.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          if (onDeleteChannel) {
            onDeleteChannel(channel.id);
          }
          onClose();
        } else {
          console.error('Ошибка удаления канала');
        }
      } catch (err) {
        console.error('Ошибка удаления канала:', err);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen || !channel) return null;

  return (
    <div className="channel-settings-modal-overlay" onClick={onClose}>
      <div className="channel-settings-modal" onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown} tabIndex={-1}>
        {/* Header */}
        <div className="channel-settings-header">
          <div className="channel-settings-header-content">
            <div className="channel-settings-title">
              <span className="channel-settings-icon">
                {channel.type === 'text' ? '#' : ''}
              </span>
              <span className="channel-settings-name">{channel.name}</span>
              <span className="channel-settings-separator">—</span>
              <span className="channel-settings-section">Обзор</span>
            </div>
            <button className="channel-settings-close" onClick={onClose}>
              <span className="close-icon">✕</span>
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="channel-settings-content">
          <div className="channel-settings-sidebar">
            <div className="channel-settings-nav">
              <div className="nav-item active">
                <span>Обзор</span>
              </div>
            </div>

            <div className="channel-settings-danger">
              <button className="danger-button" onClick={handleDelete} disabled={loading}>
                <img src="/icons/trash.png" alt="Удалить" className="danger-icon" />
                <span>Удалить канал</span>
              </button>
            </div>
          </div>

          <div className="channel-settings-main">
            <div className="settings-section">
              <h2>Обзор</h2>

              {/* Название канала */}
              <div className="setting-group">
                <label className="setting-label">
                  Название канала
                </label>
                <div className="setting-input-group">
                  <span className="channel-prefix">
                    {channel.type === 'text' ? '#' : (
                      <img src="/icons/channel.png" alt="Голосовой канал" className="channel-prefix-icon" />
                    )}
                  </span>
                  <input
                    type="text"
                    value={channelName}
                    onChange={(e) => setChannelName(e.target.value)}
                    className="setting-input"
                    placeholder="Введите название канала"
                    maxLength={30}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="channel-settings-footer">
          <div className="footer-info">
            <span>Настройки канала сохранены автоматически</span>
          </div>
          <div className="footer-actions">
            <button className="btn-secondary" onClick={onClose}>
              Отмена
            </button>
            <button
              className="btn-primary"
              onClick={handleSave}
              disabled={loading}
            >
              {loading ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChannelSettingsModal;
