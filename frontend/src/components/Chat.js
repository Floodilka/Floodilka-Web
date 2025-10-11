import React, { useState, useEffect, useRef } from 'react';
import './Chat.css';

const BACKEND_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : `${window.location.protocol}//${window.location.hostname}`;

function Chat({ channel, messages, username, user, currentServer, onSendMessage, hasServer, hasTextChannels, serverLoading, socket, onMessageSent }) {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [profilePosition, setProfilePosition] = useState({ top: 0, left: 0 });
  const [contextMenu, setContextMenu] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [userPermissions, setUserPermissions] = useState(null);
  const [deletingMessageId, setDeletingMessageId] = useState(null);

  const handleUserClick = async (message, event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setProfilePosition({
      top: rect.top,
      left: rect.right + 8
    });

    // Если есть userId, загрузить актуальные данные пользователя
    if (message.userId) {
      try {
        const response = await fetch(`${BACKEND_URL}/api/auth/user/${message.userId}`);
        if (response.ok) {
          const userData = await response.json();
          setSelectedUser(userData);
          return;
        }
      } catch (err) {
        console.error('Ошибка загрузки данных пользователя:', err);
      }
    }

    // Fallback: использовать данные из сообщения
    setSelectedUser({
      username: message.username,
      displayName: message.displayName,
      avatar: message.avatar,
      badge: message.badge,
      badgeTooltip: message.badgeTooltip
    });
  };

  const handleCloseProfile = () => {
    setSelectedUser(null);
    setMessageText('');
  };

  // Загрузка прав пользователя при смене сервера
  useEffect(() => {
    const loadUserPermissions = async () => {
      if (!currentServer || !user?.id) {
        setUserPermissions(null);
        return;
      }

      try {
        const response = await fetch(
          `${BACKEND_URL}/api/roles/servers/${currentServer._id}/users/${user.id}/roles`,
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          }
        );

        if (response.ok) {
          const userRoles = await response.json();

          // Объединяем права из всех ролей
          const combinedPermissions = userRoles.reduce((acc, userRole) => {
            if (userRole.roleId && userRole.roleId.permissions) {
              Object.keys(userRole.roleId.permissions).forEach(key => {
                if (userRole.roleId.permissions[key]) {
                  acc[key] = true;
                }
              });
            }
            return acc;
          }, {});

          // Проверяем, является ли владельцем
          if (currentServer.ownerId === user.id) {
            combinedPermissions.isOwner = true;
            combinedPermissions.manageServer = true;
            combinedPermissions.manageMessages = true;
          }

          setUserPermissions(combinedPermissions);
        }
      } catch (err) {
        console.error('Ошибка загрузки прав:', err);
        setUserPermissions(null);
      }
    };

    loadUserPermissions();
  }, [currentServer, user]);

  const handleSendDirectMessage = async () => {
    if (!messageText.trim() || !selectedUser || sendingMessage) return;

    // Не отправляем сообщение самому себе
    if (selectedUser.userId === username || selectedUser.username === username) return;

    setSendingMessage(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Токен не найден');

      const response = await fetch(`${BACKEND_URL}/api/direct-messages/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          receiverId: selectedUser.userId || selectedUser.id,
          content: messageText.trim()
        })
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Ошибка отправки сообщения:', response.status, error);
        throw new Error(error.error || 'Ошибка отправки сообщения');
      }

      setMessageText('');

      // Вызываем колбэк для открытия DM с этим пользователем
      if (onMessageSent && selectedUser) {
        onMessageSent(selectedUser);
      }
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

  const handleMoreActions = (message, event) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    setContextMenu({
      message,
      position: {
        top: rect.top + rect.height / 2 - 18, // Центрируем по вертикали
        left: rect.left - 210
      }
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  const canEditMessage = (message) => {
    if (message.username !== username) return false;
    if (message.isSystem) return false;

    const messageTime = new Date(message.timestamp);
    const now = new Date();
    const diffInHours = (now - messageTime) / (1000 * 60 * 60);

    return diffInHours <= 24;
  };

  const canDeleteMessage = (message) => {
    if (message.isSystem) return false;

    // Можно удалить свое сообщение
    if (message.username === username) return true;

    // Проверяем права администратора
    if (userPermissions && (
      userPermissions.manageMessages ||
      userPermissions.manageServer ||
      userPermissions.isOwner
    )) {
      return true;
    }

    return false;
  };

  const handleEditMessage = (message) => {
    setEditingMessage(message);
    setEditValue(message.content);
    setContextMenu(null);
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setEditValue('');
  };

  const handleSaveEdit = () => {
    if (!editingMessage || !editValue.trim() || !socket) return;

    socket.emit('message:edit', {
      messageId: editingMessage.id,
      content: editValue.trim()
    });

    setEditingMessage(null);
    setEditValue('');
  };

  const handleDeleteMessage = (message) => {
    if (!window.confirm('Вы уверены, что хотите удалить это сообщение?')) return;
    if (!socket) return;

    // Сначала запускаем анимацию
    setDeletingMessageId(message.id);
    setContextMenu(null);

    // Через 300мс отправляем запрос на удаление
    setTimeout(() => {
      socket.emit('message:delete', {
        messageId: message.id,
        userId: user?.id
      });

      // Сбрасываем состояние после удаления
      setTimeout(() => setDeletingMessageId(null), 100);
    }, 300);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  };

  // Скролл вниз при смене канала
  const prevChannelRef = useRef(null);
  useEffect(() => {
    if (channel?.id !== prevChannelRef.current) {
      prevChannelRef.current = channel?.id;
      // При смене канала всегда скроллим вниз
      setTimeout(scrollToBottom, 100);
    }
  }, [channel?.id]);

  // Умный автоскролл - скроллит только если пользователь был внизу
  const prevMessagesLengthRef = useRef(0);
  useEffect(() => {
    if (!messagesContainerRef.current) return;

    const container = messagesContainerRef.current;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;

    // Скроллим вниз только если:
    // 1. Пользователь был близко к низу (читал новые сообщения)
    // 2. И количество сообщений увеличилось (новое сообщение, а не удаление)
    if (isNearBottom && messages.length >= prevMessagesLengthRef.current) {
      scrollToBottom();
    }

    prevMessagesLengthRef.current = messages.length;
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

  // Функция для группировки сообщений
  const groupMessages = (messages) => {
    if (!messages || messages.length === 0) return [];

    const grouped = [];
    let currentGroup = null;

    messages.forEach((message, index) => {
      const messageTime = new Date(message.timestamp);
      const messageMinute = messageTime.getMinutes();
      const messageHour = messageTime.getHours();

      // Проверяем, нужно ли начать новую группу
      const shouldStartNewGroup = !currentGroup ||
        currentGroup.username !== message.username ||
        currentGroup.hour !== messageHour ||
        currentGroup.minute !== messageMinute;

      if (shouldStartNewGroup) {
        // Создаем новую группу
        currentGroup = {
          username: message.username,
          userId: message.userId,
          hour: messageHour,
          minute: messageMinute,
          messages: [message],
          timestamp: message.timestamp,
          isOwn: message.username === username
        };
        grouped.push(currentGroup);
      } else {
        // Добавляем сообщение в существующую группу
        currentGroup.messages.push(message);
      }
    });

    return grouped;
  };

  if (!channel) {
    // Показываем welcome-экран только если есть выбранный сервер
    if (hasServer) {
      return (
        <div className="chat">
          <div className="no-channel">
            {serverLoading ? (
              <>
                <h2>Загрузка...</h2>
                <p>Загружаем каналы сервера</p>
              </>
            ) : hasTextChannels ? (
              <>
                <h2>Добро пожаловать во Флудилку! 👋</h2>
                <p>Выберите канал слева, чтобы начать общение</p>
              </>
            ) : (
              <>
                <h2>НЕТ ТЕКСТОВЫХ КАНАЛОВ</h2>
                <p>Вы оказались в странном месте. У вас нет доступа к текстовым каналам, или на этом сервере их нет.</p>
              </>
            )}
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

        {groupMessages(messages).map((group, groupIndex) =>
          group.messages.map((message, messageIndex) => (
            <div
              key={message.id}
              className={`message ${message.isSystem ? 'system-message' : ''} ${message.username === username ? 'own-message' : ''} ${editingMessage?.id === message.id ? 'message-edit-mode' : ''} ${contextMenu?.message.id === message.id ? 'show-actions' : ''} ${messageIndex > 0 ? 'message-grouped' : ''} ${messageIndex === 0 && group.messages.length > 1 ? 'message-group-first' : ''} ${messageIndex === group.messages.length - 1 ? 'message-group-last' : ''} ${deletingMessageId === message.id ? 'message-deleting' : ''}`}
            >
              {messageIndex === 0 ? (
                <div
                  className="message-avatar"
                  onClick={(e) => !message.isSystem && handleUserClick(message, e)}
                  style={{ cursor: message.isSystem ? 'default' : 'pointer' }}
                >
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
                    {(message.displayName || message.username)[0].toUpperCase()}
                  </div>
                </div>
              ) : (
                <div className="message-avatar-spacer"></div>
              )}
              <div className="message-content">
                {messageIndex === 0 && (
                  <div className="message-header">
                    <span
                      className="message-username"
                      onClick={(e) => !message.isSystem && handleUserClick(message, e)}
                      style={{ cursor: message.isSystem ? 'default' : 'pointer' }}
                    >
                      {message.displayName || message.username}
                    </span>
                    {message.badge && message.badge !== 'User' && (
                      <span
                        className="message-badge"
                        title={message.badgeTooltip || message.badge}
                      >
                        {message.badge}
                      </span>
                    )}
                    <span className="message-time">{formatTime(message.timestamp)}</span>
                  </div>
                )}

                {editingMessage?.id === message.id ? (
                  <div>
                    <textarea
                      className="message-edit-input"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSaveEdit();
                        } else if (e.key === 'Escape') {
                          handleCancelEdit();
                        }
                      }}
                      autoFocus
                    />
                    <div className="message-edit-buttons">
                      <button
                        className="message-edit-button save"
                        onClick={handleSaveEdit}
                        disabled={!editValue.trim()}
                      >
                        Сохранить
                      </button>
                      <button
                        className="message-edit-button cancel"
                        onClick={handleCancelEdit}
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="message-text">{message.content}</div>
                )}
              </div>

              {/* Меню действий - показываем если можно редактировать или удалить */}
              {!message.isSystem && (canEditMessage(message) || canDeleteMessage(message)) && (
                <div className="message-actions">
                  <button
                    className="message-actions-button"
                    onClick={(e) => handleMoreActions(message, e)}
                    title="Больше действий"
                  >
                    ⋯
                  </button>
                </div>
              )}
            </div>
          ))
        ).flat()}
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

      {selectedUser && (
        <>
          <div className="user-profile-overlay" onClick={handleCloseProfile} />
          <div
            className="user-profile-card-chat"
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

            {/* Поле для отправки личного сообщения - только если не свой профиль */}
            {selectedUser && (selectedUser.userId !== username && selectedUser.username !== username) && (
              <div className="user-profile-message-input">
                <div className="message-input-container">
                  <input
                    type="text"
                    placeholder={`Сообщение для @${selectedUser.username}`}
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={sendingMessage}
                    className="message-input-field"
                  />
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {contextMenu && (
        <>
          <div className="message-context-overlay" onClick={handleCloseContextMenu} />
          <div
            className="message-context-menu"
            style={{
              top: `${contextMenu.position.top}px`,
              left: `${contextMenu.position.left}px`
            }}
          >
            {canEditMessage(contextMenu.message) && (
              <button
                className="message-context-menu-item"
                onClick={() => handleEditMessage(contextMenu.message)}
              >
                Редактировать
              </button>
            )}
            {canDeleteMessage(contextMenu.message) && (
              <button
                className="message-context-menu-item danger"
                onClick={() => handleDeleteMessage(contextMenu.message)}
              >
                Удалить сообщение
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default Chat;

