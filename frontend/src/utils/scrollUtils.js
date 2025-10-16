/**
 * Утилиты для работы со скроллом
 */

/**
 * Проверка, находится ли пользователь внизу контейнера
 * @param {HTMLElement} container - контейнер сообщений
 * @param {number} threshold - порог в пикселях
 * @returns {boolean} находится ли внизу
 */
export const isUserNearBottom = (container, threshold = 100) => {
  if (!container) return false;
  return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
};

/**
 * Плавный скролл вниз
 * @param {HTMLElement} container - контейнер сообщений
 * @param {boolean} smooth - плавный скролл
 * @param {boolean} prefersReducedMotion - предпочтение уменьшенной анимации
 */
export const scrollToBottom = (container, smooth = false, prefersReducedMotion = false) => {
  if (!container) return;

  const target = container.scrollHeight - container.clientHeight;

  if (smooth && !prefersReducedMotion) {
    container.scrollTo({ top: target, behavior: 'smooth' });
  } else {
    container.scrollTop = target;
  }

  // Страховка для не-плавного скролла
  if (!smooth) {
    setTimeout(() => {
      container.scrollTop = container.scrollHeight - container.clientHeight;
    }, 10);
  }
};

/**
 * Скролл к конкретному сообщению
 * @param {HTMLElement} container - контейнер сообщений
 * @param {string} messageId - ID сообщения
 * @param {boolean} prefersReducedMotion - предпочтение уменьшенной анимации
 */
export const scrollToMessageById = (container, messageId, prefersReducedMotion = false) => {
  if (!container || !messageId) return;

  const target = container.querySelector(`[data-message-id="${messageId}"]`);
  if (target) {
    target.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'center'
    });
  }
};
