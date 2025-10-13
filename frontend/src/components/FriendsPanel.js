import React, { useMemo, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import './FriendsPanel.css';
import { useFriends } from '../context/FriendsContext';
import { useGlobalUsers } from '../context/GlobalUsersContext';

const BACKEND_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : `${window.location.protocol}//${window.location.hostname}`;

const formatDisplayName = (user) => user.displayName || user.username;

const FriendsPanel = ({ onSelectFriend }) => {
  const [activeTab, setActiveTab] = useState('online');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const [friendUsername, setFriendUsername] = useState('');
  const [isAddingFriend, setIsAddingFriend] = useState(false);
  const [addFriendError, setAddFriendError] = useState('');
  const {
    friends,
    incomingRequests,
    outgoingRequests,
    loading,
    error,
    sendFriendRequest,
    respondToRequest,
    cancelOutgoingRequest,
    removeFriend
  } = useFriends();
  const { globalOnlineUsers } = useGlobalUsers();

  const [showAddForm, setShowAddForm] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingRequestId, setProcessingRequestId] = useState(null);

  const onlineUserIds = useMemo(() => {
    return new Set(globalOnlineUsers.map(user => user.userId?.toString()));
  }, [globalOnlineUsers]);

  const sortedFriends = useMemo(() => {
    return [...friends].sort((a, b) => {
      const nameA = formatDisplayName(a).toLowerCase();
      const nameB = formatDisplayName(b).toLowerCase();
      return nameA.localeCompare(nameB, 'ru', { sensitivity: 'base' });
    });
  }, [friends]);

  const onlineFriends = useMemo(() => {
    return sortedFriends.filter(friend => onlineUserIds.has(friend._id?.toString()));
  }, [sortedFriends, onlineUserIds]);

  const offlineFriends = useMemo(() => {
    return sortedFriends.filter(friend => !onlineUserIds.has(friend._id?.toString()));
  }, [sortedFriends, onlineUserIds]);

  const hasRequests = incomingRequests.length > 0;

  const handleFriendClick = useCallback((friend) => {
    if (!friend?._id) return;
    onSelectFriend?.(friend);
  }, [onSelectFriend]);

  const handleRemoveFriend = useCallback(async (friendId) => {
    if (!friendId) return;
    try {
      await removeFriend(friendId);
    } catch (err) {
      console.error('Ошибка удаления из друзей:', err);
    }
  }, [removeFriend]);

  const handleAddFriendSubmit = async (event) => {
    event.preventDefault();
    const trimmed = usernameInput.trim();

    if (!trimmed) {
      setFormError('Введите имя пользователя');
      setFormSuccess('');
      return;
    }

    setIsSubmitting(true);
    setFormError('');
    setFormSuccess('');

    try {
      const result = await sendFriendRequest(trimmed);

      if (result.type === 'accepted') {
        setFormSuccess(`Теперь вы друзья с ${formatDisplayName(result.friend)}!`);
      } else {
        setFormSuccess('Заявка отправлена');
      }

      setUsernameInput('');
      setShowAddForm(false);
    } catch (err) {
      setFormError(err.message || 'Не удалось отправить заявку');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRespond = async (requestId, action) => {
    setProcessingRequestId(requestId);
    setFormError('');

    try {
      await respondToRequest(requestId, action);
    } catch (err) {
      setFormError(err.message || 'Не удалось обработать заявку');
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleCancelOutgoing = async (requestId) => {
    setProcessingRequestId(requestId);
    setFormError('');

    try {
      await cancelOutgoingRequest(requestId);
    } catch (err) {
      setFormError(err.message || 'Не удалось отменить заявку');
    } finally {
      setProcessingRequestId(null);
    }
  };

  const renderFriendItem = (friend, isOnline) => (
    <div key={friend._id} className="friends-list-item">
      <div className="friends-item-avatar">
        {friend.avatar ? (
          <img src={`${BACKEND_URL}${friend.avatar}`} alt={friend.username} />
        ) : (
          <span>{friend.username?.charAt(0).toUpperCase()}</span>
        )}
        <span className={`friends-status-indicator ${isOnline ? 'online' : 'offline'}`} />
      </div>
      <div className="friends-item-info">
        <div className="friends-item-name">{formatDisplayName(friend)}</div>
        <div className="friends-item-status">{isOnline ? 'В сети' : 'Неактивен'}</div>
      </div>
      <div className="friends-item-actions">
        <button
          className="friends-action-btn"
          onClick={() => handleFriendClick(friend)}
          title="Написать сообщение"
        >
          <img src="/icons/chat.png" alt="Чат" />
        </button>
        <button
          className="friends-action-btn friends-delete-btn"
          onClick={() => handleRemoveFriend(friend._id)}
          title="Удалить из друзей"
        >
          <img src="/icons/trash.png" alt="Удалить" />
        </button>
      </div>
    </div>
  );

  const renderRequestItem = (request, type) => {
    const user = type === 'incoming' ? request.from : request.to;
    const isProcessing = processingRequestId === request._id;

    return (
      <div key={request._id} className="friend-request-card">
        <div className="friend-request-avatar">
          {user?.avatar ? (
            <img src={`${BACKEND_URL}${user.avatar}`} alt={user.username} />
          ) : (
            <span>{user?.username?.charAt(0).toUpperCase()}</span>
          )}
        </div>
        <div className="friend-request-info">
          <div className="friend-request-name">{formatDisplayName(user || {})}</div>
          <div className="friend-request-username">@{user?.username}</div>
        </div>
        <div className="friend-request-actions">
          {type === 'incoming' ? (
            <>
              <button
                type="button"
                className="friend-request-btn accept"
                onClick={() => handleRespond(request._id, 'accept')}
                disabled={isProcessing}
              >
                Принять
              </button>
              <button
                type="button"
                className="friend-request-btn"
                onClick={() => handleRespond(request._id, 'decline')}
                disabled={isProcessing}
              >
                Отклонить
              </button>
            </>
          ) : (
            <button
              type="button"
              className="friend-request-btn"
              onClick={() => handleCancelOutgoing(request._id)}
              disabled={isProcessing}
            >
              Отменить
            </button>
          )}
        </div>
      </div>
    );
  };

  const filteredFriends = useMemo(() => {
    if (!searchQuery) return sortedFriends;
    return sortedFriends.filter(friend =>
      formatDisplayName(friend).toLowerCase().includes(searchQuery.toLowerCase()) ||
      friend.username.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [sortedFriends, searchQuery]);

  const filteredOnlineFriends = filteredFriends.filter(friend => onlineUserIds.has(friend._id?.toString()));
  const filteredOfflineFriends = filteredFriends.filter(friend => !onlineUserIds.has(friend._id?.toString()));

  const getDisplayFriends = () => {
    switch (activeTab) {
      case 'online':
        return filteredOnlineFriends;
      case 'all':
        return filteredFriends;
      default:
        return filteredOnlineFriends;
    }
  };

  const handleAddFriend = async () => {
    const trimmed = friendUsername.trim();
    if (!trimmed) return;

    setIsAddingFriend(true);
    setAddFriendError('');
    try {
      const result = await sendFriendRequest(trimmed);
      setFriendUsername('');
      setShowAddFriendModal(false);
      setAddFriendError('');
    } catch (err) {
      console.error('Ошибка добавления в друзья:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Не удалось отправить заявку';
      setAddFriendError(errorMessage);
    } finally {
      setIsAddingFriend(false);
    }
  };

  return (
    <div className="friends-panel-new">
      <div className="friends-header">
        <div className="friends-tabs">
          <span className="friends-tab-static">Друзья</span>
          <div className="friends-tab-separator"></div>
          <button
            className={`friends-tab ${activeTab === 'online' ? 'active' : ''}`}
            onClick={() => setActiveTab('online')}
          >
            В сети
          </button>
          <button
            className={`friends-tab ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            Все
          </button>
        </div>
        <button
          className="friends-add-btn"
          onClick={() => {
            setShowAddFriendModal(true);
            setAddFriendError('');
          }}
        >
          Добавить в друзья
        </button>
      </div>

      <div className="friends-divider"></div>

      <div className="friends-content">
        {hasRequests && (
          <>
            <div className="friends-section-header">
              Заявки в друзья — {incomingRequests.length}
            </div>
            <div className="friends-requests">
              {incomingRequests.map(request => renderRequestItem(request, 'incoming'))}
            </div>
          </>
        )}

        <div className="friends-section-header">
          {activeTab === 'online'
            ? `В сети — ${filteredOnlineFriends.length}`
            : `Все друзья — ${filteredFriends.length}`
          }
        </div>

        <div className="friends-list">
          {(activeTab === 'online' ? filteredOnlineFriends : filteredFriends).map(friend => {
            const isOnline = onlineUserIds.has(friend._id?.toString());
            return renderFriendItem(friend, isOnline);
          })}
        </div>
      </div>

      {/* Модальное окно добавления в друзья */}
      {showAddFriendModal && ReactDOM.createPortal(
        <>
          <div className="add-friend-overlay" onClick={() => {
            setShowAddFriendModal(false);
            setAddFriendError('');
          }} />
          <div className="add-friend-modal">
            <div className="add-friend-modal-content">
              <h2>Добавить в друзья</h2>
              <p className="modal-subtitle">
                Введите имя пользователя, чтобы отправить заявку в друзья
              </p>

              <div className="form-group">
                <label>Имя пользователя</label>
                <input
                  type="text"
                  placeholder="Введите имя пользователя"
                  value={friendUsername}
                  onChange={(e) => {
                    setFriendUsername(e.target.value);
                    if (addFriendError) setAddFriendError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAddFriend();
                    }
                  }}
                  autoFocus
                />
                {addFriendError && (
                  <div className="error-message">{addFriendError}</div>
                )}
              </div>

              <div className="modal-footer">
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setShowAddFriendModal(false);
                    setAddFriendError('');
                  }}
                  disabled={isAddingFriend}
                >
                  Отмена
                </button>
                <button
                  className="btn-primary"
                  onClick={handleAddFriend}
                  disabled={isAddingFriend || !friendUsername.trim()}
                >
                  {isAddingFriend ? 'Отправка...' : 'Отправить заявку'}
                </button>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
};

export default FriendsPanel;
