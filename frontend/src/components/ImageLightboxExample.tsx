import React, { useState } from 'react';
import ImageLightbox from './ImageLightbox';
import { LightboxImage } from '../types/lightbox';

/**
 * Пример использования ImageLightbox
 */
export function ImageLightboxExample() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Тестовые изображения
  const testImages: LightboxImage[] = [
    {
      src: 'https://picsum.photos/800/600?random=1',
      alt: 'Тестовое изображение 1',
      width: 800,
      height: 600,
      name: 'image1.jpg'
    },
    {
      src: 'https://picsum.photos/600/800?random=2',
      alt: 'Тестовое изображение 2',
      width: 600,
      height: 800,
      name: 'image2.jpg'
    },
    {
      src: 'https://picsum.photos/1000/500?random=3',
      alt: 'Тестовое изображение 3',
      width: 1000,
      height: 500,
      name: 'image3.jpg'
    }
  ];

  const openLightbox = (index: number) => {
    setCurrentIndex(index);
    setIsOpen(true);
  };

  const closeLightbox = () => {
    setIsOpen(false);
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Пример ImageLightbox</h2>
      <p>Нажмите на изображение, чтобы открыть лайтбокс:</p>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {testImages.map((image, index) => (
          <div
            key={index}
            style={{
              width: '200px',
              height: '150px',
              cursor: 'pointer',
              borderRadius: '8px',
              overflow: 'hidden',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}
            onClick={() => openLightbox(index)}
          >
            <img
              src={image.src}
              alt={image.alt}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
            />
          </div>
        ))}
      </div>

      <div style={{ marginTop: '20px' }}>
        <h3>Функции лайтбокса:</h3>
        <ul>
          <li>🖱️ <strong>Клик по изображению</strong> - открыть лайтбокс</li>
          <li>🖱️ <strong>Клик по фону/крестику</strong> - закрыть</li>
          <li>⌨️ <strong>ESC</strong> - закрыть</li>
          <li>⌨️ <strong>←/→</strong> - навигация между изображениями</li>
          <li>⌨️ <strong>Enter/Space</strong> - следующее изображение</li>
          <li>🖱️ <strong>Колесо мыши</strong> - зум к курсору</li>
          <li>🖱️ <strong>Двойной клик</strong> - переключение зума 1x ↔ 2x</li>
          <li>🖱️ <strong>Перетаскивание</strong> - панорамирование при зуме</li>
          <li>📱 <strong>Пинч-зум</strong> - зум на мобильных</li>
          <li>📱 <strong>Свайп</strong> - навигация на мобильных</li>
        </ul>
      </div>

      {/* Лайтбокс */}
      {isOpen && (
        <ImageLightbox
          images={testImages}
          initialIndex={currentIndex}
          onClose={closeLightbox}
        />
      )}
    </div>
  );
}

export default ImageLightboxExample;
