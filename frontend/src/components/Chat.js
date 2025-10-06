import React, { useState, useEffect, useRef } from 'react';
import './Chat.css';

const BACKEND_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : `${window.location.protocol}//${window.location.hostname}`;

function Chat({ channel, messages, username, onSendMessage, hasServer }) {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmedValue = inputValue.trim();
    if (trimmedValue) {
      onSendMessage(trimmedValue);
      setInputValue('');
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!channel) {
    // Показываем welcome-экран только если есть выбранный сервер
    if (hasServer) {
      return (
        <div className="chat">
          <div className="no-channel">
            <h2>Добро пожаловать в Болтушку! 👋</h2>
            <p>Выберите канал слева, чтобы начать общение</p>
          </div>
        </div>
      );
    }
    // Если сервер не выбран, показываем пустой экран
    return <div className="chat" />;
  }

  return (
    <div className="chat">
      <div className="chat-header">
        <span className="channel-icon">#</span>
        <h3>{channel.name}</h3>
      </div>

      <div className="messages-container" ref={messagesContainerRef}>
        <div className="messages-welcome">
          <div className="welcome-icon">#</div>
          <h2>Добро пожаловать в #{channel.name}!</h2>
          <p>Это начало канала #{channel.name}</p>
        </div>

        {messages.map((message) => (
          <div
            key={message.id}
            className={`message ${message.isSystem ? 'system-message' : ''} ${message.username === username ? 'own-message' : ''}`}
          >
            <div className="message-avatar">
              {message.isSystem ? (
                '🤖'
              ) : message.avatar ? (
                <img
                  src={`${BACKEND_URL}${message.avatar}`}
                  alt={message.username}
                  onError={(e) => {
                    // Если изображение не загрузилось, показываем букву
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
              ) : null}
              <div className="message-avatar-fallback" style={{ display: message.avatar ? 'none' : 'flex' }}>
                {message.username[0].toUpperCase()}
              </div>
            </div>
            <div className="message-content">
              <div className="message-header">
                <span className="message-username">{message.username}</span>
                {message.badge && message.badge !== 'User' && (
                  <span
                    className={`message-badge badge-${message.badge.toLowerCase()}`}
                    title={message.badgeTooltip || message.badge}
                  >
                    {message.badge}
                  </span>
                )}
                <span className="message-time">{formatTime(message.timestamp)}</span>
              </div>
              <div className="message-text">{message.content}</div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="message-input-container">
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder={`Написать в #${channel.name}`}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            maxLength={2000}
          />
          <button type="submit" disabled={!inputValue.trim()}>
            Отправить
          </button>
        </form>
      </div>
    </div>
  );
}

export default Chat;

