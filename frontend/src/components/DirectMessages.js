import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import './DirectMessages.css';
import UserProfile from './UserProfile';
import { useGlobalUsers } from '../context/GlobalUsersContext';

const BACKEND_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : `${window.location.protocol}//${window.location.hostname}`;

function DirectMessages({ user, socket, onLogout, onAvatarUpdate, autoSelectUser, onAutoSelectComplete, onUnreadDMsUpdate, isMuted, isDeafened, isInVoice, isSpeaking, onToggleMute, onToggleDeafen, onDisconnect, onDMUserSelect, showOnlyList, showOnlyChat }) {
  const navigate = useNavigate();
  const { globalOnlineUsers } = useGlobalUsers();
  const [directMessages, setDirectMessages] = useState([]);
  const [selectedDM, setSelectedDM] = useState(null);
  const [selectedMessages, setSelectedMessages] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [error, setError] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const messagesEndRef = useRef(null);
  const lastProcessedUserIdRef = useRef(null);

  // Функция для проверки онлайн статуса пользователя
  const isUserOnline = useCallback((userId) => {
    return globalOnlineUsers.some(onlineUser => onlineUser.userId === userId);
  }, [globalOnlineUsers]);

  // Функция для прокрутки к последнему сообщению
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
    }
  }, []);

  // Функция для отправки сообщения
  const handleSendMessage = async (e) => {
    e.preventDefault();

    const currentDM = selectedDM || autoSelectUser;
    if (!inputValue.trim() || !currentDM || sendingMessage) {
      return;
    }

    setSendingMessage(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`${BACKEND_URL}/api/direct-messages/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          receiverId: currentDM._id,
          content: inputValue.trim()
        })
      });

      if (!response.ok) {
        throw new Error('Ошибка отправки сообщения');
      }

      const newMessage = await response.json();
      console.log('✅ Сообщение отправлено:', newMessage);

      // Добавляем новое сообщение в список
      setSelectedMessages(prev => [...prev, newMessage]);

      // Обновляем список разговоров с новым последним сообщением
      setDirectMessages(prev => {
        const updatedDMs = prev.map(dm => {
          if (dm._id === currentDM._id) {
            return {
              ...dm,
              lastMessage: {
                _id: newMessage._id,
                content: newMessage.content,
                timestamp: newMessage.timestamp,
                sender: {
                  _id: newMessage.sender._id,
                  username: newMessage.sender.username,
                  displayName: newMessage.sender.displayName,
                  avatar: newMessage.sender.avatar
                }
              }
            };
          }
          return dm;
        });

        // Перемещаем обновленный разговор в начало списка
        const updatedDM = updatedDMs.find(dm => dm._id === currentDM._id);
        const otherDMs = updatedDMs.filter(dm => dm._id !== currentDM._id);
        return [updatedDM, ...otherDMs];
      });

      // Очищаем поле ввода
      setInputValue('');

      // Прокручиваем к последнему сообщению
      setTimeout(() => scrollToBottom(), 100);

    } catch (err) {
      console.error('❌ Ошибка отправки сообщения:', err);
      setError('Ошибка отправки сообщения');
    } finally {
      setSendingMessage(false);
    }
  };

  // Обработка нажатия клавиш
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
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
        currentGroup.senderId !== message.sender._id ||
        currentGroup.hour !== messageHour ||
        currentGroup.minute !== messageMinute;

      if (shouldStartNewGroup) {
        // Создаем новую группу
        currentGroup = {
          senderId: message.sender._id,
          sender: message.sender,
          hour: messageHour,
          minute: messageMinute,
          messages: [message],
          timestamp: message.timestamp,
          isOwn: message.sender._id === user?.id
        };
        grouped.push(currentGroup);
      } else {
        // Добавляем сообщение в существующую группу
        currentGroup.messages.push(message);
      }
    });

    return grouped;
  };

  // Мемоизируем функцию загрузки разговоров
  const loadDirectMessages = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      console.log('📥 Загружаем список разговоров...');
      const response = await fetch(`${BACKEND_URL}/api/direct-messages/conversations`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Ошибка загрузки личных сообщений');
      }

      const data = await response.json();
      console.log('📥 Получены разговоры:', data);

      // Фильтруем и валидируем данные
      const validConversations = Array.isArray(data)
        ? data.filter(conv => {
            const isValid = conv && conv.user && conv.user._id && conv.user.username;
            if (!isValid) {
              console.warn('⚠️ Невалидный разговор отфильтрован:', conv);
            }
            return isValid;
          })
        : [];

      if (validConversations.length !== data.length) {
        console.warn(`⚠️ Отфильтровано ${data.length - validConversations.length} невалидных разговоров`);
      }

      setDirectMessages(validConversations);
    } catch (err) {
      console.error('Ошибка загрузки личных сообщений:', err);
      setError('Не удалось загрузить личные сообщения');
      setDirectMessages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Мемоизируем функцию загрузки сообщений
  const loadMessagesWithUser = useCallback(async (userId) => {
    setMessagesLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      console.log('📥 Загружаем сообщения с пользователем:', userId);
      const response = await fetch(`${BACKEND_URL}/api/direct-messages/conversation/${userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Ошибка загрузки сообщений');
      }

      const data = await response.json();
      console.log('📥 Получены сообщения:', data);
      setSelectedMessages(data);
    } catch (err) {
      console.error('Ошибка загрузки сообщений:', err);
      setSelectedMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadDirectMessages();
    }
  }, [user, loadDirectMessages]);

  // Автоматический выбор разговора (десктоп: по userId из URL; мобильный: приходит объект разговора)
  useEffect(() => {
    if (!autoSelectUser) {
      lastProcessedUserIdRef.current = null;
      return;
    }

    // Попытка №1: стандартный путь — у нас есть userId в авто-выборе и загружен список разговоров
    if (directMessages.length > 0 && (autoSelectUser.userId || autoSelectUser.user?._id)) {
      const targetUserId = autoSelectUser.userId || autoSelectUser.user?._id;

      // Предотвращаем повторную обработку того же пользователя
      if (lastProcessedUserIdRef.current === targetUserId) {
        return;
      }

      const conversation = directMessages.find(dm => dm?._id === targetUserId || dm?.user?._id === targetUserId);

      if (conversation) {
        console.log('🎯 Автоматически выбираем разговор с:', conversation.user?.username);
        lastProcessedUserIdRef.current = targetUserId;
        setSelectedDM(conversation);
        setInputValue('');
        loadMessagesWithUser(conversation._id);

        if (conversation.unreadCount > 0) {
          try {
            const token = localStorage.getItem('token');
            if (token) {
              console.log('📖 Отмечаем сообщения как прочитанные для пользователя:', conversation._id);
              fetch(`${BACKEND_URL}/api/direct-messages/read/${conversation._id}`, {
                method: 'PUT',
                headers: {
                  'Authorization': `Bearer ${token}`
                }
              }).then(response => {
                if (response.ok) {
                  setDirectMessages(prev => prev.map(directMsg => {
                    if (directMsg._id === conversation._id) {
                      return { ...directMsg, unreadCount: 0 };
                    }
                    return directMsg;
                  }));
                  console.log('✅ Сообщения отмечены как прочитанные');
                }
              }).catch(err => {
                console.error('❌ Ошибка при отметке сообщений как прочитанных:', err);
              });
            }
          } catch (err) {
            console.error('❌ Ошибка при отметке сообщений как прочитанных:', err);
          }
        }

        if (onAutoSelectComplete) {
          onAutoSelectComplete();
        }
        return;
      }
    }

    // Попытка №2: мобильный путь — нам пришёл целый объект разговора c `_id`
    if (autoSelectUser._id) {
      // Предотвращаем повторную обработку того же пользователя
      if (lastProcessedUserIdRef.current === autoSelectUser._id) {
        return;
      }

      lastProcessedUserIdRef.current = autoSelectUser._id;
      setSelectedDM(prev => prev?._id === autoSelectUser._id ? prev : autoSelectUser);
      setInputValue('');
      loadMessagesWithUser(autoSelectUser._id);

      if (autoSelectUser.unreadCount > 0) {
        try {
          const token = localStorage.getItem('token');
          if (token) {
            console.log('📖 Отмечаем сообщения как прочитанные для пользователя:', autoSelectUser._id);
            fetch(`${BACKEND_URL}/api/direct-messages/read/${autoSelectUser._id}`, {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${token}`
              }
            }).then(response => {
              if (response.ok) {
                setDirectMessages(prev => prev.map(directMsg => {
                  if (directMsg._id === autoSelectUser._id) {
                    return { ...directMsg, unreadCount: 0 };
                  }
                  return directMsg;
                }));
                console.log('✅ Сообщения отмечены как прочитанные');
              }
            }).catch(err => {
              console.error('❌ Ошибка при отметке сообщений как прочитанных:', err);
            });
          }
        } catch (err) {
          console.error('❌ Ошибка при отметке сообщений как прочитанных:', err);
        }
      }

      if (onAutoSelectComplete) {
        onAutoSelectComplete();
      }
      return;
    }

    // Если не нашли разговор — всё равно завершаем авто-выбор
    console.log('⚠️ Разговор для авто-выбора не найден:', autoSelectUser);
    if (onAutoSelectComplete) {
      onAutoSelectComplete();
    }
  }, [autoSelectUser, directMessages, onAutoSelectComplete, loadMessagesWithUser]);

  // Автоматическая прокрутка к последнему сообщению при изменении сообщений
  useEffect(() => {
    if (selectedMessages.length > 0) {
      scrollToBottom();
    }
  }, [selectedMessages, scrollToBottom]);

  // WebSocket обработчики для личных сообщений
  useEffect(() => {
    if (!socket) return;

    const handleDirectMessageNew = (message) => {
      console.log('📨 Получено новое личное сообщение:', message);

      // Если это сообщение для нас (мы получатели)
      if (message.receiver._id === user?.id) {
        // Если это разговор, который сейчас открыт
        if (selectedDM && (message.sender._id === selectedDM._id || message.sender._id === selectedDM?.user?._id)) {
          setSelectedMessages(prev => [...prev, message]);
          setTimeout(() => scrollToBottom(), 100);
        }

        // Обновляем список разговоров
        setDirectMessages(prev => {
          const existingDM = prev.find(dm =>
            dm?.user?._id === message.sender._id || dm?._id === message.sender._id
          );

          if (existingDM) {
            // Обновляем существующий разговор
            const updatedDMs = prev.map(dm => {
              if (dm?.user?._id === message.sender._id || dm?._id === message.sender._id) {
                return {
                  ...dm,
                  lastMessage: {
                    _id: message._id,
                    content: message.content,
                    timestamp: message.timestamp,
                    sender: {
                      _id: message.sender._id,
                      username: message.sender.username,
                      displayName: message.sender.displayName,
                      avatar: message.sender.avatar
                    }
                  },
                  unreadCount: (selectedDM && (message.sender._id === selectedDM._id || message.sender._id === selectedDM?.user?._id))
                    ? dm.unreadCount
                    : dm.unreadCount + 1
                };
              }
              return dm;
            });

            // Перемещаем разговор в начало списка
            const updatedDM = updatedDMs.find(dm => dm?.user?._id === message.sender._id || dm?._id === message.sender._id);
            const otherDMs = updatedDMs.filter(dm => dm?.user?._id !== message.sender._id && dm?._id !== message.sender._id);
            return [updatedDM, ...otherDMs];
          }

          return prev;
        });
      }
    };

    socket.on('direct-message:new', handleDirectMessageNew);

    return () => {
      socket.off('direct-message:new', handleDirectMessageNew);
    };
  }, [socket, user, selectedDM]);

  // Отслеживаем непрочитанные сообщения и уведомляем родительский компонент
  useEffect(() => {
    if (onUnreadDMsUpdate) {
      const hasUnread = directMessages.some(dm => dm.unreadCount > 0);
      onUnreadDMsUpdate(hasUnread);
    }
  }, [directMessages, onUnreadDMsUpdate]);

  const handleSelectDM = useCallback(async (dm) => {
    // Если есть обработчик для мобильного режима, используем его
    if (onDMUserSelect) {
      onDMUserSelect(dm);
      return;
    }

    // Навигация через URL вместо изменения состояния
    navigate(`/channels/@me/${dm._id}`);
  }, [onDMUserSelect, navigate]);

  const filteredDMs = useMemo(() =>
    directMessages.filter(dm =>
      dm?.user?.username?.toLowerCase().includes(searchQuery.toLowerCase())
    ), [directMessages, searchQuery]
  );

  // Если нужно показать только чат (для мобильной версии)
  if (showOnlyChat && autoSelectUser) {
    return (
      <div className="direct-messages-container">
        <div className="dm-chat">
          <div className="dm-chat-active">
            {/* Область сообщений */}
            <div className="dm-messages">
              {messagesLoading ? (
                <div className="dm-loading">Загрузка сообщений...</div>
              ) : selectedMessages.length === 0 ? (
                <div className="dm-messages-empty">
                  <h3>Это начало истории ваших личных сообщений с {autoSelectUser.user?.displayName || autoSelectUser.user?.username || autoSelectUser.username}</h3>
                  <p>Нет общих серверов</p>
                  <div className="dm-actions">
                    <button className="dm-action-btn">Добавить в друзья</button>
                    <button className="dm-action-btn">Заблокировать</button>
                    <button className="dm-action-btn danger">Пожаловаться на спам</button>
                  </div>
                </div>
              ) : (
                groupMessages(selectedMessages).map((group, groupIndex) =>
                  group.messages.map((message, messageIndex) => (
                    <div key={message._id} className={`dm-message ${message.sender._id === user?.id ? 'dm-message-own' : ''} ${messageIndex > 0 ? 'dm-message-grouped' : ''} ${messageIndex === 0 && group.messages.length > 1 ? 'dm-message-group-first' : ''}`}>
                      {messageIndex === 0 && (
                        <div className="dm-message-avatar">
                          {message.sender.avatar ? (
                            <img src={`${BACKEND_URL}${message.sender.avatar}`} alt={message.sender.username} />
                          ) : (
                            <span>{message.sender.username?.charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                      )}
                      {messageIndex > 0 && <div className="dm-message-avatar-spacer"></div>}
                      <div className="dm-message-content">
                        {messageIndex === 0 && (
                          <div className="dm-message-header">
                            <span className="dm-message-username">{message.sender.displayName || message.sender.username}</span>
                            <span className="dm-message-time">
                              {new Date(message.timestamp).toLocaleTimeString('ru-RU', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                        )}
                        <div className="dm-message-text">{message.content}</div>
                      </div>
                    </div>
                  ))
                ).flat()
              )}
              {/* Невидимый элемент для прокрутки к последнему сообщению */}
              <div ref={messagesEndRef} />
            </div>

            {/* Поле ввода */}
            <div className="message-input-container">
              <form onSubmit={handleSendMessage}>
                <input
                  type="text"
                  placeholder={`Написать @${autoSelectUser.user?.displayName || autoSelectUser.user?.username || autoSelectUser.username}`}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  maxLength={2000}
                  disabled={sendingMessage}
                />
                <button type="submit" disabled={!inputValue.trim() || sendingMessage}>
                  {sendingMessage ? 'Отправка...' : 'Отправить'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
            filteredDMs.filter(dm => dm?.user).map((dm) => (
              <div
                key={dm._id}
                className={`dm-item ${selectedDM?._id === dm._id ? 'selected' : ''}`}
                onClick={() => handleSelectDM(dm)}
              >
                <div className="dm-avatar">
                  {dm.user.avatar ? (
                    <img src={`${BACKEND_URL}${dm.user.avatar}`} alt={dm.user.username} />
                  ) : (
                    <span>{dm.user.username?.charAt(0).toUpperCase()}</span>
                  )}
                  <div className={`dm-status-indicator ${isUserOnline(dm.user._id) ? 'online' : 'offline'}`}></div>
                </div>
                <div className="dm-info">
                  <div className="dm-username">{dm.user.displayName || dm.user.username}</div>
                  <div className="dm-last-message">
                    {dm.lastMessage?.content ? (
                      dm.lastMessage.sender._id === user?.id ? (
                        <><span className="dm-you-prefix">ВЫ:</span> {dm.lastMessage.content}</>
                      ) : (
                        dm.lastMessage.content
                      )
                    ) : (
                      'Нет сообщений'
                    )}
                  </div>
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
          isMuted={isMuted}
          isDeafened={isDeafened}
          isInVoice={isInVoice}
          isSpeaking={isSpeaking}
          onToggleMute={onToggleMute}
          onToggleDeafen={onToggleDeafen}
          onDisconnect={onDisconnect}
          onLogout={onLogout}
          onAvatarUpdate={onAvatarUpdate}
        />
      </div>

      {/* Правая панель - чат - показываем только если не только список */}
      {!showOnlyList && (
        <div className="dm-chat">
          {selectedDM && selectedDM.user ? (
            <div className="dm-chat-active">
              {/* Заголовок чата */}
              <div className="dm-chat-header">
                <div className="dm-chat-user">
                  <div className="dm-chat-avatar">
                    {selectedDM.user.avatar ? (
                      <img src={`${BACKEND_URL}${selectedDM.user.avatar}`} alt={selectedDM.user.username} />
                    ) : (
                      <span>{selectedDM.user.username?.charAt(0).toUpperCase()}</span>
                    )}
                    <div className={`dm-status-indicator ${isUserOnline(selectedDM.user._id) ? 'online' : 'offline'}`}></div>
                  </div>
                  <div className="dm-chat-info">
                    <div className="dm-chat-username">{selectedDM.user.displayName || selectedDM.user.username}</div>
                    <div className="dm-chat-status">{isUserOnline(selectedDM.user._id) ? 'В сети' : 'Не в сети'}</div>
                  </div>
                </div>
              </div>

              {/* Область сообщений */}
              <div className="dm-messages">
                {messagesLoading ? (
                  <div className="dm-loading">Загрузка сообщений...</div>
                ) : selectedMessages.length === 0 ? (
                  <div className="dm-messages-empty">
                    <h3>Это начало истории ваших личных сообщений с {selectedDM.user.displayName || selectedDM.user.username}</h3>
                    <p>Нет общих серверов</p>
                    <div className="dm-actions">
                      <button className="dm-action-btn">Добавить в друзья</button>
                      <button className="dm-action-btn">Заблокировать</button>
                      <button className="dm-action-btn danger">Пожаловаться на спам</button>
                    </div>
                  </div>
                ) : (
                  groupMessages(selectedMessages).map((group, groupIndex) =>
                    group.messages.map((message, messageIndex) => (
                      <div key={message._id} className={`dm-message ${message.sender._id === user?.id ? 'dm-message-own' : ''} ${messageIndex > 0 ? 'dm-message-grouped' : ''} ${messageIndex === 0 && group.messages.length > 1 ? 'dm-message-group-first' : ''} ${messageIndex === group.messages.length - 1 ? 'dm-message-group-last' : ''}`}>
                        {messageIndex === 0 && (
                          <div className="dm-message-avatar">
                            {message.sender.avatar ? (
                              <img src={`${BACKEND_URL}${message.sender.avatar}`} alt={message.sender.username} />
                            ) : (
                              <span>{message.sender.username?.charAt(0).toUpperCase()}</span>
                            )}
                          </div>
                        )}
                        {messageIndex > 0 && <div className="dm-message-avatar-spacer"></div>}
                        <div className="dm-message-content">
                          {messageIndex === 0 && (
                            <div className="dm-message-header">
                              <span className="dm-message-username">{message.sender.displayName || message.sender.username}</span>
                              <span className="dm-message-time">
                                {new Date(message.timestamp).toLocaleTimeString('ru-RU', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>
                          )}
                          <div className="dm-message-text">{message.content}</div>
                        </div>
                      </div>
                    ))
                  ).flat()
                )}
                {/* Невидимый элемент для прокрутки к последнему сообщению */}
                <div ref={messagesEndRef} />
              </div>

              {/* Поле ввода */}
              <div className="message-input-container">
                <form onSubmit={handleSendMessage}>
                  <input
                    type="text"
                    placeholder={`Написать @${selectedDM.user.displayName || selectedDM.user.username}`}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    maxLength={2000}
                    disabled={sendingMessage}
                  />
                  <button type="submit" disabled={!inputValue.trim() || sendingMessage}>
                    {sendingMessage ? 'Отправка...' : 'Отправить'}
                  </button>
                </form>
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
      )}
    </div>
  );
}

export default React.memo(DirectMessages);
