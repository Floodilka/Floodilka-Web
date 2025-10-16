import React, { useRef, useLayoutEffect } from 'react';

/**
 * Компонент для отображения изображений-вложений с плейсхолдером
 * Предотвращает прыжки скролла при загрузке изображений
 */
export default function AttachmentImage({
  src,
  alt = '',
  naturalWidth,
  naturalHeight,
  containerRef,       // ref на контейнер сообщений
  onKeepBottom,       // функция scrollToBottom
  className = 'message-attachment-image',
  onClick,
  onError,
  onLoad,
  variant = 'dm',     // 'dm' для DirectMessages, 'chat' для Chat
  maxSize = 350       // максимальный размер для Chat
}) {
  const wrapperRef = useRef(null);

  // Держим «якорь» у низа, если пользователь был внизу
  const handleLoad = (e) => {
    const c = containerRef?.current;
    if (!c) return;
    const atBottom = c.scrollHeight - (c.scrollTop + c.clientHeight) <= 2;
    if (atBottom) onKeepBottom?.();

    // Устанавливаем data-loaded="true" для shimmer эффекта
    if (wrapperRef.current) {
      wrapperRef.current.setAttribute('data-loaded', 'true');
    }

    // Вызываем пользовательский onLoad
    if (onLoad) onLoad(e);
  };

  // Соотношение сторон: лучше всего из метаданных
  const aspectRatio =
    naturalWidth && naturalHeight ? `${naturalWidth} / ${naturalHeight}` : '4 / 3';

  // Стили в зависимости от варианта
  const wrapperStyle = variant === 'chat'
    ? {
        width: `${maxSize}px`,
        height: `${maxSize}px`,
        aspectRatio: '1 / 1' // квадрат для Chat
      }
    : {
        aspectRatio,
        maxWidth: 'min(420px, 70%)',
        width: '100%'
      };

  const wrapperClassName = variant === 'chat'
    ? 'message-attachment-image-wrapper'
    : 'message-attachment';

  return (
    <div
      className={wrapperClassName}
      style={wrapperStyle}
      ref={wrapperRef}
      data-loaded="false"
    >
      <img
        className={className}
        src={src}
        alt={alt}
        width={naturalWidth}     // резервирует место ещё до загрузки
        height={naturalHeight}
        loading="lazy"
        onClick={onClick}
        onError={onError}
        onLoad={handleLoad}
      />
    </div>
  );
}
