import React from 'react';
import { getReplySnippetFromMessage } from '../utils/messageUtils';

/**
 * Компонент баннера ответа на сообщение
 */
const ReplyBanner = ({ replyTarget, onNavigate, onCancel }) => {
  if (!replyTarget) return null;

  return (
    <div className="dm-reply-banner">
      <div
        className="dm-reply-banner-info"
        onClick={() => onNavigate && onNavigate(replyTarget.id || replyTarget._id)}
      >
        <div className="dm-reply-banner-title">
          Ответ на сообщение <span className="dm-reply-banner-author">@{replyTarget.sender?.displayName || replyTarget.sender?.username || replyTarget.username}</span>
        </div>
        <div className="dm-reply-banner-text">
          {getReplySnippetFromMessage(replyTarget)}
        </div>
      </div>
      <button
        type="button"
        className="dm-reply-banner-close"
        onClick={onCancel}
        title="Отменить ответ"
      >
        ×
      </button>
    </div>
  );
};

export default ReplyBanner;
