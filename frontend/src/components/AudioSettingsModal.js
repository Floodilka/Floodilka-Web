import React, { useState, useEffect } from 'react';
import './AudioSettingsModal.css';

function AudioSettingsModal({ isOpen, onClose, onSettingsChange }) {
  const [settings, setSettings] = useState({
    audioQuality: 'ultra', // low, medium, high, ultra
    noiseSuppression: true,
    echoCancellation: true,
    micSensitivity: 15,
    audioBitrate: 256000,
    networkQuality: 'good'
  });

  useEffect(() => {
    if (onSettingsChange) {
      onSettingsChange(settings);
    }
  }, [settings, onSettingsChange]);

  const handleQualityChange = (quality) => {
    const bitrateMap = {
      low: 64000,
      medium: 128000,
      high: 192000,
      ultra: 256000
    };

    setSettings(prev => ({
      ...prev,
      audioQuality: quality,
      audioBitrate: bitrateMap[quality]
    }));
  };

  const handleSensitivityChange = (sensitivity) => {
    setSettings(prev => ({
      ...prev,
      micSensitivity: parseInt(sensitivity)
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="audio-settings-modal">
        <div className="modal-header">
          <h2>Настройки звука</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-content">
          <div className="settings-section">
            <h3>Качество звука</h3>
            <div className="quality-buttons">
              <button
                className={`quality-btn ${settings.audioQuality === 'low' ? 'active' : ''}`}
                onClick={() => handleQualityChange('low')}
              >
                <div className="quality-info">
                  <span className="quality-name">Низкое</span>
                  <span className="quality-desc">64 kbps • Экономия трафика</span>
                </div>
              </button>
              <button
                className={`quality-btn ${settings.audioQuality === 'medium' ? 'active' : ''}`}
                onClick={() => handleQualityChange('medium')}
              >
                <div className="quality-info">
                  <span className="quality-name">Среднее</span>
                  <span className="quality-desc">128 kbps • Баланс</span>
                </div>
              </button>
              <button
                className={`quality-btn ${settings.audioQuality === 'high' ? 'active' : ''}`}
                onClick={() => handleQualityChange('high')}
              >
                <div className="quality-info">
                  <span className="quality-name">Высокое</span>
                  <span className="quality-desc">192 kbps • Хорошее качество</span>
                </div>
              </button>
              <button
                className={`quality-btn ${settings.audioQuality === 'ultra' ? 'active' : ''}`}
                onClick={() => handleQualityChange('ultra')}
              >
                <div className="quality-info">
                  <span className="quality-name">Максимальное</span>
                  <span className="quality-desc">256 kbps • Студийное качество</span>
                </div>
              </button>
            </div>
          </div>

          <div className="settings-section">
            <h3>Обработка звука</h3>
            <div className="toggle-options">
              <label className="toggle-option">
                <input
                  type="checkbox"
                  checked={settings.noiseSuppression}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    noiseSuppression: e.target.checked
                  }))}
                />
                <span className="toggle-label">
                  <span className="toggle-name">Шумоподавление</span>
                  <span className="toggle-desc">Убирает фоновые шумы</span>
                </span>
              </label>

              <label className="toggle-option">
                <input
                  type="checkbox"
                  checked={settings.echoCancellation}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    echoCancellation: e.target.checked
                  }))}
                />
                <span className="toggle-label">
                  <span className="toggle-name">Подавление эха</span>
                  <span className="toggle-desc">Предотвращает эхо и обратную связь</span>
                </span>
              </label>
            </div>
          </div>

          <div className="settings-section">
            <h3>Чувствительность микрофона</h3>
            <div className="sensitivity-control">
              <input
                type="range"
                min="5"
                max="50"
                value={settings.micSensitivity}
                onChange={(e) => handleSensitivityChange(e.target.value)}
                className="sensitivity-slider"
              />
              <div className="sensitivity-labels">
                <span>Низкая</span>
                <span>Высокая</span>
              </div>
              <div className="sensitivity-value">
                Текущее значение: {settings.micSensitivity}
              </div>
            </div>
          </div>

          <div className="settings-section">
            <h3>Статус сети</h3>
            <div className="network-status">
              <div className={`status-indicator ${settings.networkQuality}`}>
                <div className="status-dot"></div>
                <span className="status-text">
                  {settings.networkQuality === 'excellent' && 'Отличное соединение'}
                  {settings.networkQuality === 'good' && 'Хорошее соединение'}
                  {settings.networkQuality === 'poor' && 'Плохое соединение'}
                </span>
              </div>
              <div className="bitrate-info">
                Текущий битрейт: {Math.round(settings.audioBitrate / 1000)} kbps
              </div>
            </div>
          </div>

          <div className="settings-section">
            <h3>Техническая информация</h3>
            <div className="tech-info">
              <div className="tech-item">
                <span className="tech-label">Кодек:</span>
                <span className="tech-value">Opus</span>
              </div>
              <div className="tech-item">
                <span className="tech-label">Частота дискретизации:</span>
                <span className="tech-value">48 kHz</span>
              </div>
              <div className="tech-item">
                <span className="tech-label">Разрядность:</span>
                <span className="tech-value">24-bit</span>
              </div>
              <div className="tech-item">
                <span className="tech-label">Каналы:</span>
                <span className="tech-value">Стерео (2.0)</span>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="apply-btn" onClick={onClose}>
            Применить настройки
          </button>
        </div>
      </div>
    </div>
  );
}

export default AudioSettingsModal;
