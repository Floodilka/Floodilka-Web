/**
 * @typedef {Object} LightboxImage
 * @property {string} src - URL изображения
 * @property {string} [alt] - Альтернативный текст
 * @property {number} [width] - Ширина изображения
 * @property {number} [height] - Высота изображения
 * @property {string} [name] - Имя файла
 */

/**
 * @typedef {Object} ImageLightboxProps
 * @property {LightboxImage[]} images - Массив изображений
 * @property {number} initialIndex - Индекс начального изображения
 * @property {() => void} onClose - Колбэк закрытия
 */

/**
 * @typedef {Object} LightboxControls
 * @property {number} scale - Масштаб изображения
 * @property {number} translateX - Смещение по X
 * @property {number} translateY - Смещение по Y
 * @property {boolean} isDragging - Флаг перетаскивания
 * @property {{x: number, y: number}} dragStart - Начальная позиция перетаскивания
 * @property {{x: number, y: number}} lastPan - Последняя позиция панорамирования
 */

/**
 * @typedef {Object} LightboxState
 * @property {number} currentIndex - Текущий индекс изображения
 * @property {LightboxControls} controls - Управление лайтбоксом
 * @property {boolean} isOpen - Флаг открытия
 * @property {boolean} isAnimating - Флаг анимации
 */

// Экспортируем пустой объект для совместимости с ES6 модулями
export {};
