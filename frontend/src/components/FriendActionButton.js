import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import './FriendActionButton.css';
import { useFriends } from '../context/FriendsContext';
import { useFriendStatus } from '../hooks/useFriendStatus';

const FRIEND_ICONS = {
  idle: '/icons/add_friend.png',
  incoming: '/icons/add_friend.png',
  outgoing: '/icons/add_friend.png',
  friend: '/icons/friend_added.png'
};

const FriendActionButton = ({ targetUser, currentUserId, className = '' }) => {
  const { sendFriendRequest, respondToRequest, removeFriend } = useFriends();
  const targetUserId = useMemo(() => targetUser?._id || targetUser?.userId || targetUser?.id || null, [targetUser]);
  const { isFriend, hasIncomingRequest, hasOutgoingRequest, incomingRequestId } = useFriendStatus(targetUserId);
  const [loading, setLoading] = useState(false);
  const [errorModal, setErrorModal] = useState(null);

  if (!targetUserId || !targetUser?.username) {
    return null;
  }

  if (currentUserId && targetUserId.toString() === currentUserId.toString()) {
    return null;
  }

  const state = isFriend
    ? 'friend'
    : hasIncomingRequest
      ? 'incoming'
      : hasOutgoingRequest
        ? 'outgoing'
        : 'idle';

  const tooltipText = {
    idle: 'Добавить в друзья',
    incoming: 'Принять заявку',
    outgoing: 'Заявка отправлена',
    friend: 'Удалить из друзей'
  }[state];

  const handleClick = async () => {
    if (loading || state === 'outgoing') {
      return;
    }

    setLoading(true);

    try {
      if (state === 'friend') {
        await removeFriend(targetUserId);
      } else if (state === 'incoming' && incomingRequestId) {
        await respondToRequest(incomingRequestId, 'accept');
      } else if (state === 'idle') {
        await sendFriendRequest(targetUser.username);
      }
    } catch (err) {
      console.error('Ошибка действия с другом:', err);

      // Показываем модальное окно с ошибкой
      if (err.message) {
        setErrorModal(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const icon = FRIEND_ICONS[state];

  return (
    <>
      <div className={`friend-action-wrapper ${className}`}>
        <div className="friend-tooltip">{tooltipText}</div>
        <button
          type="button"
          className={`user-profile-friend-btn user-profile-friend-${state} ${loading ? 'loading' : ''}`}
          onClick={handleClick}
          disabled={loading || state === 'outgoing'}
        >
          <img src={icon} alt="" className="friend-icon" />
        </button>
      </div>

      {errorModal && createPortal(
        <div className="join-server-overlay friend-error-overlay" onClick={() => setErrorModal(null)}>
          <div className="join-server-modal friend-error-modal" onClick={(e) => e.stopPropagation()}>
            <button className="join-server-close" onClick={() => setErrorModal(null)}>×</button>

            <h2>Невозможно выполнить действие</h2>
            <p className="modal-subtitle">
              {errorModal}
            </p>

            <div className="modal-footer">
              <button
                className="btn-primary"
                onClick={() => setErrorModal(null)}
              >
                Понятно
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default FriendActionButton;
