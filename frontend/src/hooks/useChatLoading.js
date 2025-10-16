import { useState, useEffect, useRef } from 'react';

/**
 * Состояния загрузки чата
 */
export const CHAT_LOADING_STATES = {
  IDLE: 'idle',                    // Начальное состояние
  LOADING: 'loading',              // Загружаем сообщения
  LOADED: 'loaded',                // Сообщения загружены
  SCROLLING: 'scrolling',          // Скроллим вниз
  READY: 'ready'                   // Готово к показу
};

/**
 * Хук для управления состояниями загрузки чата
 * Обеспечивает четкую последовательность: загрузка -> скролл -> показ
 */
export const useChatLoading = (channel, messages, isLoadingMessages, preloadedMessages) => {
  const [loadingState, setLoadingState] = useState(CHAT_LOADING_STATES.IDLE);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [showMessages, setShowMessages] = useState(false);

  // Refs для отслеживания изменений
  const prevChannelIdRef = useRef(null);
  const prevLoadingRef = useRef(false);
  const scrollTimeoutRef = useRef(null);
  const loadingTimeoutRef = useRef(null);

  const channelId = channel?.id;

  // Сброс состояния при смене канала
  useEffect(() => {
    if (channelId !== prevChannelIdRef.current) {
      // Очищаем таймауты
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = null;
      }
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }

      setLoadingState(CHAT_LOADING_STATES.IDLE);
      setShowSkeleton(false);
      setShowMessages(false);
      prevChannelIdRef.current = channelId;
      prevLoadingRef.current = false;
    }
  }, [channelId, loadingState]);

  // Основная логика переходов состояний
  useEffect(() => {
    const wasLoading = prevLoadingRef.current;
    prevLoadingRef.current = isLoadingMessages;

    // Переход в LOADING при начале загрузки
    if (isLoadingMessages && loadingState === CHAT_LOADING_STATES.IDLE) {
      setLoadingState(CHAT_LOADING_STATES.LOADING);
      setShowSkeleton(true);
      setShowMessages(false);
      return;
    }

    // Переход из LOADING в LOADED при завершении загрузки
    if (wasLoading && !isLoadingMessages && loadingState === CHAT_LOADING_STATES.LOADING) {
      setLoadingState(CHAT_LOADING_STATES.LOADED);

      // Если есть предзагруженные сообщения, сразу переходим к скроллу
      if (preloadedMessages) {
        setLoadingState(CHAT_LOADING_STATES.SCROLLING);

        // Даем время на скролл, затем показываем сообщения
        scrollTimeoutRef.current = setTimeout(() => {
          setLoadingState(CHAT_LOADING_STATES.READY);
          setShowSkeleton(false);
          setShowMessages(true);
        }, 1000); // Минимум 1 секунда для скелетона
      } else {
        // Если нет предзагруженных сообщений, ждем появления сообщений
        setLoadingState(CHAT_LOADING_STATES.SCROLLING);
      }
      return;
    }

    // Дополнительная проверка: если мы в LOADING, но сообщения уже есть, переходим к SCROLLING
    if (loadingState === CHAT_LOADING_STATES.LOADING && messages.length > 0) {
      setLoadingState(CHAT_LOADING_STATES.SCROLLING);

      // Даем время на скролл, затем показываем сообщения
      scrollTimeoutRef.current = setTimeout(() => {
        setLoadingState(CHAT_LOADING_STATES.READY);
        setShowSkeleton(false);
        setShowMessages(true);
      }, 1000); // Минимум 1 секунда для скелетона
      return;
    }

    // Переход к READY когда появляются сообщения после SCROLLING
    if (loadingState === CHAT_LOADING_STATES.SCROLLING && messages.length > 0) {
      // Очищаем таймаут скролла если он есть
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = null;
      }

      // Даем время на скролл, затем показываем сообщения
      scrollTimeoutRef.current = setTimeout(() => {
        setLoadingState(CHAT_LOADING_STATES.READY);
        setShowSkeleton(false);
        setShowMessages(true);
      }, 1000); // Минимум 1 секунда для скелетона
      return;
    }

    // Переход к READY для пустых каналов после SCROLLING
    if (loadingState === CHAT_LOADING_STATES.SCROLLING && messages.length === 0 && !isLoadingMessages) {
      setLoadingState(CHAT_LOADING_STATES.READY);
      setShowSkeleton(false);
      setShowMessages(true);
      return;
    }
  }, [channelId, isLoadingMessages, messages.length, preloadedMessages, loadingState]);

  // Таймаут для принудительного перехода в READY (защита от зависания)
  useEffect(() => {
    if (loadingState === CHAT_LOADING_STATES.LOADING) {
      loadingTimeoutRef.current = setTimeout(() => {
        setLoadingState(CHAT_LOADING_STATES.READY);
        setShowSkeleton(false);
        setShowMessages(true);
      }, 2000); // Максимум 2 секунды загрузки
    }

    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
    };
  }, [loadingState]);

  // Очистка таймаутов при размонтировании
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, []);

  return {
    loadingState,
    showSkeleton,
    showMessages,
    isReady: loadingState === CHAT_LOADING_STATES.READY,
    isScrolling: loadingState === CHAT_LOADING_STATES.SCROLLING
  };
};