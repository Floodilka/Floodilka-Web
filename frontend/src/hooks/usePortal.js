import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Хук для рендера компонента в портал
 * @param {React.ReactNode} children - содержимое для рендера в портал
 * @param {string} containerId - ID контейнера (по умолчанию 'portal-root')
 * @returns {JSX.Element|null} JSX элемент для рендера в портал
 */
export function usePortal(children, containerId = 'portal-root') {
  const [container, setContainer] = useState(null);

  useEffect(() => {
    let element = document.getElementById(containerId);

    if (!element) {
      element = document.createElement('div');
      element.id = containerId;
      element.style.position = 'fixed';
      element.style.top = '0';
      element.style.left = '0';
      element.style.zIndex = '9999';
      element.style.pointerEvents = 'none';
      document.body.appendChild(element);
    }

    setContainer(element);

    return () => {
      // Не удаляем контейнер при размонтировании, так как он может использоваться другими компонентами
    };
  }, [containerId]);

  if (!container) return null;

  return createPortal(children, container);
}
