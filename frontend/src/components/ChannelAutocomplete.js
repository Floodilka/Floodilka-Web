import React, { useMemo, useRef, useEffect } from 'react';
import './MentionAutocomplete.css';

function ChannelAutocomplete({
  channels,
  filter,
  onSelect,
  position,
  selectedIndex
}) {
  const listRef = useRef(null);
  const normalizedFilter = (filter || '').toLowerCase();

  const filteredChannels = useMemo(() => {
    if (!Array.isArray(channels) || channels.length === 0) {
      return [];
    }

    return channels.filter(channel => {
      const name = channel?.name || channel?.channelName || channel?.displayName;
      if (!name) return false;
      return name.toLowerCase().startsWith(normalizedFilter);
    });
  }, [channels, normalizedFilter]);

  useEffect(() => {
    if (!listRef.current || selectedIndex < 0) {
      return;
    }
    const selectedElement = listRef.current.children[selectedIndex];
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex, filteredChannels.length]);

  if (filteredChannels.length === 0) {
    return null;
  }

  return (
    <div
      className="mention-autocomplete"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        width: position.width ? `${position.width}px` : '100%'
      }}
    >
      <ul ref={listRef}>
        {filteredChannels.map((channel, index) => {
          const name = channel?.name || channel?.channelName || channel?.displayName || 'канал';
          const typeLabel = channel?.type === 'voice' ? 'Голосовой канал' : 'Текстовый канал';
          return (
            <li
              key={channel.id || channel._id || index}
              className={`mention-item ${index === selectedIndex ? 'selected' : ''}`}
              onClick={() => onSelect(channel)}
            >
              <div className="mention-channel-icon">#</div>
              <div className="mention-info">
                <div className="mention-username">#{name}</div>
                <div className="mention-display-name">{typeLabel}</div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default ChannelAutocomplete;
