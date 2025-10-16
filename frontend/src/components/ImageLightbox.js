import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLightboxControls } from '../hooks/useLightboxControls';

/**
 * Компонент лайтбокса для просмотра изображений в стиле Discord
 * @param {Object} props - Пропсы компонента
 * @param {Array} props.images - Массив изображений
 * @param {number} props.initialIndex - Индекс начального изображения
 * @param {Function} props.onClose - Колбэк закрытия
 */
export function ImageLightbox({ images, initialIndex, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isLoading, setIsLoading] = useState(true);
  const [preloadedImages, setPreloadedImages] = useState(new Set());
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);

  // Проверка предпочтений анимации
  const prefersReducedMotion = useMemo(() => {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // Управление лайтбоксом
  const {
    controls,
    imageRef,
    containerRef,
    handleSwipe
  } = useLightboxControls({
    images,
    currentIndex,
    onIndexChange: setCurrentIndex,
    onClose,
    prefersReducedMotion
  });

  // Сохранение фокуса при открытии
  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    return () => {
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    };
  }, []);

  // Открытие диалога
  useEffect(() => {
    if (dialogRef.current) {
      dialogRef.current.showModal();
    }
  }, []);

  // Предзагрузка соседних изображений
  const preloadImage = useCallback((index) => {
    if (index < 0 || index >= images.length || preloadedImages.has(index)) return;

    const img = new Image();
    img.onload = () => {
      setPreloadedImages(prev => new Set([...prev, index]));
    };
    img.src = images[index].src;
  }, [images, preloadedImages]);

  // Предзагрузка при смене изображения
  useEffect(() => {
    // Предзагружаем предыдущее и следующее изображение
    preloadImage(currentIndex - 1);
    preloadImage(currentIndex + 1);
  }, [currentIndex, preloadImage]);

  // Обработка загрузки изображения
  const handleImageLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  // Обработка ошибки загрузки
  const handleImageError = useCallback(() => {
    setIsLoading(false);
  }, []);

  // Обработка клика по фону
  const handleBackdropClick = useCallback((e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  // Обработка клика по изображению
  const handleImageClick = useCallback((e) => {
    e.stopPropagation();
    if (controls.scale <= 1) {
      onClose();
    }
  }, [controls.scale, onClose]);

  // Обработка навигации
  const handlePrev = useCallback((e) => {
    e.stopPropagation();
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setIsLoading(true);
    }
  }, [currentIndex]);

  const handleNext = useCallback((e) => {
    e.stopPropagation();
    if (currentIndex < images.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsLoading(true);
    }
  }, [currentIndex, images.length]);

  // Обработка закрытия
  const handleClose = useCallback((e) => {
    e.stopPropagation();
    onClose();
  }, [onClose]);

  // Обработка клавиш
  const handleKeyDown = useCallback((e) => {
    switch (e.key) {
      case 'Escape':
        onClose();
        break;
      case 'ArrowLeft':
        if (currentIndex > 0) {
          setCurrentIndex(currentIndex - 1);
          setIsLoading(true);
        }
        break;
      case 'ArrowRight':
        if (currentIndex < images.length - 1) {
          setCurrentIndex(currentIndex + 1);
          setIsLoading(true);
        }
        break;
      default:
        // Игнорируем другие клавиши
        break;
    }
  }, [currentIndex, images.length, onClose]);

  // Touch события для свайпа
  const handleTouchStart = useCallback((e) => {
    const touch = e.touches[0];
    const startX = touch.clientX;
    const startY = touch.clientY;

    const handleTouchEnd = (endEvent) => {
      const endTouch = endEvent.changedTouches[0];
      const deltaX = endTouch.clientX - startX;
      const deltaY = endTouch.clientY - startY;

      // Если свайп горизонтальный и достаточно длинный
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
        if (deltaX > 0) {
          handleSwipe('right');
        } else {
          handleSwipe('left');
        }
      }

      document.removeEventListener('touchend', handleTouchEnd);
    };

    document.addEventListener('touchend', handleTouchEnd);
  }, [handleSwipe]);

  const currentImage = images[currentIndex];
  if (!currentImage) return null;

  // Стили для трансформации изображения
  const imageStyle = {
    transform: `scale(${controls.scale}) translate(${controls.translateX}px, ${controls.translateY}px)`,
    cursor: controls.scale > 1 ? 'grab' : 'zoom-out',
    willChange: controls.scale > 1 ? 'transform' : 'auto'
  };

  return createPortal(
    <dialog
      ref={dialogRef}
      className="image-lightbox"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      aria-modal="true"
      aria-label={`Просмотр изображения ${currentIndex + 1} из ${images.length}`}
    >
      <div className="image-lightbox-container" ref={containerRef}>
        {/* Кнопка закрытия */}
        <button
          className="image-lightbox-close"
          onClick={handleClose}
          aria-label="Закрыть"
        >
          ×
        </button>

        {/* Навигационные кнопки */}
        {images.length > 1 && (
          <>
            <button
              className="image-lightbox-nav prev"
              onClick={handlePrev}
              disabled={currentIndex === 0}
              aria-label="Предыдущее изображение"
            >
              ‹
            </button>
            <button
              className="image-lightbox-nav next"
              onClick={handleNext}
              disabled={currentIndex === images.length - 1}
              aria-label="Следующее изображение"
            >
              ›
            </button>
          </>
        )}

        {/* Счетчик изображений */}
        {images.length > 1 && (
          <div className="image-lightbox-counter">
            {currentIndex + 1} / {images.length}
          </div>
        )}

        {/* Индикатор загрузки */}
        {isLoading && (
          <div className="image-lightbox-loading">
            Загрузка...
          </div>
        )}

        {/* Изображение */}
        <img
          ref={imageRef}
          src={currentImage.src}
          alt={currentImage.alt || currentImage.name || `Изображение ${currentIndex + 1}`}
          style={imageStyle}
          className={controls.scale > 1 ? 'zoomed' : ''}
          onClick={handleImageClick}
          onLoad={handleImageLoad}
          onError={handleImageError}
          onTouchStart={handleTouchStart}
          draggable={false}
        />
      </div>
    </dialog>,
    document.body
  );
}

export default ImageLightbox;
