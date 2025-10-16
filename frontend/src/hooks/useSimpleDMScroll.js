import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { scrollToBottom as scrollToBottomUtil, isUserNearBottom } from '../utils/scrollUtils';

export const useSimpleDMScroll = (messages, selectedDM, isReady, prefersReducedMotion) => {
  const messagesContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const dmWelcomeRef = useRef(null);
  const prevMessagesLengthRef = useRef(0);
  const resizeObserverRef = useRef(null);
  const [newDmMessageIds, setNewDmMessageIds] = useState(new Set());
  const [initialScrollDone, setInitialScrollDone] = useState(false);
  const [dmWelcomeH, setDmWelcomeH] = useState(0);
  const [bootstrapping, setBootstrapping] = useState(false);

  const dmId = selectedDM?._id ?? null;

  // Сброс состояния при смене разговора
  useEffect(() => {
    if (dmId) {
      setInitialScrollDone(false);
      setBootstrapping(false);
      prevMessagesLengthRef.current = 0;
    }
  }, [dmId]);

  // Первоначальный скролл при загрузке сообщений
  useLayoutEffect(() => {
    if (!messagesContainerRef.current || !dmId || !isReady || initialScrollDone) return;

    const container = messagesContainerRef.current;
    if (messages.length > 0) {
      scrollToBottomUtil(container, false, prefersReducedMotion);
      setInitialScrollDone(true);
    } else {
      setInitialScrollDone(true);
    }
  }, [dmId, isReady, messages.length, prefersReducedMotion, initialScrollDone]);

  // Обработка новых сообщений
  useEffect(() => {
    if (!messagesContainerRef.current || !isReady) return;

    const container = messagesContainerRef.current;
    const currentLength = messages.length;
    const prevLength = prevMessagesLengthRef.current;

    if (currentLength > prevLength) {
      // Новые сообщения появились
      const newMessages = messages.slice(prevLength);
      const newIds = new Set(newMessages.map(msg => msg._id || msg.id));
      setNewDmMessageIds(prev => new Set([...prev, ...newIds]));

      // Скроллим вниз только если пользователь уже внизу
      if (isUserNearBottom(container)) {
        scrollToBottomUtil(container, true, prefersReducedMotion);
      }

      // Убираем подсветку новых сообщений через 3 секунды
      setTimeout(() => {
        setNewDmMessageIds(new Set());
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

  // Обработка загрузки изображений в сообщениях
  useEffect(() => {
    if (!messagesContainerRef.current || !isReady) return;

    const container = messagesContainerRef.current;
    // Ищем именно изображения с классом message-attachment-image
    const images = container.querySelectorAll('img.message-attachment-image, img[data-message-image], img[src*="/uploads/"]');

    let loadedImagesCount = 0;
    const totalImages = images.length;

    if (totalImages === 0) {
      // Если нет изображений, сразу скроллим
      if (isUserNearBottom(container)) {
        setTimeout(() => {
          scrollToBottomUtil(container, false, prefersReducedMotion);
        }, 100);
      }
      return;
    }

    const handleImageLoad = () => {
      loadedImagesCount++;
      // Если все изображения загружены и пользователь был внизу, скроллим
      if (loadedImagesCount === totalImages && isUserNearBottom(container)) {
        setTimeout(() => {
          scrollToBottomUtil(container, false, prefersReducedMotion);
        }, 100);
      }
    };

    const handleImageError = () => {
      loadedImagesCount++;
      // Обрабатываем ошибки загрузки как завершенную загрузку
      if (loadedImagesCount === totalImages && isUserNearBottom(container)) {
        setTimeout(() => {
          scrollToBottomUtil(container, false, prefersReducedMotion);
        }, 100);
      }
    };

    images.forEach(img => {
      if (img.complete) {
        loadedImagesCount++;
      } else {
        img.addEventListener('load', handleImageLoad);
        img.addEventListener('error', handleImageError);
      }
    });

    // Если все изображения уже загружены
    if (loadedImagesCount === totalImages && isUserNearBottom(container)) {
      setTimeout(() => {
        scrollToBottomUtil(container, false, prefersReducedMotion);
      }, 100);
    }

    return () => {
      images.forEach(img => {
        img.removeEventListener('load', handleImageLoad);
        img.removeEventListener('error', handleImageError);
      });
    };
  }, [messages, isReady, prefersReducedMotion]);

  // Отслеживание высоты welcome блока
  useEffect(() => {
    if (!dmWelcomeRef.current) return;

    const updateWelcomeHeight = () => {
      if (dmWelcomeRef.current) {
        setDmWelcomeH(dmWelcomeRef.current.offsetHeight);
      }
    };

    updateWelcomeHeight();
    const resizeObserver = new ResizeObserver(updateWelcomeHeight);
    resizeObserver.observe(dmWelcomeRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [selectedDM, isReady]);

  const scrollToBottom = useCallback((smooth = true) => {
    if (!messagesContainerRef.current) return;
    scrollToBottomUtil(messagesContainerRef.current, smooth, prefersReducedMotion);
  }, [prefersReducedMotion]);

  const scrollToMessageById = useCallback((messageId) => {
    if (!messagesContainerRef.current) return;
    scrollToMessageById(messagesContainerRef.current, messageId, prefersReducedMotion);
  }, [prefersReducedMotion]);

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
