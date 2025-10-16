import React from 'react';
import MessageGroup from './MessageGroup';
import { groupMessages } from '../../utils/messageUtils';

/**
 * Компонент списка сообщений с группировкой
 */
const MessagesList = ({
  messages,
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
  scrollToBottom,
  onImageClick
}) => {
  // Группировка сообщений
  const groupedMessages = React.useMemo(
    () => groupMessages(messages, { thresholdMs: 60_000 }),
    [messages]
  );

  if (messages.length === 0) {
    return null;
  }

  return (
    <div>
      {groupedMessages.map((group, groupIndex) => {
        const prevGroup = groupIndex > 0 ? groupedMessages[groupIndex - 1] : null;

        return (
          <MessageGroup
            key={`group-${groupIndex}`}
            group={group}
            groupIndex={groupIndex}
            prevGroup={prevGroup}
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
            messagesContainerRef={messagesContainerRef}
            scrollToBottom={scrollToBottom}
            onImageClick={onImageClick}
          />
        );
      })}
    </div>
  );
};

export default MessagesList;
