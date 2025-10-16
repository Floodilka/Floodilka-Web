import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { scrollToBottom, scrollToMessageById, isUserNearBottom } from '../utils/scrollUtils';

/**
 * Хук для управления скроллом в чате
 */
export const useScroll = (messages, channel, isLoadingMessages, prefersReducedMotion) => {
  const messagesContainerRef = useRef(null);
  const prevMessagesLengthRef = useRef(0);
  const resizeObserverRef = useRef(null);
  const [newMessageIds, setNewMessageIds] = useState(new Set());

  // Флаги для синхронного скролла
  const [bootstrapping, setBootstrapping] = useState(true);
  const initialScrollDoneRef = useRef(false);
  const prevLoadingRef = useRef(false);
  const prevChannelIdRef = useRef(null);
  const startedEmptyRef = useRef(false);

  const channelId = channel?.id ?? null;

  // Следим за сменой канала
  useEffect(() => {
    if (!channelId) return;
    if (prevChannelIdRef.current !== channelId) {
      console.log(`[SCROLL] Channel changed, resetting scroll flags:`, {
        channelId,
        channelName: channel?.name,
        previousChannelId: prevChannelIdRef.current || 'none'
      });
      prevChannelIdRef.current = channelId;
      setBootstrapping(true);
      initialScrollDoneRef.current = false;
      startedEmptyRef.current = false;
    }
  }, [channelId, channel?.name]);

  // Первый скролл — строго синхронно до показа
  useLayoutEffect(() => {
    console.log(`[SCROLL] useLayoutEffect for initial scroll:`, {
      channelId: channel?.id,
      channelName: channel?.name,
      isLoadingMessages,
      messagesCount: messages.length,
      hasContainer: !!messagesContainerRef.current,
      initialScrollDone: initialScrollDoneRef.current
    });

    if (!messagesContainerRef.current) return;
    if (!channelId) return;
    if (isLoadingMessages) return;
    if (messages.length === 0) return;

    if (!initialScrollDoneRef.current) {
      const c = messagesContainerRef.current;
      const target = c.scrollHeight - c.clientHeight;
      console.log(`[SCROLL] Initial scroll to bottom:`, {
        channelId: channel?.id,
        channelName: channel?.name,
        scrollHeight: c.scrollHeight,
        clientHeight: c.clientHeight,
        target,
        currentScrollTop: c.scrollTop
      });

      c.scrollTop = target;
      initialScrollDoneRef.current = true;

      requestAnimationFrame(() => {
        console.log(`[SCROLL] Setting bootstrapping to false for channel:`, channel?.id);
        setBootstrapping(false);
      });

      setTimeout(() => {
        c.scrollTop = c.scrollHeight - c.clientHeight;
      }, 0);
    }
  }, [channelId, isLoadingMessages, messages.length]);

  // Доскролл после первой реальной загрузки
  useEffect(() => {
    const wasLoading = prevLoadingRef.current;
    prevLoadingRef.current = isLoadingMessages;

    if (wasLoading && !isLoadingMessages && !initialScrollDoneRef.current && messages.length > 0 && channelId) {
      const c = messagesContainerRef.current;
      if (c) {
        console.log(`[SCROLL] First load completed, scrolling to bottom:`, {
          channelId,
          messagesCount: messages.length
        });
        requestAnimationFrame(() => {
          c.scrollTop = c.scrollHeight - c.clientHeight;
          initialScrollDoneRef.current = true;
          setBootstrapping(false);
          setTimeout(() => {
            c.scrollTop = c.scrollHeight - c.clientHeight;
          }, 0);
        });
      }
    }

    if (wasLoading && !isLoadingMessages && messages.length === 0 && channelId) {
      console.log(`[SCROLL] First load completed with empty channel, showing welcome:`, {
        channelId
      });
      initialScrollDoneRef.current = true;
      setBootstrapping(false);
      startedEmptyRef.current = true;
    }
  }, [isLoadingMessages, messages.length, channelId]);

  // Мостик: пустой старт → появились сообщения
  useEffect(() => {
    if (!channelId) return;
    if (startedEmptyRef.current && messages.length > 0 && messagesContainerRef.current) {
      console.log(`[SCROLL] Messages appeared after empty start, scrolling to bottom:`, {
        channelId,
        messagesCount: messages.length
      });
      const c = messagesContainerRef.current;
      c.scrollTop = c.scrollHeight - c.clientHeight;
      setTimeout(() => {
        c.scrollTop = c.scrollHeight - c.clientHeight;
      }, 0);
      startedEmptyRef.current = false;
      initialScrollDoneRef.current = true;
      setBootstrapping(false);
    }
  }, [messages.length, channelId]);

  // Автоскролл при добавлении новых сообщений
  useLayoutEffect(() => {
    if (!messagesContainerRef.current || !channelId) return;

    const container = messagesContainerRef.current;
    const isNearBottom = isUserNearBottom(container);
    const hasNewMessages = messages.length > prevMessagesLengthRef.current;

    if (hasNewMessages) {
      const isFirstPaint = prevMessagesLengthRef.current === 0;

      if (!isFirstPaint && isNearBottom && !bootstrapping) {
        const newIds = new Set();
        const start = prevMessagesLengthRef.current;
        for (let i = start; i < messages.length; i++) {
          if (messages[i]?.id) newIds.add(messages[i].id);
        }
        setNewMessageIds(newIds);
        scrollToBottom(container, true, prefersReducedMotion);
        setTimeout(() => setNewMessageIds(new Set()), 200);
      }
    }

    prevMessagesLengthRef.current = messages.length;
  }, [messages.length, channelId, bootstrapping, prefersReducedMotion]);

  // ResizeObserver для автоскролла при загрузке изображений
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || !channelId) return;

    let lastHeight = container.scrollHeight;
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newHeight = entry.target.scrollHeight;
        if (newHeight > lastHeight) {
          if (!bootstrapping && isUserNearBottom(container)) {
            scrollToBottom(container, true, prefersReducedMotion);
          }
          lastHeight = newHeight;
        }
      }
    });

    resizeObserver.observe(container);
    resizeObserverRef.current = resizeObserver;

    return () => {
      resizeObserver.disconnect();
      resizeObserverRef.current = null;
    };
  }, [channelId, bootstrapping, prefersReducedMotion]);

  const scrollToBottomCallback = useCallback((smooth = false) => {
    scrollToBottom(messagesContainerRef.current, smooth, prefersReducedMotion);
  }, [prefersReducedMotion]);

  const scrollToMessageCallback = useCallback((messageId) => {
    scrollToMessageById(messagesContainerRef.current, messageId, prefersReducedMotion);
  }, [prefersReducedMotion]);

  return {
    messagesContainerRef,
    bootstrapping,
    newMessageIds,
    scrollToBottom: scrollToBottomCallback,
    scrollToMessage: scrollToMessageCallback
  };
};
