import React from 'react';
import Message from './Message';
import { formatDate } from '../../utils/messageUtils';

/**
 * Компонент группы сообщений с разделителем дат
 */
const MessageGroup = ({
  group,
  groupIndex,
  prevGroup,
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
  canDeleteMessage
}) => {
  const showDateDivider = !prevGroup || prevGroup.date !== group.date;

  return (
    <React.Fragment key={`group-${groupIndex}`}>
      {showDateDivider && (
        <div className="date-divider">
          <div className="date-divider-line"></div>
          <span className="date-divider-text">{formatDate(group.date)}</span>
          <div className="date-divider-line"></div>
        </div>
      )}
      {group.messages.map((message, messageIndex) => (
        <Message
          key={message.id}
          message={message}
          messageIndex={messageIndex}
          group={group}
          username={username}
          user={user}
          userPermissions={userPermissions}
          roleMetadata={roleMetadata}
          channelMetadata={channelMetadata}
          editingMessage={editingMessage}
          editValue={editValue}
          setEditValue={setEditValue}
          contextMenu={contextMenu}
          deletingMessageId={deletingMessageId}
          highlightedMessageId={highlightedMessageId}
          newMessageIds={newMessageIds}
          onUserClick={onUserClick}
          onMentionClick={onMentionClick}
          onMentionHover={onMentionHover}
          onMentionLeave={onMentionLeave}
          onReplySelect={onReplySelect}
          onReplyNavigation={onReplyNavigation}
          onEditMessage={onEditMessage}
          onCancelEdit={onCancelEdit}
          onSaveEdit={onSaveEdit}
          onMoreActions={onMoreActions}
          onReactionClick={onReactionClick}
          onAddReaction={onAddReaction}
          canEditMessage={canEditMessage}
          canDeleteMessage={canDeleteMessage}
        />
      ))}
    </React.Fragment>
  );
};

export default MessageGroup;
