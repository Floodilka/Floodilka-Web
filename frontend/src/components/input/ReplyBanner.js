import React from 'react';
import { getReplySnippetFromMessage } from '../../utils/messageUtils';

/**
 * Компонент баннера ответа на сообщение
 */
const ReplyBanner = ({ replyTarget, onNavigate, onCancel }) => {
  if (!replyTarget) {
    return null;
  }

  return (
    <div className="message-reply-banner">
      <div
        className="message-reply-banner-info"
        onClick={() => onNavigate(replyTarget.id)}
      >
        <div className="message-reply-banner-title">
          Ответ на сообщение <span className="message-reply-banner-author">@{replyTarget.displayName || replyTarget.username}</span>
        </div>
        <div className="message-reply-banner-text">
          {getReplySnippetFromMessage(replyTarget)}
        </div>
      </div>
      <button
        type="button"
        className="message-reply-banner-close"
        onClick={onCancel}
        title="Отменить ответ"
      >
        ×
      </button>
    </div>
  );
};

export default ReplyBanner;
