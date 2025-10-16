import { useCallback, useEffect, useRef, useState } from 'react';

const MIN_SCALE = 1.0;
const MAX_SCALE = 4.0;
const DEFAULT_SCALE = 1.0;
const ZOOM_STEP = 0.1;
const DOUBLE_CLICK_THRESHOLD = 300; // мс

/**
 * Хук для управления лайтбоксом (зум, панорамирование, навигация)
 * @param {Object} props - Параметры хука
 * @param {Array} props.images - Массив изображений
 * @param {number} props.currentIndex - Текущий индекс изображения
 * @param {Function} props.onIndexChange - Колбэк смены индекса
 * @param {Function} props.onClose - Колбэк закрытия
 * @param {boolean} props.prefersReducedMotion - Предпочтение уменьшенной анимации
 * @returns {Object} Объект с контролами и методами
 */
export function useLightboxControls({
  images,
  currentIndex,
  onIndexChange,
  onClose,
  prefersReducedMotion
}) {
  const [controls, setControls] = useState({
    scale: DEFAULT_SCALE,
    translateX: 0,
    translateY: 0,
    isDragging: false,
    dragStart: { x: 0, y: 0 },
    lastPan: { x: 0, y: 0 }
  });

  const lastClickTime = useRef(0);
  const imageRef = useRef(null);
  const containerRef = useRef(null);

  // Сброс контролов при смене изображения
  useEffect(() => {
    setControls(prev => ({
      ...prev,
      scale: DEFAULT_SCALE,
      translateX: 0,
      translateY: 0,
      isDragging: false,
      lastPan: { x: 0, y: 0 }
    }));
  }, [currentIndex]);

  // Блокировка скролла body при открытом лайтбоксе
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Ограничение панорамирования в пределах изображения
  const constrainPan = useCallback((scale, translateX, translateY) => {
    if (!imageRef.current || !containerRef.current) return { translateX, translateY };

    const img = imageRef.current;
    const container = containerRef.current;

    const imgRect = img.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    const scaledWidth = imgRect.width * scale;
    const scaledHeight = imgRect.height * scale;

    const maxTranslateX = Math.max(0, (scaledWidth - containerRect.width) / 2);
    const maxTranslateY = Math.max(0, (scaledHeight - containerRect.height) / 2);

    return {
      translateX: Math.max(-maxTranslateX, Math.min(maxTranslateX, translateX)),
      translateY: Math.max(-maxTranslateY, Math.min(maxTranslateY, translateY))
    };
  }, []);

  // Обновление контролов с ограничениями
  const updateControls = useCallback((updates) => {
    setControls(prev => {
      const newControls = { ...prev, ...updates };

      if (updates.scale !== undefined || updates.translateX !== undefined || updates.translateY !== undefined) {
        const constrained = constrainPan(
          newControls.scale,
          newControls.translateX,
          newControls.translateY
        );
        newControls.translateX = constrained.translateX;
        newControls.translateY = constrained.translateY;
      }

      return newControls;
    });
  }, [constrainPan]);

  // Зум к курсору
  const zoomToCursor = useCallback((delta, clientX, clientY) => {
    if (!imageRef.current || !containerRef.current) return;

    const img = imageRef.current;
    const container = containerRef.current;

    const imgRect = img.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    const relativeX = clientX - imgRect.left - imgRect.width / 2;
    const relativeY = clientY - imgRect.top - imgRect.height / 2;

    const zoomFactor = delta > 0 ? 1 + ZOOM_STEP : 1 - ZOOM_STEP;
    const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, controls.scale * zoomFactor));

    if (newScale !== controls.scale) {
      const scaleRatio = newScale / controls.scale;
      const newTranslateX = controls.translateX + relativeX * (1 - scaleRatio);
      const newTranslateY = controls.translateY + relativeY * (1 - scaleRatio);

      updateControls({
        scale: newScale,
        translateX: newTranslateX,
        translateY: newTranslateY
      });
    }
  }, [controls.scale, controls.translateX, controls.translateY, updateControls]);

  // Обработчики событий
  const handleWheel = useCallback((e) => {
    e.preventDefault();

    if (Math.abs(e.deltaY) < 10) return; // Игнорируем мелкие движения

    zoomToCursor(e.deltaY, e.clientX, e.clientY);
  }, [zoomToCursor]);

  const handleMouseDown = useCallback((e) => {
    if (controls.scale <= 1) return; // Панорамирование только при зуме

    e.preventDefault();
    updateControls({
      isDragging: true,
      dragStart: { x: e.clientX, y: e.clientY },
      lastPan: { x: controls.translateX, y: controls.translateY }
    });
  }, [controls.scale, controls.translateX, controls.translateY, updateControls]);

  const handleMouseMove = useCallback((e) => {
    if (!controls.isDragging) return;

    e.preventDefault();

    const deltaX = e.clientX - controls.dragStart.x;
    const deltaY = e.clientY - controls.dragStart.y;

    updateControls({
      translateX: controls.lastPan.x + deltaX,
      translateY: controls.lastPan.y + deltaY
    });
  }, [controls.isDragging, controls.dragStart, controls.lastPan, updateControls]);

  const handleMouseUp = useCallback(() => {
    updateControls({ isDragging: false });
  }, [updateControls]);

  const handleDoubleClick = useCallback((e) => {
    e.preventDefault();

    const now = Date.now();
    if (now - lastClickTime.current < DOUBLE_CLICK_THRESHOLD) {
      const newScale = controls.scale === DEFAULT_SCALE ? 2.0 : DEFAULT_SCALE;
      updateControls({
        scale: newScale,
        translateX: 0,
        translateY: 0
      });
    }
    lastClickTime.current = now;
  }, [controls.scale, updateControls]);

  const handleKeyDown = useCallback((e) => {
    switch (e.key) {
      case 'Escape':
        onClose();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (currentIndex > 0) {
          onIndexChange(currentIndex - 1);
        }
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (currentIndex < images.length - 1) {
          onIndexChange(currentIndex + 1);
        }
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (currentIndex < images.length - 1) {
          onIndexChange(currentIndex + 1);
        }
        break;
      default:
        // Игнорируем другие клавиши
        break;
    }
  }, [currentIndex, images.length, onIndexChange, onClose]);

  // Touch события для мобильных устройств
  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 1 && controls.scale > 1) {
      const touch = e.touches[0];
      updateControls({
        isDragging: true,
        dragStart: { x: touch.clientX, y: touch.clientY },
        lastPan: { x: controls.translateX, y: controls.translateY }
      });
    }
  }, [controls.scale, controls.translateX, controls.translateY, updateControls]);

  const handleTouchMove = useCallback((e) => {
    if (e.touches.length === 1 && controls.isDragging) {
      e.preventDefault();
      const touch = e.touches[0];

      const deltaX = touch.clientX - controls.dragStart.x;
      const deltaY = touch.clientY - controls.dragStart.y;

      updateControls({
        translateX: controls.lastPan.x + deltaX,
        translateY: controls.lastPan.y + deltaY
      });
    } else if (e.touches.length === 2) {
      // Пинч-зум
      e.preventDefault();
      // const touch1 = e.touches[0];
      // const touch2 = e.touches[1];

      // Простая реализация пинч-зума
      // const distance = Math.sqrt(
      //   Math.pow(touch2.clientX - touch1.clientX, 2) +
      //   Math.pow(touch2.clientY - touch1.clientY, 2)
      // );

      // const centerX = (touch1.clientX + touch2.clientX) / 2;
      // const centerY = (touch1.clientY + touch2.clientY) / 2;

      // Здесь можно добавить более сложную логику пинч-зума
      // Пока что используем базовую реализацию
    }
  }, [controls.isDragging, controls.dragStart, controls.lastPan, updateControls]);

  const handleTouchEnd = useCallback(() => {
    updateControls({ isDragging: false });
  }, [updateControls]);

  // Swipe для навигации
  const handleSwipe = useCallback((direction) => {
    if (controls.scale > 1) return; // Навигация только без зума

    if (direction === 'left' && currentIndex < images.length - 1) {
      onIndexChange(currentIndex + 1);
    } else if (direction === 'right' && currentIndex > 0) {
      onIndexChange(currentIndex - 1);
    }
  }, [controls.scale, currentIndex, images.length, onIndexChange]);

  // Регистрация событий
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('wheel', handleWheel, { passive: false });
    container.addEventListener('mousedown', handleMouseDown);
    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('dblclick', handleDoubleClick);
    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('mousedown', handleMouseDown);
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('dblclick', handleDoubleClick);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleWheel, handleMouseDown, handleMouseMove, handleMouseUp, handleDoubleClick, handleTouchStart, handleTouchMove, handleTouchEnd, handleKeyDown]);

  return {
    controls,
    imageRef,
    containerRef,
    updateControls,
    handleSwipe
  };
}
