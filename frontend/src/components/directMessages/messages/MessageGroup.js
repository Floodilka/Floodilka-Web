import React from 'react';
import Message from './Message';
import { formatDate } from '../utils/messageUtils';

/**
 * Компонент группы сообщений в DirectMessages
 */
const MessageGroup = ({
  group,
  groupIndex,
  prevGroup,
  user,
  editingMessage,
  editValue,
  onEditChange,
  onEditSave,
  onEditCancel,
  highlightedMessageId,
  newDmMessageIds,
  onUserClick,
  onReplySelect,
  onAddReaction,
  onReactionClick,
  onMoreActions,
  onReplyNavigation,
  canEditMessage,
  canDeleteMessage,
  BACKEND_URL
}) => {
  const showDateDivider = !prevGroup || prevGroup.date !== group.date;

  return (
    <React.Fragment key={`group-${groupIndex}`}>
      {showDateDivider && (
        <div className="dm-date-divider">
          <div className="dm-date-divider-line"></div>
          <span className="dm-date-divider-text">{formatDate(group.date)}</span>
          <div className="dm-date-divider-line"></div>
        </div>
      )}
      {group.messages.map((message, messageIndex) => (
        <Message
          key={message._id}
          message={message}
          messageIndex={messageIndex}
          isGrouped={messageIndex > 0}
          isGroupFirst={messageIndex === 0 && group.messages.length > 1}
          isGroupLast={messageIndex === group.messages.length - 1}
          isOwn={group.isOwn}
          isEditing={editingMessage?._id === message._id}
          editValue={editValue}
          onEditChange={onEditChange}
          onEditSave={onEditSave}
          onEditCancel={onEditCancel}
          isHighlighted={highlightedMessageId === message._id}
          isNewMessage={newDmMessageIds.has(message._id)}
          user={user}
          onUserClick={onUserClick}
          onReplySelect={onReplySelect}
          onAddReaction={onAddReaction}
          onReactionClick={onReactionClick}
          onMoreActions={onMoreActions}
          onReplyNavigation={onReplyNavigation}
          canEdit={canEditMessage(message, user?.id)}
          canDelete={canDeleteMessage(message, user?.id)}
          BACKEND_URL={BACKEND_URL}
        />
      ))}
    </React.Fragment>
  );
};

export default MessageGroup;
