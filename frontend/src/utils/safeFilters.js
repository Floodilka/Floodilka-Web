/**
 * Утилиты для безопасной работы с CSS фильтрами
 * Помогает избежать конфликтов с расширениями браузера
 */

/**
 * Проверяет, поддерживает ли браузер CSS фильтры
 */
export const supportsCSSFilters = () => {
  if (typeof window === 'undefined') return false;
  
  try {
    const testElement = document.createElement('div');
    const style = testElement.style;
    
    // Проверяем поддержку различных CSS фильтров
    const filters = [
      'filter',
      'WebkitFilter',
      'MozFilter',
      'msFilter'
    ];
    
    return filters.some(filter => filter in style);
  } catch (error) {
    console.warn('Ошибка проверки поддержки CSS фильтров:', error);
    return false;
  }
};

/**
 * Безопасно применяет CSS фильтр к элементу
 * @param {HTMLElement} element - DOM элемент
 * @param {string} filterValue - значение CSS фильтра
 * @param {string} fallbackClass - CSS класс для fallback
 */
export const applySafeFilter = (element, filterValue, fallbackClass = '') => {
  if (!element || !supportsCSSFilters()) {
    if (fallbackClass) {
      element.classList.add(fallbackClass);
    }
    return false;
  }

  try {
    element.style.filter = filterValue;
    return true;
  } catch (error) {
    console.warn('Ошибка применения CSS фильтра:', error);
    if (fallbackClass) {
      element.classList.add(fallbackClass);
    }
    return false;
  }
};

/**
 * Создает безопасный CSS фильтр для иконок
 * @param {string} color - цвет в hex формате
 * @returns {string} CSS фильтр
 */
export const createIconFilter = (color) => {
  // Базовые фильтры для разных цветов
  const colorFilters = {
    white: 'brightness(0) invert(1)',
    gray: 'brightness(0) invert(0.6)',
    red: 'brightness(0) saturate(100%) invert(35%) sepia(89%) saturate(2477%) hue-rotate(343deg) brightness(95%) contrast(95%)',
    blue: 'brightness(0) saturate(100%) invert(42%) sepia(93%) saturate(1352%) hue-rotate(223deg) brightness(97%) contrast(93%)',
    green: 'brightness(0) saturate(100%) invert(60%) sepia(6%) saturate(750%) hue-rotate(169deg) brightness(96%) contrast(89%)'
  };

  return colorFilters[color] || colorFilters.white;
};

/**
 * Применяет фильтр к изображению с обработкой ошибок
 * @param {HTMLImageElement} img - изображение
 * @param {string} filterValue - CSS фильтр
 */
export const applyImageFilter = (img, filterValue) => {
  if (!img || !supportsCSSFilters()) {
    return false;
  }

  try {
    img.style.filter = filterValue;
    
    // Проверяем, не вызвал ли фильтр ошибку
    const computedStyle = window.getComputedStyle(img);
    if (computedStyle.filter === 'none' && filterValue !== 'none') {
      console.warn('CSS фильтр не был применен, возможно заблокирован расширением');
      return false;
    }
    
    return true;
  } catch (error) {
    console.warn('Ошибка применения фильтра к изображению:', error);
    return false;
  }
};

/**
 * Создает CSS классы для fallback без фильтров
 */
export const createFallbackStyles = () => {
  const style = document.createElement('style');
  style.textContent = `
    /* Fallback стили для иконок без CSS фильтров */
    .icon-fallback-white {
      filter: none !important;
      opacity: 1;
    }
    
    .icon-fallback-gray {
      filter: none !important;
      opacity: 0.6;
    }
    
    .icon-fallback-red {
      filter: none !important;
      color: #f23f42 !important;
    }
    
    .icon-fallback-blue {
      filter: none !important;
      color: #5865f2 !important;
    }
    
    .icon-fallback-green {
      filter: none !important;
      color: #3ba55d !important;
    }
  `;
  
  document.head.appendChild(style);
};

// Инициализируем fallback стили при загрузке
if (typeof document !== 'undefined') {
  createFallbackStyles();
}
