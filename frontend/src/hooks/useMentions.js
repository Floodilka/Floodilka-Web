import { useState, useCallback, useMemo } from 'react';

/**
 * Хук для работы с упоминаниями и автокомплитом
 */
export const useMentions = (serverMembers, textChannels) => {
  const [showMentionAutocomplete, setShowMentionAutocomplete] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0, width: 0 });
  const [mentionSelectedIndex, setMentionSelectedIndex] = useState(0);
  const [showChannelAutocomplete, setShowChannelAutocomplete] = useState(false);
  const [channelFilter, setChannelFilter] = useState('');
  const [channelPosition, setChannelPosition] = useState({ top: 0, left: 0, width: 0 });
  const [channelSelectedIndex, setChannelSelectedIndex] = useState(0);

  // Метаданные каналов для замены токенов
  const channelReplaceMap = useMemo(() => {
    const map = new Map();
    textChannels.forEach((channel) => {
      const name = channel?.name || channel?.channelName || channel?.displayName;
      const id = channel?.id || channel?._id || channel?.channelId;
      if (!name || !id) return;
      map.set(name.toLowerCase(), String(id));
    });
    return map;
  }, [textChannels]);

  // Замена токенов каналов в тексте
  const replaceChannelTokens = useCallback((text) => {
    if (!text || channelReplaceMap.size === 0) {
      return text;
    }

    return text.replace(/#([\p{L}\p{N}_-]+)/gu, (match, name) => {
      const id = channelReplaceMap.get(name.toLowerCase());
      if (!id) {
        return match;
      }
      return `<#${id}>`;
    });
  }, [channelReplaceMap]);

  // Обработка изменения в поле ввода для автокомплита
  const handleInputChange = useCallback((e, messageInputFieldRef) => {
    const value = e.target.value;
    const cursorPosition = e.target.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    let mentionTriggered = false;

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      if (!textAfterAt.includes(' ')) {
        const normalizedFilter = textAfterAt.toLowerCase();
        const filteredUsers = serverMembers.filter(user =>
          user.username.toLowerCase().startsWith(normalizedFilter)
        );

        const matchesEveryone = 'everyone'.startsWith(normalizedFilter);
        const hasSuggestions = matchesEveryone || filteredUsers.length > 0;

        if (hasSuggestions) {
          const fieldRect = messageInputFieldRef.current?.getBoundingClientRect();
          if (fieldRect) {
            setMentionPosition({
              top: fieldRect.top - 8,
              left: fieldRect.left,
              width: fieldRect.width
            });
            setMentionFilter(textAfterAt);
            setShowMentionAutocomplete(true);
            setMentionSelectedIndex(0);
            mentionTriggered = true;
          }
        } else {
          setShowMentionAutocomplete(false);
        }
      } else {
        setShowMentionAutocomplete(false);
      }
    } else {
      setShowMentionAutocomplete(false);
    }

    if (mentionTriggered) {
      setShowChannelAutocomplete(false);
      return value;
    }

    const lastHashIndex = textBeforeCursor.lastIndexOf('#');
    if (lastHashIndex !== -1) {
      const charBeforeHash = lastHashIndex === 0 ? ' ' : textBeforeCursor[lastHashIndex - 1];
      const textAfterHash = textBeforeCursor.substring(lastHashIndex + 1);
      const isValidPrefix = lastHashIndex === 0 || /\s/.test(charBeforeHash);

      if (isValidPrefix && !textAfterHash.includes(' ') && !textAfterHash.includes('#')) {
        const normalizedFilter = textAfterHash.toLowerCase();
        const filteredChannels = textChannels.filter(channel => {
          const name = channel?.name || channel?.channelName || channel?.displayName;
          if (!name) return false;
          return name.toLowerCase().startsWith(normalizedFilter);
        });

        if (filteredChannels.length > 0) {
          const fieldRect = messageInputFieldRef.current?.getBoundingClientRect();
          if (fieldRect) {
            setChannelPosition({
              top: fieldRect.top - 8,
              left: fieldRect.left,
              width: fieldRect.width
            });
            setChannelFilter(textAfterHash);
            setShowChannelAutocomplete(true);
            setChannelSelectedIndex(0);
            return value;
          }
        }
      }

      setShowChannelAutocomplete(false);
    } else {
      setShowChannelAutocomplete(false);
    }

    // Всегда возвращаем значение
    return value;
  }, [serverMembers, textChannels]);

  // Выбор пользователя из автокомплита
  const handleMentionSelect = useCallback((user, inputRef, inputValue, setInputValue) => {
    const cursorPosition = inputRef.current.selectionStart;
    const textBeforeCursor = inputValue.substring(0, cursorPosition);
    const textAfterCursor = inputValue.substring(cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const newValue =
        inputValue.substring(0, lastAtIndex) +
        `@${user.username} ` +
        textAfterCursor;
      setInputValue(newValue);

      setTimeout(() => {
        const newCursorPos = lastAtIndex + user.username.length + 2;
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
        inputRef.current.focus();
      }, 0);
    }

    setShowMentionAutocomplete(false);
    setShowChannelAutocomplete(false);
  }, []);

  // Выбор канала из автокомплита
  const handleChannelSelect = useCallback((channel, inputRef, inputValue, setInputValue) => {
    if (!channel) {
      setShowChannelAutocomplete(false);
      return;
    }

    const channelName = channel.name || channel.channelName || channel.displayName;
    if (!channelName) {
      setShowChannelAutocomplete(false);
      return;
    }

    const cursorPosition = inputRef.current.selectionStart;
    const textBeforeCursor = inputValue.substring(0, cursorPosition);
    const textAfterCursor = inputValue.substring(cursorPosition);
    const lastHashIndex = textBeforeCursor.lastIndexOf('#');

    if (lastHashIndex !== -1) {
      const insertion = `#${channelName} `;
      const newValue =
        inputValue.substring(0, lastHashIndex) +
        insertion +
        textAfterCursor;
      setInputValue(newValue);

      setTimeout(() => {
        const newCursorPos = lastHashIndex + insertion.length;
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
        inputRef.current.focus({ preventScroll: true });
      }, 0);
    }

    setShowChannelAutocomplete(false);
    setChannelFilter('');
  }, []);

  // Обработка клавиш в поле ввода
  const handleInputKeyDown = useCallback((e, inputValue, setInputValue) => {
    if (showChannelAutocomplete) {
      const normalizedFilter = channelFilter.toLowerCase();
      const filteredChannels = textChannels.filter(channel => {
        const name = channel?.name || channel?.channelName || channel?.displayName;
        if (!name) return false;
        return name.toLowerCase().startsWith(normalizedFilter);
      });

      if (filteredChannels.length === 0) {
        setShowChannelAutocomplete(false);
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setChannelSelectedIndex(prev =>
          prev < filteredChannels.length - 1 ? prev + 1 : prev
        );
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setChannelSelectedIndex(prev => prev > 0 ? prev - 1 : 0);
        return;
      }

      if (e.key === 'Enter') {
        if (filteredChannels[channelSelectedIndex]) {
          e.preventDefault();
          handleChannelSelect(filteredChannels[channelSelectedIndex], null, inputValue, setInputValue);
        } else {
          setShowChannelAutocomplete(false);
        }
        return;
      }

      if (e.key === 'Escape') {
        setShowChannelAutocomplete(false);
        return;
      }
    }

    if (showMentionAutocomplete) {
      const filteredUsers = serverMembers.filter(user =>
        user.username.toLowerCase().startsWith(mentionFilter.toLowerCase())
      );

      let suggestions = [];
      if ('everyone'.startsWith(mentionFilter.toLowerCase())) {
        suggestions.push({ id: 'everyone', username: 'everyone' });
      }
      suggestions = [...suggestions, ...filteredUsers];

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionSelectedIndex(prev =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionSelectedIndex(prev => prev > 0 ? prev - 1 : 0);
      } else if (e.key === 'Enter') {
        if (suggestions.length > 0) {
          e.preventDefault();
          if (suggestions[mentionSelectedIndex]) {
            handleMentionSelect(suggestions[mentionSelectedIndex], null, inputValue, setInputValue);
          }
          return;
        }
        setShowMentionAutocomplete(false);
      } else if (e.key === 'Escape') {
        setShowMentionAutocomplete(false);
      }

      return;
    }
  }, [showChannelAutocomplete, showMentionAutocomplete, channelFilter, mentionFilter, textChannels, serverMembers, channelSelectedIndex, mentionSelectedIndex, handleChannelSelect, handleMentionSelect]);

  return {
    // Состояние
    showMentionAutocomplete,
    mentionFilter,
    mentionPosition,
    mentionSelectedIndex,
    showChannelAutocomplete,
    channelFilter,
    channelPosition,
    channelSelectedIndex,

    // Методы
    handleInputChange,
    handleMentionSelect,
    handleChannelSelect,
    handleInputKeyDown,
    replaceChannelTokens,

    // Управление состоянием
    setShowMentionAutocomplete,
    setShowChannelAutocomplete
  };
};
