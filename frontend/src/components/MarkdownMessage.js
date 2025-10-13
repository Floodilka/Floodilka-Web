import React, { useMemo, useCallback } from 'react';
import './MarkdownMessage.css';
import markdownToSanitizedHtml from '../utils/markdown';

const MarkdownMessage = ({
  content,
  mentions,
  currentUsername,
  onMentionClick
}) => {
  const sanitizedHtml = useMemo(
    () =>
      markdownToSanitizedHtml(content, {
        mentions,
        currentUsername
      }),
    [content, mentions, currentUsername]
  );

  const handleClick = useCallback(
    (event) => {
      const spoilerElement = event.target.closest('[data-spoiler]');

      if (spoilerElement) {
        const currentState = spoilerElement.getAttribute('data-spoiler');
        const nextState = currentState === 'shown' ? 'hidden' : 'shown';
        spoilerElement.setAttribute('data-spoiler', nextState);
        event.preventDefault();
        return;
      }

      if (!onMentionClick) {
        return;
      }

      const mentionElement = event.target.closest('[data-mention]');

      if (!mentionElement) {
        return;
      }

      const mention = {
        username: mentionElement.getAttribute('data-mention'),
        id: mentionElement.getAttribute('data-mention-id') || undefined,
        element: mentionElement
      };

      onMentionClick(mention, event);
    },
    [onMentionClick]
  );

  if (!sanitizedHtml) {
    return null;
  }

  return (
    <div
      className="markdown-message"
      onClick={handleClick}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
};

export default MarkdownMessage;
