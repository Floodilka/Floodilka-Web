import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { scrollToBottom as scrollToBottomUtil, scrollToMessageById, isUserNearBottom } from '../utils/scrollUtils';

export const useSimpleScroll = (messages, channel, isReady, prefersReducedMotion) => {
  const messagesContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const prevMessagesLengthRef = useRef(0);
  const resizeObserverRef = useRef(null);
  const [newMessageIds, setNewMessageIds] = useState(new Set());
  const [initialScrollDone, setInitialScrollDone] = useState(false);

  const channelId = channel?.id ?? null;

  // Сброс состояния при смене канала
  useEffect(() => {
    if (channelId) {
      setInitialScrollDone(false);
      prevMessagesLengthRef.current = 0;
    }
  }, [channelId, channel?.name]);

  // Первоначальный скролл при загрузке сообщений
  useLayoutEffect(() => {
    if (!messagesContainerRef.current || !channelId || !isReady || initialScrollDone) return;

    const container = messagesContainerRef.current;
    if (messages.length > 0) {
      scrollToBottomUtil(container, false, prefersReducedMotion);
      setInitialScrollDone(true);
    } else {
      setInitialScrollDone(true);
    }
  }, [channelId, isReady, messages.length, prefersReducedMotion, initialScrollDone]);

  // Обработка новых сообщений
  useEffect(() => {
    if (!messagesContainerRef.current || !isReady) return;

    const container = messagesContainerRef.current;
    const currentLength = messages.length;
    const prevLength = prevMessagesLengthRef.current;

    if (currentLength > prevLength) {
      // Новые сообщения появились
      const newMessages = messages.slice(prevLength);
      const newIds = new Set(newMessages.map(msg => msg.id));
      setNewMessageIds(prev => new Set([...prev, ...newIds]));

      // Скроллим вниз только если пользователь уже внизу
      if (isUserNearBottom(container)) {
        scrollToBottomUtil(container, true, prefersReducedMotion);
      }

      // Убираем подсветку новых сообщений через 3 секунды
      setTimeout(() => {
        setNewMessageIds(new Set());
      }, 3000);
    }

    prevMessagesLengthRef.current = currentLength;
  }, [messages, isReady, prefersReducedMotion]);

  // ResizeObserver для обработки изменений размера контента
  useEffect(() => {
    if (!messagesContainerRef.current || !isReady) return;

    const container = messagesContainerRef.current;

    resizeObserverRef.current = new ResizeObserver(() => {
      if (isUserNearBottom(container)) {
        scrollToBottomUtil(container, false, prefersReducedMotion);
      }
    });

    resizeObserverRef.current.observe(container);

    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
    };
  }, [isReady, prefersReducedMotion]);

  const scrollToBottom = useCallback((smooth = true) => {
    if (!messagesContainerRef.current) return;
    scrollToBottomUtil(messagesContainerRef.current, smooth, prefersReducedMotion);
  }, [prefersReducedMotion]);

  const scrollToMessage = useCallback((messageId) => {
    if (!messagesContainerRef.current) return;
    scrollToMessageById(messagesContainerRef.current, messageId, prefersReducedMotion);
  }, [prefersReducedMotion]);

  return {
    messagesContainerRef,
    messagesEndRef,
    newMessageIds,
    scrollToBottom,
    scrollToMessage
  };
};