import { useRef, useCallback, useLayoutEffect, useEffect, useState } from 'react';

/**
 * Хук для управления скроллом в DirectMessages
 */
export const useScroll = (messages, selectedDM, isLoadingMessages, prefersReducedMotion) => {
  const messagesContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const initialScrollDoneRef = useRef(false);
  const prevLoadingRef = useRef(false);
  const [newDmMessageIds, setNewDmMessageIds] = useState(new Set());
  const prevMessagesLengthRef = useRef(0);
  const dmWelcomeRef = useRef(null);
  const [dmWelcomeH, setDmWelcomeH] = useState(0);
  const resizeObserverRef = useRef(null);

  // scrollToBottom функция
  const scrollToBottom = useCallback((smooth = false) => {
    const c = messagesContainerRef.current;
    if (!c || messages.length === 0) return;

    const target = c.scrollHeight - c.clientHeight;
    console.log(`[DM] scrollToBottom called:`, {
      dmId: selectedDM?._id,
      dmUsername: selectedDM?.user?.username || selectedDM?.username,
      smooth,
      messagesCount: messages.length,
      scrollHeight: c.scrollHeight,
      clientHeight: c.clientHeight,
      target,
      currentScrollTop: c.scrollTop
    });

    if (smooth && !prefersReducedMotion) {
      c.scrollTo({ top: target, behavior: 'smooth' });
    } else {
      c.scrollTop = target;
    }

    if (!smooth) {
      setTimeout(() => {
        c.scrollTop = c.scrollHeight - c.clientHeight;
        console.log(`[DM] scrollToBottom fallback applied:`, {
          dmId: selectedDM?._id,
          finalScrollTop: c.scrollTop
        });
      }, 10);
    }
  }, [messages.length, prefersReducedMotion, selectedDM?._id, selectedDM?.user?.username, selectedDM?.username]);

  // Прокрутка к сообщению по ID
  const scrollToMessageById = useCallback((messageId) => {
    if (!messageId || !messagesContainerRef.current) return;

    const target = messagesContainerRef.current.querySelector(`[data-message-id="${messageId}"]`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  // Измерение высоты welcome блока
  useLayoutEffect(() => {
    const el = dmWelcomeRef.current;
    if (!el) return;
    const update = () => setDmWelcomeH(el.offsetHeight || 0);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [selectedDM?._id, isLoadingMessages]);

  // Сброс флагов при смене собеседника
  useEffect(() => {
    console.log(`[DM] DM changed, resetting scroll flags:`, {
      dmId: selectedDM?._id,
      dmUsername: selectedDM?.user?.username || selectedDM?.username,
      previousDMId: initialScrollDoneRef.current ? 'had previous' : 'none'
    });
    setBootstrapping(true);
    initialScrollDoneRef.current = false;
  }, [selectedDM?._id]);

  // Скролл после завершения первой загрузки
  useEffect(() => {
    const wasLoading = prevLoadingRef.current;
    prevLoadingRef.current = isLoadingMessages;

    if (wasLoading && !isLoadingMessages && !initialScrollDoneRef.current && messages.length > 0) {
      console.log(`[DM] First load completed, scrolling to bottom:`, {
        dmId: selectedDM?._id,
        messagesCount: messages.length
      });
      const c = messagesContainerRef.current;
      if (c) {
        requestAnimationFrame(() => {
          c.scrollTop = c.scrollHeight - c.clientHeight;
          initialScrollDoneRef.current = true;
          setBootstrapping(false);
          console.log(`[DM] Initial scroll completed after load:`, {
            dmId: selectedDM?._id,
            finalScrollTop: c.scrollTop
          });
          setTimeout(() => {
            c.scrollTop = c.scrollHeight - c.clientHeight;
          }, 0);
        });
      }
    }
  }, [isLoadingMessages, messages.length, selectedDM?._id]);

  // Компенсация для welcome-блока
  useLayoutEffect(() => {
    const c = messagesContainerRef.current;
    if (!c) return;

    const atBottom = c.scrollHeight - c.scrollTop - c.clientHeight < 2;
    if (atBottom) {
      console.log(`[DM] Welcome block height changed, maintaining bottom position:`, {
        dmId: selectedDM?._id,
        dmWelcomeH,
        atBottom
      });
      c.scrollTop = c.scrollHeight - c.clientHeight;
    }
  }, [dmWelcomeH, selectedDM?._id]);

  // Первый скролл — синхронно
  useLayoutEffect(() => {
    console.log(`[DM] useLayoutEffect for initial scroll:`, {
      dmId: selectedDM?._id,
      dmUsername: selectedDM?.user?.username || selectedDM?.username,
      isLoadingMessages,
      messagesCount: messages.length,
      hasContainer: !!messagesContainerRef.current,
      initialScrollDone: initialScrollDoneRef.current,
      dmWelcomeH
    });

    const c = messagesContainerRef.current;
    if (!c) return;
    if (!selectedDM?._id) return;

    if (isLoadingMessages) return;
    if (messages.length === 0) return;

    if (!initialScrollDoneRef.current) {
      const target = c.scrollHeight - c.clientHeight;
      console.log(`[DM] Initial scroll to bottom:`, {
        dmId: selectedDM?._id,
        dmUsername: selectedDM?.user?.username || selectedDM?.username,
        scrollHeight: c.scrollHeight,
        clientHeight: c.clientHeight,
        target,
        currentScrollTop: c.scrollTop
      });
      requestAnimationFrame(() => {
        c.scrollTop = c.scrollHeight - c.clientHeight;
        initialScrollDoneRef.current = true;
        setBootstrapping(false);
        console.log(`[DM] Setting bootstrapping to false for DM:`, selectedDM?._id);
        setTimeout(() => {
          c.scrollTop = c.scrollHeight - c.clientHeight;
          console.log(`[DM] Initial scroll fallback applied:`, {
            dmId: selectedDM?._id,
            finalScrollTop: c.scrollTop
          });
        }, 0);
      });
    }
  }, [selectedDM?._id, isLoadingMessages, messages.length, dmWelcomeH]);

  // Доскролл после первой реальной загрузки
  useEffect(() => {
    const wasLoading = prevLoadingRef.current;
    prevLoadingRef.current = isLoadingMessages;

    if (wasLoading && !isLoadingMessages && !initialScrollDoneRef.current && messages.length > 0) {
      const c = messagesContainerRef.current;
      if (c) {
        console.log(`[DM] First load completed, scrolling to bottom:`, {
          dmId: selectedDM?._id,
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

    if (wasLoading && !isLoadingMessages && messages.length === 0) {
      console.log(`[DM] First load completed with empty DM, showing welcome:`, {
        dmId: selectedDM?._id
      });
      initialScrollDoneRef.current = true;
      setBootstrapping(false);
    }
  }, [isLoadingMessages, messages.length, selectedDM?._id]);

  // Анимация новых сообщений
  useLayoutEffect(() => {
    if (!messagesContainerRef.current || !selectedDM?._id) return;

    const container = messagesContainerRef.current;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    const hasNewMessages = messages.length > prevMessagesLengthRef.current;

    if (hasNewMessages) {
      const isFirstPaint = prevMessagesLengthRef.current === 0;

      if (!isFirstPaint && isNearBottom && !bootstrapping) {
        const newIds = new Set();
        const start = prevMessagesLengthRef.current;
        for (let i = start; i < messages.length; i++) {
          if (messages[i]?._id) newIds.add(messages[i]._id);
        }
        setNewDmMessageIds(newIds);
        scrollToBottom(true);
        setTimeout(() => setNewDmMessageIds(new Set()), 200);
      }
    }

    prevMessagesLengthRef.current = messages.length;
  }, [messages.length, scrollToBottom, selectedDM?._id, bootstrapping]);

  // ResizeObserver для автоскролла при догрузке медиа
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || !selectedDM?._id) return;

    const isUserNearBottom = () =>
      container.scrollHeight - container.scrollTop - container.clientHeight < 100;

    let lastHeight = container.scrollHeight;
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newHeight = entry.target.scrollHeight;
        if (newHeight > lastHeight) {
          if (!bootstrapping && isUserNearBottom()) {
            scrollToBottom(true);
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
  }, [selectedDM?._id, scrollToBottom, bootstrapping]);

  return {
    messagesContainerRef,
    messagesEndRef,
    dmWelcomeRef,
    bootstrapping,
    dmWelcomeH,
    newDmMessageIds,
    scrollToBottom,
    scrollToMessageById
  };
};
