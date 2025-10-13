import React, { useMemo, useCallback, useRef } from 'react';
import './MarkdownMessage.css';
import markdownToSanitizedHtml from '../utils/markdown';

const MarkdownMessage = ({
  content,
  mentions,
  currentUsername,
  onMentionClick,
  onMentionHover,
  onMentionLeave
}) => {
  const sanitizedHtml = useMemo(
    () =>
      markdownToSanitizedHtml(content, {
        mentions,
        currentUsername
      }),
    [content, mentions, currentUsername]
  );

  const hoveredMentionRef = useRef(null);

  const getMentionData = useCallback((element, event) => ({
    username: element.getAttribute('data-mention'),
    id: element.getAttribute('data-mention-id') || undefined,
    element,
    rect: element.getBoundingClientRect(),
    clientX: event?.clientX,
    clientY: event?.clientY
  }), []);

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

      const mentionElement = event.target.closest('[data-mention]');

      if (mentionElement && onMentionClick) {
        const mention = getMentionData(mentionElement, event);
        onMentionClick(mention, event);
      }
    },
    [getMentionData, onMentionClick]
  );

  const handleMouseMove = useCallback((event) => {
    const mentionElement = event.target.closest('[data-mention]');

    if (!mentionElement) {
      if (hoveredMentionRef.current) {
        hoveredMentionRef.current = null;
        onMentionLeave?.(event);
      }
      return;
    }

    hoveredMentionRef.current = mentionElement;

    if (onMentionHover) {
      const mention = getMentionData(mentionElement, event);
      onMentionHover(mention, event);
    }
  }, [getMentionData, onMentionHover, onMentionLeave]);

  const clearMentionHover = useCallback((event) => {
    if (hoveredMentionRef.current) {
      hoveredMentionRef.current = null;
      onMentionLeave?.(event);
    }
  }, [onMentionLeave]);

  if (!sanitizedHtml) {
    return null;
  }

  return (
    <div
      className="markdown-message"
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={clearMentionHover}
      onBlur={clearMentionHover}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
};

export default MarkdownMessage;
