import { useState, useCallback } from 'react';
import { SOCKET_EVENTS } from '../../../constants/events';

/**
 * Хук для управления реакциями на сообщения
 */
export const useReactions = (socket, user) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiPickerPosition, setEmojiPickerPosition] = useState(null);
  const [selectedMessageForReaction, setSelectedMessageForReaction] = useState(null);

  // Добавление реакции
  const handleAddReaction = useCallback((messageId, event) => {
    const rect = event.currentTarget.getBoundingClientRect();

    // Размеры EmojiPicker (примерные)
    const pickerHeight = 444;
    const pickerWidth = 352;
    const padding = 10;

    // Позиция по умолчанию (рядом с кнопкой)
    let top = rect.top;
    let left = rect.left;

    // Проверяем, помещается ли picker вниз
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    // Если места внизу мало, показываем вверху
    if (spaceBelow < pickerHeight && spaceAbove > spaceBelow) {
      top = rect.top - pickerHeight - 5;
    }

    // Проверяем, не уходит ли picker за правый край экрана
    if (left + pickerWidth > window.innerWidth - padding) {
      left = window.innerWidth - pickerWidth - padding;
    }

    // Проверяем, не уходит ли picker за левый край экрана
    if (left < padding) {
      left = padding;
    }

    // Проверяем, не уходит ли picker за верхний край экрана
    if (top < padding) {
      top = padding;
    }

    setEmojiPickerPosition({
      top: Math.max(padding, top),
      left: Math.max(padding, left)
    });
    setSelectedMessageForReaction(messageId);
    setShowEmojiPicker(true);
  }, []);

  // Выбор эмодзи
  const handleEmojiSelect = useCallback((emoji) => {
    if (!selectedMessageForReaction || !socket || !user) return;

    socket.emit(SOCKET_EVENTS.REACTION_ADD, {
      messageId: selectedMessageForReaction,
      emoji,
      userId: user.id,
      username: user.username,
      isDM: true
    });

    setShowEmojiPicker(false);
    setSelectedMessageForReaction(null);
  }, [selectedMessageForReaction, socket, user]);

  // Клик по реакции
  const handleReactionClick = useCallback((messageId, emoji, userReacted) => {
    if (!socket || !user) return;

    if (userReacted) {
      // Удалить реакцию
      socket.emit(SOCKET_EVENTS.REACTION_REMOVE, {
        messageId,
        emoji,
        userId: user.id,
        isDM: true
      });
    } else {
      // Добавить реакцию
      socket.emit(SOCKET_EVENTS.REACTION_ADD, {
        messageId,
        emoji,
        userId: user.id,
        username: user.username,
        isDM: true
      });
    }
  }, [socket, user]);

  // Закрытие эмодзи пикера
  const closeEmojiPicker = useCallback(() => {
    setShowEmojiPicker(false);
    setSelectedMessageForReaction(null);
  }, []);

  return {
    showEmojiPicker,
    emojiPickerPosition,
    selectedMessageForReaction,
    handleAddReaction,
    handleEmojiSelect,
    handleReactionClick,
    closeEmojiPicker
  };
};
