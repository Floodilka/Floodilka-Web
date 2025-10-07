import React, { useState, useEffect } from 'react';
import './DirectMessages.css';
import UserProfile from './UserProfile';

const BACKEND_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : `${window.location.protocol}//${window.location.hostname}`;

function DirectMessages({ user, onLogout, onAvatarUpdate }) {
  const [directMessages, setDirectMessages] = useState([]);
  const [selectedDM, setSelectedDM] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      loadDirectMessages();
    }
  }, [user]);

  const loadDirectMessages = async () => {
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      // Пока что возвращаем пустой массив, так как бэкенд еще не готов
      // const response = await fetch(`${BACKEND_URL}/api/direct-messages`, {
      //   headers: {
      //     'Authorization': `Bearer ${token}`
      //   }
      // });

      // if (!response.ok) {
      //   throw new Error('Ошибка загрузки личных сообщений');
      // }

      // const data = await response.json();

      // Временно показываем пустой список
      setDirectMessages([]);
    } catch (err) {
      console.error('Ошибка загрузки личных сообщений:', err);
      setError('Не удалось загрузить личные сообщения');
    } finally {
      setLoading(false);
    }
  };


  const filteredDMs = directMessages.filter(dm =>
    dm.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="direct-messages-container">
      {/* Левая панель - список личных сообщений */}
      <div className="dm-sidebar">
        <div className="dm-header">
          <h2>Личные сообщения</h2>
        </div>

        <div className="dm-search">
          <input
            type="text"
            placeholder="Найти или начать беседу"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="dm-list">
          {loading ? (
            <div className="dm-loading">Загрузка...</div>
          ) : error ? (
            <div className="dm-error">{error}</div>
          ) : filteredDMs.length === 0 ? (
            <div className="dm-empty">
              <p>У вас пока нет личных сообщений</p>
              <p>Начните общение с друзьями!</p>
            </div>
          ) : (
            filteredDMs.map((dm) => (
              <div
                key={dm.id}
                className={`dm-item ${selectedDM?.id === dm.id ? 'selected' : ''}`}
                onClick={() => setSelectedDM(dm)}
              >
                <div className="dm-avatar">
                  {dm.avatar ? (
                    <img src={dm.avatar} alt={dm.username} />
                  ) : (
                    <span>{dm.username?.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div className="dm-info">
                  <div className="dm-username">{dm.username}</div>
                  <div className="dm-last-message">{dm.lastMessage || 'Нет сообщений'}</div>
                </div>
                {dm.unreadCount > 0 && (
                  <div className="dm-unread">{dm.unreadCount}</div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Пользовательский профиль */}
        <UserProfile
          user={user}
          isMuted={false}
          isDeafened={false}
          isInVoice={false}
          isSpeaking={false}
          onToggleMute={() => {}}
          onToggleDeafen={() => {}}
          onDisconnect={() => {}}
          onLogout={onLogout}
          onAvatarUpdate={onAvatarUpdate}
        />
      </div>

      {/* Правая панель - чат */}
      <div className="dm-chat">
        {selectedDM ? (
          <div className="dm-chat-active">
            {/* Заголовок чата */}
            <div className="dm-chat-header">
              <div className="dm-chat-user">
                <div className="dm-chat-avatar">
                  {selectedDM.avatar ? (
                    <img src={selectedDM.avatar} alt={selectedDM.username} />
                  ) : (
                    <span>{selectedDM.username?.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div className="dm-chat-info">
                  <div className="dm-chat-username">{selectedDM.username}</div>
                  <div className="dm-chat-status">В сети</div>
                </div>
              </div>
              <div className="dm-chat-controls">
                <button className="chat-control-btn" title="Позвонить">
                  <span>📞</span>
                </button>
                <button className="chat-control-btn" title="Видеозвонок">
                  <span>📹</span>
                </button>
                <button className="chat-control-btn" title="Настройки">
                  <span>⚙️</span>
                </button>
              </div>
            </div>

            {/* Область сообщений */}
            <div className="dm-messages">
              <div className="dm-messages-empty">
                <h3>Это начало истории ваших личных сообщений с {selectedDM.username}</h3>
                <p>Нет общих серверов</p>
                <div className="dm-actions">
                  <button className="dm-action-btn">Добавить в друзья</button>
                  <button className="dm-action-btn">Заблокировать</button>
                  <button className="dm-action-btn danger">Пожаловаться на спам</button>
                </div>
              </div>
            </div>

            {/* Поле ввода */}
            <div className="dm-input-area">
              <button className="dm-attachment-btn">
                <span>➕</span>
              </button>
              <div className="dm-input-container">
                <input
                  type="text"
                  placeholder={`Написать @${selectedDM.username}`}
                  className="dm-input"
                />
              </div>
              <div className="dm-input-controls">
                <button className="dm-input-btn" title="Подарок">
                  <span>🎁</span>
                </button>
                <button className="dm-input-btn" title="GIF">
                  <span>🎬</span>
                </button>
                <button className="dm-input-btn" title="Стикеры">
                  <span>😊</span>
                </button>
                <button className="dm-input-btn" title="Эмодзи">
                  <span>😀</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="dm-chat-empty">
            <div className="dm-chat-empty-content">
              <h2>Добро пожаловать в личные сообщения!</h2>
              <p>Выберите разговор из списка слева или начните новое сообщение.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DirectMessages;
