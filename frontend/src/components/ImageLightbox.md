# ImageLightbox

Компонент лайтбокса для просмотра изображений в стиле Discord с поддержкой зума, панорамирования и навигации.

## Функции

### 🖱️ Мышь
- **Клик по изображению** - открыть лайтбокс
- **Клик по фону/крестику** - закрыть
- **Колесо мыши** - зум к курсору (1.0x - 4.0x)
- **Двойной клик** - переключение зума 1.0x ↔ 2.0x
- **Перетаскивание** - панорамирование при зуме > 1.0x

### ⌨️ Клавиатура
- **ESC** - закрыть лайтбокс
- **←/→** - навигация между изображениями
- **Enter/Space** - следующее изображение

### 📱 Тач-устройства
- **Пинч-зум** - зум двумя пальцами
- **Свайп влево/вправо** - навигация между изображениями (только при зуме 1.0x)
- **Перетаскивание** - панорамирование при зуме > 1.0x

### ♿ Доступность
- **role="dialog"** и **aria-modal="true"**
- **aria-label** для всех интерактивных элементов
- **Фокус-ловушка** внутри лайтбокса
- **Возврат фокуса** при закрытии

### 🎨 Анимации
- **Плавные переходы** для всех элементов
- **Поддержка prefers-reduced-motion**
- **Анимация появления** лайтбокса
- **Масштабирование** изображения

## Использование

```tsx
import ImageLightbox from './ImageLightbox';
import { LightboxImage } from '../types/lightbox';

const images: LightboxImage[] = [
  {
    src: 'https://example.com/image1.jpg',
    alt: 'Изображение 1',
    width: 800,
    height: 600,
    name: 'image1.jpg'
  },
  // ... другие изображения
];

function MyComponent() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  return (
    <>
      {/* Ваши миниатюры */}
      <img
        src={images[0].src}
        onClick={() => {
          setCurrentIndex(0);
          setIsOpen(true);
        }}
      />

      {/* Лайтбокс */}
      {isOpen && (
        <ImageLightbox
          images={images}
          initialIndex={currentIndex}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
```

## API

### ImageLightboxProps

```typescript
interface ImageLightboxProps {
  images: LightboxImage[];      // Массив изображений
  initialIndex: number;         // Индекс начального изображения
  onClose: () => void;          // Колбэк закрытия
}
```

### LightboxImage

```typescript
interface LightboxImage {
  src: string;                  // URL изображения
  alt?: string;                 // Альтернативный текст
  width?: number;               // Ширина (для предзагрузки)
  height?: number;              // Высота (для предзагрузки)
  name?: string;                // Имя файла
}
```

## Интеграция

Компонент уже интегрирован в:
- `Chat.js` - основной чат серверов
- `DirectMessages.js` - личные сообщения

Обработчик `onImageClick` передается через цепочку:
`Chat/DirectMessages` → `MessagesList` → `MessageGroup` → `Message` → `AttachmentImage`

## Стили

Использует CSS классы:
- `.image-lightbox` - основной контейнер
- `.image-lightbox-container` - контейнер изображения
- `.image-lightbox-nav` - навигационные кнопки
- `.image-lightbox-close` - кнопка закрытия
- `.image-lightbox-counter` - счетчик изображений

Все стили определены в `Chat.css` и поддерживают темную тему.
