/**
 * Глобальный обработчик ошибок для предотвращения сбоев приложения
 */

// Обработчик необработанных ошибок
window.addEventListener('error', (event) => {
  console.error('Глобальная ошибка:', event.error);
  
  // Игнорируем ошибки от расширений браузера
  if (event.filename && (
    event.filename.includes('css-procedural.js') ||
    event.filename.includes('ublock') ||
    event.filename.includes('adblock') ||
    event.filename.includes('extension')
  )) {
    console.warn('Игнорируем ошибку от расширения браузера:', event.filename);
    event.preventDefault();
    return;
  }
  
  // Игнорируем ошибки YouTube embed
  if (event.message && event.message.includes('ProceduralFiltererAPI')) {
    console.warn('Игнорируем ошибку ProceduralFiltererAPI (возможно от расширения)');
    event.preventDefault();
    return;
  }
  
  // Игнорируем ошибки блокировки запросов
  if (event.message && event.message.includes('ERR_BLOCKED_BY_CLIENT')) {
    console.warn('Игнорируем заблокированный запрос:', event.message);
    event.preventDefault();
    return;
  }
});

// Обработчик необработанных промисов
window.addEventListener('unhandledrejection', (event) => {
  console.error('Необработанное отклонение промиса:', event.reason);
  
  // Игнорируем ошибки от расширений
  if (event.reason && typeof event.reason === 'string') {
    if (event.reason.includes('ProceduralFiltererAPI') ||
        event.reason.includes('ERR_BLOCKED_BY_CLIENT') ||
        event.reason.includes('css-procedural')) {
      console.warn('Игнорируем ошибку от расширения:', event.reason);
      event.preventDefault();
      return;
    }
  }
  
  // Игнорируем ошибки YouTube
  if (event.reason && event.reason.message && 
      event.reason.message.includes('youtube.com')) {
    console.warn('Игнорируем ошибку YouTube:', event.reason.message);
    event.preventDefault();
    return;
  }
});

/**
 * Безопасное выполнение функции с обработкой ошибок
 * @param {Function} fn - функция для выполнения
 * @param {*} fallback - значение по умолчанию при ошибке
 * @returns {*} результат выполнения или fallback
 */
export const safeExecute = (fn, fallback = null) => {
  try {
    return fn();
  } catch (error) {
    console.warn('Ошибка в safeExecute:', error);
    return fallback;
  }
};

/**
 * Безопасное выполнение асинхронной функции
 * @param {Function} fn - асинхронная функция
 * @param {*} fallback - значение по умолчанию при ошибке
 * @returns {Promise} промис с результатом или fallback
 */
export const safeExecuteAsync = async (fn, fallback = null) => {
  try {
    return await fn();
  } catch (error) {
    console.warn('Ошибка в safeExecuteAsync:', error);
    return fallback;
  }
};

/**
 * Безопасная загрузка скрипта
 * @param {string} src - URL скрипта
 * @param {Object} options - опции загрузки
 * @returns {Promise} промис загрузки
 */
export const safeLoadScript = (src, options = {}) => {
  return new Promise((resolve, reject) => {
    // Проверяем, не загружен ли уже скрипт
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = options.async !== false;
    script.defer = options.defer || false;
    
    script.onload = () => resolve();
    script.onerror = (error) => {
      console.warn('Ошибка загрузки скрипта:', src, error);
      reject(error);
    };
    
    document.head.appendChild(script);
  });
};

/**
 * Безопасная загрузка CSS
 * @param {string} href - URL CSS файла
 * @returns {Promise} промис загрузки
 */
export const safeLoadCSS = (href) => {
  return new Promise((resolve, reject) => {
    // Проверяем, не загружен ли уже CSS
    if (document.querySelector(`link[href="${href}"]`)) {
      resolve();
      return;
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    
    link.onload = () => resolve();
    link.onerror = (error) => {
      console.warn('Ошибка загрузки CSS:', href, error);
      reject(error);
    };
    
    document.head.appendChild(link);
  });
};

/**
 * Дебаунс функция для предотвращения частых вызовов
 * @param {Function} func - функция для дебаунса
 * @param {number} wait - время ожидания в мс
 * @returns {Function} дебаунсированная функция
 */
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Тротлинг функция для ограничения частоты вызовов
 * @param {Function} func - функция для тротлинга
 * @param {number} limit - лимит вызовов в мс
 * @returns {Function} тротлированная функция
 */
export const throttle = (func, limit) => {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};
