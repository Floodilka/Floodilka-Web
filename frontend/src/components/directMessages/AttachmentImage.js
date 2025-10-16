import React, { useRef, useLayoutEffect } from 'react';

function AttachmentImage({ src, alt, width, height, onImageClick, message, attachmentIndex }) {
  const wrapperRef = useRef(null);

  // Если бэкенд присылает размеры — используем их
  const haveMeta = width && height;
  const ar = haveMeta ? `${width} / ${height}` : undefined;

  // Проставляем CSS-переменную для aspect-ratio на wrapper
  useLayoutEffect(() => {
    if (wrapperRef.current && ar) {
      wrapperRef.current.style.setProperty('--ar', ar);
    }
  }, [ar]);

  const openLightbox = () => {
    if (onImageClick && message && message.attachments) {
      // Создаем массив изображений из вложений сообщения
      const images = message.attachments
        .filter(attachment => attachment.mimetype.startsWith('image/'))
        .map(attachment => ({
          src: `${window.location.hostname === 'localhost' ? 'http://localhost:3001' : `${window.location.protocol}//${window.location.hostname}`}${attachment.path}`,
          alt: attachment.originalName,
          width: attachment.width,
          height: attachment.height,
          name: attachment.originalName
        }));

      // Находим индекс текущего изображения среди всех изображений
      const imageIndex = message.attachments
        .filter(attachment => attachment.mimetype.startsWith('image/'))
        .findIndex(attachment => attachment.path === message.attachments[attachmentIndex].path);

      onImageClick(images, imageIndex);
    }
  };

  const onLoad = (e) => {
    if (wrapperRef.current) {
      wrapperRef.current.setAttribute('data-loaded', 'true');
      // полезно, если захочешь показать размеры на оверлее
      e.currentTarget.setAttribute('data-w', e.currentTarget.naturalWidth);
      e.currentTarget.setAttribute('data-h', e.currentTarget.naturalHeight);

      // Если размера не было — считаем его по natural* и устанавливаем аспект на wrapper
      if (!ar && wrapperRef.current) {
        const naturalAr = `${e.currentTarget.naturalWidth} / ${e.currentTarget.naturalHeight}`;
        wrapperRef.current.style.setProperty('--ar', naturalAr);
      }
    }
  };

  return (
    <div
      ref={wrapperRef}
      className="message-attachment-image-wrapper"
      data-loaded={Boolean(haveMeta)}
      onClick={openLightbox}
      style={ar ? {'--ar': ar} : undefined}
    >
      <img
        className="message-attachment-image"
        src={src}
        alt={alt || ""}
        loading="lazy"
        decoding="async"
        /* эти атрибуты помогают браузеру зарезервировать место ещё до CSS */
        width={width || undefined}
        height={height || undefined}
        onLoad={onLoad}
      />
    </div>
  );
}

export default AttachmentImage;