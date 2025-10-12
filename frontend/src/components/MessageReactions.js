import React, { useState } from 'react';
import './MessageReactions.css';

function MessageReactions({ reactions, onReactionClick, currentUserId }) {
  const [hoveredReaction, setHoveredReaction] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });

  const handleReactionClick = (emoji) => {
    // Проверяем, есть ли уже реакция от текущего пользователя
    const reaction = reactions?.find(r => r.emoji === emoji);
    const userReacted = reaction?.users?.some(u => u.userId === currentUserId);

    onReactionClick(emoji, userReacted);
  };

  const getUsernames = (users) => {
    if (!users || users.length === 0) return '';

    const usernames = users.map(u => u.username).join(', ');
    return usernames;
  };

  const handleMouseEnter = (reactionKey, event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const tooltipTop = rect.top - 10; // Над кнопкой с отступом
    let tooltipLeft = rect.left + rect.width / 2;

    // Проверяем, не уходит ли tooltip за правый край экрана
    const tooltipWidth = 180; // Максимальная ширина tooltip
    const padding = 10; // Отступ от края экрана

    if (tooltipLeft + tooltipWidth / 2 > window.innerWidth - padding) {
      tooltipLeft = window.innerWidth - padding - tooltipWidth / 2;
    }

    // Проверяем, не уходит ли tooltip за левый край экрана
    if (tooltipLeft - tooltipWidth / 2 < padding) {
      tooltipLeft = padding + tooltipWidth / 2;
    }

    setTooltipPosition({ top: tooltipTop, left: tooltipLeft });
    setHoveredReaction(reactionKey);
  };

  return (
    <div className="message-reactions">
      {reactions && reactions.length > 0 && reactions.map((reaction, index) => {
        const userReacted = reaction.users?.some(u => u.userId === currentUserId);
        const count = reaction.users?.length || 0;

        return (
          <button
            key={`${reaction.emoji}-${index}`}
            className={`message-reaction ${userReacted ? 'reacted' : ''}`}
            onClick={() => handleReactionClick(reaction.emoji)}
            onMouseEnter={(e) => handleMouseEnter(`${reaction.emoji}-${index}`, e)}
            onMouseLeave={() => setHoveredReaction(null)}
            title={getUsernames(reaction.users)}
          >
            <span className="reaction-emoji">{reaction.emoji}</span>
            <span className="reaction-count">{count}</span>
          </button>
        );
      })}

      {/* Tooltip отдельно с position: fixed */}
      {hoveredReaction && reactions && reactions.length > 0 && (() => {
        const reactionIndex = parseInt(hoveredReaction.split('-').pop());
        const reaction = reactions[reactionIndex];
        if (!reaction || !reaction.users || reaction.users.length === 0) return null;

        return (
          <div
            className="reaction-tooltip"
            style={{
              top: `${tooltipPosition.top}px`,
              left: `${tooltipPosition.left}px`,
              transform: 'translate(-50%, -100%)'
            }}
          >
            {reaction.users.map((user, idx) => (
              <div key={`${user.userId}-${idx}`} className="reaction-tooltip-user">
                {user.username}
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}

export default MessageReactions;

