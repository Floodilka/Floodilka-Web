import { useState, useEffect, useRef } from 'react';

/**
 * Состояния загрузки личных сообщений
 */
export const DM_LOADING_STATES = {
  IDLE: 'idle',                    // Начальное состояние
  LOADING: 'loading',              // Загружаем сообщения
  LOADED: 'loaded',                // Сообщения загружены
  SCROLLING: 'scrolling',          // Скроллим вниз
  READY: 'ready'                   // Готово к показу
};

/**
 * Хук для управления состояниями загрузки личных сообщений
 * Обеспечивает четкую последовательность: загрузка -> скролл -> показ
 */
export const useDMLoading = (selectedDM, messages, messagesLoading, bootstrapping) => {
  const [loadingState, setLoadingState] = useState(DM_LOADING_STATES.IDLE);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [showMessages, setShowMessages] = useState(false);
  const [skeletonMessages, setSkeletonMessages] = useState([]);

  // Refs для отслеживания изменений
  const prevDMIdRef = useRef(null);
  const prevLoadingRef = useRef(false);
  const scrollTimeoutRef = useRef(null);
  const loadingTimeoutRef = useRef(null);

  const dmId = selectedDM?._id;

  // Сброс состояния при смене разговора
  useEffect(() => {
    if (dmId !== prevDMIdRef.current) {
      // Очищаем таймауты
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = null;
      }
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }

      setLoadingState(DM_LOADING_STATES.IDLE);
      setShowSkeleton(false);
      setShowMessages(false);
      prevDMIdRef.current = dmId;
      prevLoadingRef.current = false;
    }
  }, [dmId, loadingState]);

  // Основная логика переходов состояний
  useEffect(() => {
    const wasLoading = prevLoadingRef.current;
    prevLoadingRef.current = messagesLoading;

    // Переход в LOADING при начале загрузки
    if (messagesLoading && loadingState === DM_LOADING_STATES.IDLE) {
      setLoadingState(DM_LOADING_STATES.LOADING);
      setShowSkeleton(true);
      setShowMessages(false);

      // Анализируем сообщения для создания скелетона
      if (messages.length > 0) {
        const skeletonData = messages.map(msg => {
          const attachments = msg.attachments || [];
          const imageAttachments = attachments.filter(att =>
            att.type === 'image' ||
            att.mimetype?.startsWith('image/') ||
            att.filename?.match(/\.(jpg|jpeg|png|gif|webp)$/i)
          );

          return {
            id: msg._id || msg.id,
            hasImages: imageAttachments.length > 0,
            imageCount: imageAttachments.length,
            attachments: imageAttachments
          };
        });
        setSkeletonMessages(skeletonData);
      }
      return;
    }

    // Переход из LOADING в LOADED при завершении загрузки
    if (wasLoading && !messagesLoading && loadingState === DM_LOADING_STATES.LOADING) {
      setLoadingState(DM_LOADING_STATES.LOADED);

      // Переходим к скроллу
      setLoadingState(DM_LOADING_STATES.SCROLLING);

      // Даем время на скролл, затем показываем сообщения
      scrollTimeoutRef.current = setTimeout(() => {
        setLoadingState(DM_LOADING_STATES.READY);
        setShowSkeleton(false);
        setShowMessages(true);
      }, 1000); // Минимум 1 секунда для скелетона
      return;
    }

    // Дополнительная проверка: если мы в LOADING, но сообщения уже есть, переходим к SCROLLING
    if (loadingState === DM_LOADING_STATES.LOADING && messages.length > 0) {
      setLoadingState(DM_LOADING_STATES.SCROLLING);

      // Даем время на скролл, затем показываем сообщения
      scrollTimeoutRef.current = setTimeout(() => {
        setLoadingState(DM_LOADING_STATES.READY);
        setShowSkeleton(false);
        setShowMessages(true);
      }, 1000); // Минимум 1 секунда для скелетона
      return;
    }

    // Переход к READY когда появляются сообщения после SCROLLING
    if (loadingState === DM_LOADING_STATES.SCROLLING && messages.length > 0) {
      // Очищаем таймаут скролла если он есть
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = null;
      }

      // Даем время на скролл, затем показываем сообщения
      scrollTimeoutRef.current = setTimeout(() => {
        setLoadingState(DM_LOADING_STATES.READY);
        setShowSkeleton(false);
        setShowMessages(true);
      }, 1000); // Минимум 1 секунда для скелетона
      return;
    }

    // Переход к READY для пустых разговоров после SCROLLING
    if (loadingState === DM_LOADING_STATES.SCROLLING && messages.length === 0 && !messagesLoading) {
      setLoadingState(DM_LOADING_STATES.READY);
      setShowSkeleton(false);
      setShowMessages(true);
      return;
    }

    // Переход в READY, если нет сообщений и загрузка завершена (например, пустой разговор)
    if (loadingState === DM_LOADING_STATES.LOADED && messages.length === 0 && !messagesLoading) {
      setLoadingState(DM_LOADING_STATES.READY);
      setShowSkeleton(false);
      setShowMessages(true);
      return;
    }

  }, [dmId, messagesLoading, messages.length, loadingState]);

  // Таймаут для принудительного перехода в READY (защита от зависания)
  useEffect(() => {
    if (loadingState === DM_LOADING_STATES.LOADING) {
      loadingTimeoutRef.current = setTimeout(() => {
        setLoadingState(DM_LOADING_STATES.READY);
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
  }, [loadingState, messages]);

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
    skeletonMessages,
    isReady: loadingState === DM_LOADING_STATES.READY,
    isScrolling: loadingState === DM_LOADING_STATES.SCROLLING
  };
};
