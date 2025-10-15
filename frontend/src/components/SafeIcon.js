import React, { useRef, useEffect, useState } from 'react';
import { applyImageFilter, createIconFilter, supportsCSSFilters } from '../utils/safeFilters';

/**
 * Безопасный компонент иконки с CSS фильтрами
 * Автоматически обрабатывает ошибки и конфликты с расширениями браузера
 */
const SafeIcon = ({ 
  src, 
  alt = '', 
  className = '', 
  color = 'white', 
  size = 16,
  style = {},
  ...props 
}) => {
  const imgRef = useRef(null);
  const [filterApplied, setFilterApplied] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;

    // Проверяем поддержку CSS фильтров
    if (!supportsCSSFilters()) {
      console.warn('CSS фильтры не поддерживаются браузером');
      return;
    }

    // Применяем фильтр
    const filterValue = createIconFilter(color);
    const success = applyImageFilter(img, filterValue);
    
    setFilterApplied(success);
    
    if (!success) {
      console.warn('Не удалось применить CSS фильтр к иконке');
    }
  }, [color]);

  const handleError = (e) => {
    console.warn('Ошибка загрузки иконки:', e);
    setHasError(true);
  };

  const handleLoad = () => {
    setHasError(false);
  };

  const iconStyle = {
    width: size,
    height: size,
    ...style
  };

  const iconClassName = [
    className,
    !filterApplied && `icon-fallback-${color}`,
    hasError && 'icon-error'
  ].filter(Boolean).join(' ');

  return (
    <img
      ref={imgRef}
      src={src}
      alt={alt}
      className={iconClassName}
      style={iconStyle}
      onError={handleError}
      onLoad={handleLoad}
      {...props}
    />
  );
};

export default SafeIcon;
