import React, { useEffect, useRef } from 'react';
import './MentionAutocomplete.css';

const BACKEND_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : `${window.location.protocol}//${window.location.hostname}`;

function MentionAutocomplete({
  users,
  filter,
  onSelect,
  position,
  selectedIndex
}) {
  const listRef = useRef(null);

  // Фильтруем пользователей по введенному тексту
  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().startsWith(filter.toLowerCase())
  );

  // Добавляем @everyone в начало, если он подходит под фильтр
  const suggestions = [];
  if ('everyone'.startsWith(filter.toLowerCase())) {
    suggestions.push({
      id: 'everyone',
      username: 'everyone',
      displayName: 'Все участники',
      isSpecial: true
    });
  }
  suggestions.push(...filteredUsers);

  // Прокручиваем к выбранному элементу
  useEffect(() => {
    if (listRef.current && selectedIndex >= 0) {
      const selectedElement = listRef.current.children[selectedIndex];
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (suggestions.length === 0) return null;

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
        {suggestions.map((user, index) => (
          <li
            key={user.id}
            className={`mention-item ${index === selectedIndex ? 'selected' : ''}`}
            onClick={() => onSelect(user)}
          >
            {user.isSpecial ? (
              <div className="mention-everyone-icon">@</div>
            ) : user.avatar ? (
              <img
                src={`${BACKEND_URL}${user.avatar}`}
                alt={user.username}
                className="mention-avatar"
              />
            ) : (
              <div className="mention-avatar-fallback">
                {(user.displayName || user.username)[0].toUpperCase()}
              </div>
            )}
            <div className="mention-info">
              <div className="mention-username">
                {user.username}
              </div>
              {user.displayName && !user.isSpecial && (
                <div className="mention-display-name">
                  {user.displayName}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default MentionAutocomplete;

