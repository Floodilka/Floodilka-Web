import { useState, useCallback } from 'react';

/**
 * Хук для управления состоянием лайтбокса изображений
 * @returns {Object} Объект с состоянием и методами управления лайтбоксом
 */
export function useImageLightbox() {
  const [isOpen, setIsOpen] = useState(false);
  const [images, setImages] = useState([]);
  const [initialIndex, setInitialIndex] = useState(0);

  const openLightbox = useCallback((newImages, index) => {
    setImages(newImages);
    setInitialIndex(index);
    setIsOpen(true);
  }, []);

  const closeLightbox = useCallback(() => {
    setIsOpen(false);
    setImages([]);
    setInitialIndex(0);
  }, []);

  return {
    isOpen,
    images,
    initialIndex,
    openLightbox,
    closeLightbox
  };
}
