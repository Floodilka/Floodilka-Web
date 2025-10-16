import React from 'react';
import MarkdownMessage from '../../MarkdownMessage';
import MessageEmbeds from '../../MessageEmbeds';
import MessageReactions from '../../MessageReactions';
import { formatTime } from '../utils/messageUtils';

/**
 * Компонент одного сообщения в DirectMessages
 */
const Message = ({
  message,
  messageIndex,
  isGrouped,
  isGroupFirst,
  isGroupLast,
  isOwn,
  isEditing,
  editValue,
  onEditChange,
  onEditSave,
  onEditCancel,
  isHighlighted,
  isNewMessage,
  user,
  onUserClick,
  onReplySelect,
  onAddReaction,
  onReactionClick,
  onMoreActions,
  onReplyNavigation,
  canEdit,
  canDelete,
  BACKEND_URL
}) => {
  const handleEditKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onEditSave();
    }
    if (e.key === 'Escape') {
      onEditCancel();
    }
  };

  return (
    <div
      key={message._id}
      data-message-id={message._id}
      className={`dm-message ${isOwn ? 'dm-message-own' : ''} ${isGrouped ? 'dm-message-grouped' : ''} ${isGroupFirst ? 'dm-message-group-first' : ''} ${isGroupLast ? 'dm-message-group-last' : ''} ${isEditing ? 'dm-message-edit-mode' : ''} ${isHighlighted ? 'dm-message-highlighted' : ''} ${isNewMessage ? 'dm-msg--just-in' : ''}`}
    >
      {messageIndex === 0 && (
        <div
          className="dm-message-avatar"
          onClick={(e) => onUserClick(message.sender, e)}
          style={{ cursor: 'pointer' }}
        >
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
            <span
              className="dm-message-username"
              onClick={(e) => onUserClick(message.sender, e)}
              style={{ cursor: 'pointer' }}
            >
              {message.sender.displayName || message.sender.username}
            </span>
            <span className="dm-message-time">
              {formatTime(message.timestamp)}
            </span>
          </div>
        )}

        {isEditing ? (
          <div className="dm-message-edit">
            <textarea
              value={editValue}
              onChange={(e) => onEditChange(e.target.value)}
              onKeyDown={handleEditKeyDown}
              className="dm-edit-textarea"
              autoFocus
            />
            <div className="dm-edit-actions">
              <button
                className="dm-edit-save"
                onClick={onEditSave}
              >
                Сохранить
              </button>
              <button
                className="dm-edit-cancel"
                onClick={onEditCancel}
              >
                Отмена
              </button>
            </div>
          </div>
        ) : (
          <div className="dm-message-content-wrapper">
            {message.replyTo && (
              <button
                type="button"
                className="dm-message-reply-preview"
                onClick={() => onReplyNavigation(message.replyTo?.messageId)}
              >
                <span className="dm-message-reply-accent" aria-hidden="true"></span>
                <div className="dm-message-reply-content">
                  <div className="dm-message-reply-title">
                    {message.replyTo.displayName || message.replyTo.username || 'Неизвестный пользователь'}
                  </div>
                  <div className="dm-message-reply-text">
                    {message.replyTo.content ?
                      (message.replyTo.content.length > 50 ?
                        `${message.replyTo.content.slice(0, 50)}...` :
                        message.replyTo.content
                      ) : 'Без текста'
                    }
                  </div>
                </div>
              </button>
            )}

            {message.content && (
              <div className="dm-message-text">
                <MarkdownMessage
                  content={message.content}
                  mentions={message.mentions}
                  roles={[]}
                  channels={[]}
                  currentUsername={user?.username}
                  onMentionClick={() => {}} // TODO: implement
                  onMentionHover={() => {}} // TODO: implement
                  onMentionLeave={() => {}} // TODO: implement
                />
                <MessageEmbeds content={message.content} />
              </div>
            )}

            {message.attachments && message.attachments.length > 0 && (
              <div className="message-attachments">
                {message.attachments.map((attachment, index) => (
                  <div key={index} className="message-attachment">
                    <img
                      src={`${BACKEND_URL}${attachment.path}`}
                      alt={attachment.originalName}
                      className="message-attachment-image"
                      loading="lazy"
                      onClick={() => window.open(`${BACKEND_URL}${attachment.path}`, '_blank')}
                      onError={(e) => {
                        console.error('Ошибка загрузки изображения:', e.target.src);
                        e.target.style.display = 'none';
                      }}
                      onLoad={() => {
                        console.log('Изображение загружено:', `${BACKEND_URL}${attachment.path}`);
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Реакции на сообщение */}
        <MessageReactions
          reactions={message.reactions}
          onReactionClick={(emoji, userReacted) => onReactionClick(message._id, emoji, userReacted)}
          currentUserId={user?.id}
        />
      </div>

      <div className="dm-message-actions">
        <button
          className="dm-message-actions-button"
          onClick={() => onReplySelect(message)}
          title="Ответить"
        >
          <img src="/icons/reply.png" alt="Ответить" className="dm-message-actions-icon reply-icon" />
        </button>
        <button
          className="dm-message-actions-button"
          onClick={(e) => onAddReaction(message._id, e)}
          title="Добавить реакцию"
        >
          <img src="/icons/emoji.png" alt="Добавить реакцию" className="dm-message-actions-icon" />
        </button>
        {canEdit && (
          <button
            className="dm-message-actions-button"
            onClick={() => onMoreActions(message, 'edit')}
            title="Редактировать"
          >
            <img src="/icons/edit.png" alt="Редактировать" className="dm-message-actions-icon" />
          </button>
        )}
        {canDelete && (
          <button
            className="dm-message-actions-button"
            onClick={(e) => onMoreActions(message, 'more', e)}
            title="Больше действий"
          >
            ⋯
          </button>
        )}
      </div>
    </div>
  );
};

export default Message;
