import React from 'react';
import MessageGroup from './MessageGroup';
import { canEditMessage, canDeleteMessage } from '../utils/messageUtils';

/**
 * Компонент списка сообщений в DirectMessages
 */
const MessagesList = ({
  groupedMessages,
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
  BACKEND_URL,
  messagesContainerRef,
  scrollToBottom,
  onImageClick
}) => {
  return (
    <>
      {groupedMessages.map((group, groupIndex) => {
        const prevGroup = groupIndex > 0 ? groupedMessages[groupIndex - 1] : null;

        return (
          <MessageGroup
            key={`group-${groupIndex}`}
            group={group}
            groupIndex={groupIndex}
            prevGroup={prevGroup}
            user={user}
            editingMessage={editingMessage}
            editValue={editValue}
            onEditChange={onEditChange}
            onEditSave={onEditSave}
            onEditCancel={onEditCancel}
            highlightedMessageId={highlightedMessageId}
            newDmMessageIds={newDmMessageIds}
            onUserClick={onUserClick}
            onReplySelect={onReplySelect}
            onAddReaction={onAddReaction}
            onReactionClick={onReactionClick}
            onMoreActions={onMoreActions}
            onReplyNavigation={onReplyNavigation}
            canEditMessage={canEditMessage}
            canDeleteMessage={canDeleteMessage}
            BACKEND_URL={BACKEND_URL}
            messagesContainerRef={messagesContainerRef}
            scrollToBottom={scrollToBottom}
            onImageClick={onImageClick}
          />
        );
      })}
    </>
  );
};

export default MessagesList;
