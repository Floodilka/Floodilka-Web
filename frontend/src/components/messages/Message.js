import React from 'react';
import MarkdownMessage from '../MarkdownMessage';
import MessageEmbeds from '../MessageEmbeds';
import MessageReactions from '../MessageReactions';
import AttachmentImage from '../directMessages/AttachmentImage';
import { formatTime, isUserMentioned, getReplySnippetFromMeta } from '../../utils/messageUtils';

const BACKEND_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : `${window.location.protocol}//${window.location.hostname}`;

/**
 * Компонент отдельного сообщения
 */
const Message = ({
  message,
  messageIndex,
  group,
  username,
  user,
  userPermissions,
  roleMetadata,
  channelMetadata,
  editingMessage,
  editValue,
  setEditValue,
  contextMenu,
  deletingMessageId,
  highlightedMessageId,
  newMessageIds,
  onUserClick,
  onMentionClick,
  onMentionHover,
  onMentionLeave,
  onReplySelect,
  onReplyNavigation,
  onEditMessage,
  onCancelEdit,
  onSaveEdit,
  onMoreActions,
  onReactionClick,
  onAddReaction,
  canEditMessage,
  canDeleteMessage,
  messagesContainerRef,
  scrollToBottom
}) => {
  const isOwn = message.username === username;
  const isMentioned = isUserMentioned(message, username);
  const isEditing = editingMessage?.id === message.id;
  const isContextMenuOpen = contextMenu?.message.id === message.id;
  const isDeleting = deletingMessageId === message.id;
  const isHighlighted = highlightedMessageId === message.id;
  const isNew = newMessageIds.has(message.id);
  const isGrouped = messageIndex > 0;
  const isGroupFirst = messageIndex === 0 && group.messages.length > 1;
  const isGroupLast = messageIndex === group.messages.length - 1;

  const messageClasses = [
    'message',
    message.isSystem ? 'system-message' : '',
    isOwn ? 'own-message' : '',
    isMentioned ? 'message-mentioned' : '',
    isEditing ? 'message-edit-mode' : '',
    isContextMenuOpen ? 'show-actions' : '',
    isGrouped ? 'message-grouped' : '',
    isGroupFirst ? 'message-group-first' : '',
    isGroupLast ? 'message-group-last' : '',
    isDeleting ? 'message-deleting' : '',
    isHighlighted ? 'message-highlighted' : '',
    isNew ? 'msg--just-in' : ''
  ].filter(Boolean).join(' ');

  return (
    <div
      key={message.id}
      data-message-id={message.id}
      className={messageClasses}
    >
      {messageIndex === 0 ? (
        <div
          className="message-avatar"
          onClick={(e) => !message.isSystem && onUserClick(message, e)}
          style={{ cursor: message.isSystem ? 'default' : 'pointer' }}
        >
          {message.isSystem ? (
            '🤖'
          ) : message.avatar ? (
            <>
              <img
                src={`${BACKEND_URL}${message.avatar}`}
                alt={message.username}
                loading="lazy"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
              <div className="message-avatar-fallback" style={{ display: 'none' }}>
                {(message.displayName || message.username)[0].toUpperCase()}
              </div>
            </>
          ) : (
            <div className="message-avatar-fallback">
              {(message.displayName || message.username)[0].toUpperCase()}
            </div>
          )}
        </div>
      ) : (
        <div className="message-avatar-spacer"></div>
      )}

      <div className="message-content">
        {messageIndex === 0 && (
          <div className="message-header">
            <span
              className="message-username"
              onClick={(e) => !message.isSystem && onUserClick(message, e)}
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

        {isEditing ? (
          <div>
            <textarea
              className="message-edit-input"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onSaveEdit();
                } else if (e.key === 'Escape') {
                  onCancelEdit();
                }
              }}
              autoFocus
            />
            <div className="message-edit-buttons">
              <button
                className="message-edit-button save"
                onClick={onSaveEdit}
                disabled={!editValue.trim()}
              >
                Сохранить
              </button>
              <button
                className="message-edit-button cancel"
                onClick={onCancelEdit}
              >
                Отмена
              </button>
            </div>
          </div>
        ) : (
          <div className="message-content-wrapper">
            {message.replyTo && (
              <button
                type="button"
                className="message-reply-preview"
                onClick={() => onReplyNavigation && onReplyNavigation(message.replyTo?.messageId)}
              >
                <span className="message-reply-accent" aria-hidden="true"></span>
                <div className="message-reply-content">
                  <div className="message-reply-title">
                    {message.replyTo.displayName || message.replyTo.username || 'Неизвестный пользователь'}
                  </div>
                  <div className="message-reply-text">
                    {getReplySnippetFromMeta(message.replyTo)}
                  </div>
                </div>
              </button>
            )}

            {message.content && (
              <div className="message-text">
                <MarkdownMessage
                  content={message.content}
                  mentions={message.mentions}
                  roles={roleMetadata.list}
                  channels={channelMetadata.list}
                  currentUsername={username}
                  onMentionClick={onMentionClick}
                  onMentionHover={(data) => onMentionHover(data, message)}
                  onMentionLeave={onMentionLeave}
                />
                <MessageEmbeds content={message.content} />
              </div>
            )}

            {message.attachments && message.attachments.length > 0 && (
              <div className="message-attachments">
                {message.attachments.map((attachment, index) => (
                  <div key={index} className="message-attachment">
                    {attachment.mimetype.startsWith('image/') ? (
                      <AttachmentImage
                        src={`${BACKEND_URL}${attachment.path}`}
                        alt={attachment.originalName}
                        naturalWidth={attachment.width}
                        naturalHeight={attachment.height}
                        containerRef={messagesContainerRef}
                        onKeepBottom={scrollToBottom}
                        variant="chat"
                        maxSize={350}
                        onClick={() => window.open(`${BACKEND_URL}${attachment.path}`, '_blank')}
                        onError={(e) => {
                          console.error('Ошибка загрузки изображения:', e.target.src);
                          e.target.style.display = 'none';
                        }}
                        onLoad={() => {
                          console.log('Изображение загружено:', `${BACKEND_URL}${attachment.path}`);
                        }}
                      />
                    ) : (
                      <div className="message-attachment-file">
                        <span className="attachment-icon">📎</span>
                        <span className="attachment-name">{attachment.originalName}</span>
                        <span className="attachment-size">{(attachment.size / 1024 / 1024).toFixed(2)} MB</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Реакции на сообщение */}
        {!message.isSystem && !isEditing && (
          <MessageReactions
            reactions={message.reactions}
            onReactionClick={(emoji, userReacted) => onReactionClick(message.id, emoji, userReacted)}
            currentUserId={user?.id}
          />
        )}
      </div>

      {/* Меню действий */}
      {!message.isSystem && (
        <div className="message-actions">
          <button
            className="message-actions-button"
            onClick={() => onReplySelect(message)}
            title="Ответить"
          >
            <img src="/icons/reply.png" alt="Ответить" className="message-actions-icon reply-icon" />
          </button>
          <button
            className="message-actions-button"
            onClick={(e) => onAddReaction(message.id, e)}
            title="Добавить реакцию"
          >
            <img src="/icons/emoji.png" alt="Добавить реакцию" className="message-actions-icon" />
          </button>
          {canEditMessage(message) && (
            <button
              className="message-actions-button"
              onClick={() => onEditMessage(message)}
              title="Редактировать"
            >
              <img src="/icons/edit.png" alt="Редактировать" className="message-actions-icon" />
            </button>
          )}
          {canDeleteMessage(message) && (
            <button
              className="message-actions-button"
              onClick={(e) => onMoreActions(message, e)}
              title="Больше действий"
            >
              ⋯
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default Message;
