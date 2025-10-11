# Техническая SEO документация Floodilka

## Выполненная оптимизация

### 1. On-Page SEO ✅

#### HTML Meta теги
- **Title**: Уникальный, до 60 символов, содержит основные ключи
- **Description**: До 160 символов, привлекательное описание
- **Keywords**: Расширенный список целевых ключевых слов (скрыто от пользователей)
- **Language tags**: Правильная локализация
- **Geo targeting**: Настроен для России и СНГ
- **Canonical URL**: Защита от дублирования контента

#### Структурированные данные (Schema.org)
```json
{
  "@type": "SoftwareApplication",
  "name": "Floodilka",
  "description": "...",
  "aggregateRating": { ... },
  "offers": { ... },
  "featureList": [ ... ]
}
```

#### Open Graph Protocol
- Полная интеграция для Facebook/VK
- Twitter Cards (summary_large_image)
- Правильные размеры изображений (1200x630)

#### Robots & Crawlers
- Настроены правила для всех основных ботов
- Googlebot, Yandex, Bingbot — разрешен доступ
- Вредные боты заблокированы

### 2. Technical SEO ✅

#### Файловая структура
```
/frontend/public/
├── index.html          # Основной HTML с SEO тегами
├── manifest.json       # PWA манифест
├── robots.txt          # Правила для поисковых ботов
├── sitemap.xml         # Карта сайта
├── browserconfig.xml   # Конфигурация для IE/Edge
└── security.txt        # Контактная информация безопасности
```

#### Производительность
- Минификация CSS/JS в продакшене
- Compression: GZIP/Brotli (настроить на сервере)
- Image optimization: рекомендуется WebP
- Lazy loading: для изображений и компонентов

#### Mobile-First
- Responsive design
- `viewport` правильно настроен
- Touch-friendly интерфейс
- PWA поддержка

### 3. Целевые ключевые слова

#### Основные (высокая конкуренция)
```
- голосовой чат [месячный поиск: ~50,000]
- платформа для общения [~30,000]
- серверы для команд [~15,000]
```

#### Целевые (средняя конкуренция)
```
- русский дискорд [~20,000]
- аналог дискорда [~15,000]
- дискорд россия [~10,000]
- мессенджер для геймеров [~8,000]
```

#### Long-tail (низкая конкуренция)
```
- голосовой чат для команд россия
- бесплатная платформа для общения снг
- серверы для геймеров россии
- текстовый чат с голосовыми каналами
```

### 4. Стратегия контент-маркетинга

#### Создание контента
1. **Landing pages**
   - `/features` — Функции и возможности
   - `/pricing` — Тарифы (если будут)
   - `/about` — О проекте
   - `/compare` — Сравнение с конкурентами (без прямого упоминания)

2. **Блог** (для органического трафика)
   - Гайды по использованию
   - Новости платформы
   - Кейсы использования
   - Технические статьи

3. **FAQ страница**
   - Structured data для Google Rich Snippets
   - Ответы на популярные вопросы
   - Длинные ключевые фразы

#### Внутренняя перелинковка
```
Главная → Функции → Регистрация
   ↓
  Блог → Статьи → CTA (Призыв к действию)
   ↓
О нас → Сообщество
```

### 5. Off-Page SEO

#### Backlinks Strategy
**Целевые площадки:**

##### Технические порталы
- Habr.com — статья о разработке/запуске
- VC.ru — анонс и обновления
- Dev.to — технические детали

##### Геймерские ресурсы
- DTF — обзор для геймеров
- StopGame.ru — новость
- Cybersport.ru — анонс

##### Социальные сети
- VK — официальная группа
- Telegram — канал/чат
- YouTube — видео-гайды
- TikTok — короткие обзоры

##### Форумы и сообщества
- 4PDA — обзор приложения
- Pikabu — пост-презентация
- Reddit — r/russia, r/russian

#### Anchor текст для backlinks
```
Разнообразие важно:
- Точное совпадение: "платформа для общения" (20%)
- Частичное совпадение: "Floodilka — платформа для команд" (30%)
- Брендовые: "Floodilka", "на Floodilka" (40%)
- Натуральные: "перейти сюда", "посмотреть" (10%)
```

### 6. Локальное SEO (Яндекс)

#### Яндекс.Вебмастер
1. Добавить сайт
2. Подтвердить владение (HTML-файл или meta-тег)
3. Загрузить sitemap.xml
4. Настроить регион: Россия
5. Отслеживать индексацию

#### Яндекс.Метрика
```html
<!-- Установить счетчик -->
<script type="text/javascript">
   (function(m,e,t,r,i,k,a){
   m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
   // ... код метрики
   });
</script>
```

**Цели для отслеживания:**
- Регистрация
- Вход в систему
- Создание сервера
- Присоединение к серверу
- Первое голосовое подключение

### 7. Google Search Console

#### Настройка
1. Добавить property (Domain или URL prefix)
2. Верификация через DNS или HTML
3. Отправить sitemap.xml
4. Проверить Mobile Usability
5. Проверить Core Web Vitals

#### Метрики для мониторинга
- Impressions (показы в поиске)
- Clicks (клики)
- CTR (Click-Through Rate)
- Average position (средняя позиция)
- Coverage issues (проблемы индексации)

### 8. Технические требования к серверу

#### NGINX конфигурация (SEO-оптимизация)
```nginx
# GZIP Compression
gzip on;
gzip_vary on;
gzip_proxied any;
gzip_comp_level 6;
gzip_types text/plain text/css text/xml text/javascript
           application/json application/javascript application/xml+rss;

# Brotli Compression (если доступно)
brotli on;
brotli_comp_level 6;
brotli_types text/plain text/css application/json application/javascript;

# Cache headers
location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}

# Security headers (влияет на SEO)
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;

# HTTPS redirect (обязательно для SEO)
if ($scheme != "https") {
    return 301 https://$server_name$request_uri;
}

# www redirect (выбрать один вариант)
server {
    server_name www.floodilka.com;
    return 301 https://floodilka.com$request_uri;
}
```

#### SSL/TLS
- Обязательно HTTPS (Google ranking factor)
- Валидный SSL сертификат
- TLS 1.2+ минимум
- HTTP/2 или HTTP/3 для производительности

### 9. Page Speed Optimization

#### Целевые метрики (Core Web Vitals)
```
LCP (Largest Contentful Paint): < 2.5s
FID (First Input Delay): < 100ms
CLS (Cumulative Layout Shift): < 0.1
```

#### Чек-лист оптимизации
- [ ] Минификация HTML/CSS/JS
- [ ] Code splitting
- [ ] Tree shaking
- [ ] Image optimization (WebP, lazy loading)
- [ ] Font optimization (preload, subset)
- [ ] CDN для статических ресурсов
- [ ] Service Worker для кэширования
- [ ] HTTP/2 Server Push

#### Инструменты для проверки
- Google PageSpeed Insights
- GTmetrix
- WebPageTest
- Lighthouse (Chrome DevTools)

### 10. Мониторинг и аналитика

#### KPI для отслеживания
```
SEO Метрики:
- Органический трафик (уникальные посетители)
- Позиции по ключевым словам
- CTR в поиске
- Bounce rate (показатель отказов)
- Time on site (время на сайте)
- Pages per session

Конверсии:
- Регистрации / день
- Активные пользователи
- Retention rate
- Создание серверов
```

#### Инструменты
1. **Яндекс.Метрика** — основная аналитика для RU
2. **Google Analytics 4** — международная аналитика
3. **Яндекс.Вебмастер** — SEO для Яндекса
4. **Google Search Console** — SEO для Google
5. **Ahrefs / Semrush** — анализ конкурентов и backlinks

### 11. Competitor Analysis

#### Основные конкуренты (по трафику)
```
1. Discord (международный) — анализ функций
2. Telegram (голосовые чаты) — анализ маркетинга
3. TeamSpeak — анализ аудитории
4. Guilded — анализ позиционирования
```

#### Анализ
- Какие ключевые слова используют?
- Откуда получают backlinks?
- Какой контент создают?
- Как позиционируют продукт?

### 12. Международное SEO (если планируется)

#### Hreflang теги (уже добавлены)
```html
<link rel="alternate" hreflang="ru" href="https://floodilka.com/" />
<link rel="alternate" hreflang="en" href="https://floodilka.com/en" />
<link rel="alternate" hreflang="x-default" href="https://floodilka.com/" />
```

#### Мультиязычность
- `/` — русский (основной)
- `/en` — английский
- `/kk` — казахский (опционально для СНГ)
- `/uk` — украинский (опционально)

### 13. Schema Markup Extensions

#### Дополнительные типы для будущего
```json
{
  "@type": "Organization",
  "name": "Floodilka",
  "url": "https://floodilka.com",
  "logo": "https://floodilka.com/icons/logo.png",
  "sameAs": [
    "https://vk.com/floodilka",
    "https://t.me/floodilka"
  ]
}
```

```json
{
  "@type": "FAQPage",
  "mainEntity": [{
    "@type": "Question",
    "name": "Что такое Floodilka?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "..."
    }
  }]
}
```

### 14. Предотвращение SEO-проблем

#### Чего избегать
- ❌ Дублированный контент
- ❌ Тонкий контент (thin content)
- ❌ Keyword stuffing
- ❌ Скрытый текст
- ❌ Купленные ссылки низкого качества
- ❌ Автоматически генерированный контент
- ❌ Редиректы 302 вместо 301

#### Что делать
- ✅ Уникальный контент
- ✅ Регулярные обновления
- ✅ Естественная перелинковка
- ✅ Качественные backlinks
- ✅ Быстрая загрузка
- ✅ Mobile-friendly дизайн
- ✅ HTTPS везде

### 15. Roadmap (следующие шаги)

#### Неделя 1-2
- [ ] Регистрация в Яндекс.Вебмастер
- [ ] Регистрация в Google Search Console
- [ ] Установка Яндекс.Метрики и Google Analytics
- [ ] Верификация в Bing Webmaster Tools

#### Месяц 1
- [ ] Создание блога (минимум 10 SEO-статей)
- [ ] Оптимизация скорости загрузки
- [ ] Настройка CDN
- [ ] Получение первых 20 backlinks

#### Месяц 2-3
- [ ] Расширение блога (30+ статей)
- [ ] Создание видео-контента (YouTube)
- [ ] Активность в соцсетях
- [ ] Получение 50+ качественных backlinks

#### Месяц 4-6
- [ ] Запуск английской версии
- [ ] Международное продвижение
- [ ] Партнерские программы
- [ ] Достижение топ-10 по основным запросам

### 16. Контрольный список для запуска

```
SEO Readiness Checklist:

Technical SEO:
[✅] Title tags оптимизированы
[✅] Meta descriptions заполнены
[✅] Keywords добавлены
[✅] robots.txt создан
[✅] sitemap.xml создан и валиден
[✅] Canonical URLs настроены
[✅] Hreflang теги (для мультиязычности)
[✅] Schema markup добавлен
[✅] Open Graph теги настроены
[✅] Twitter Cards настроены
[✅] Favicon добавлен
[✅] 404 страница (нужно создать красивую)
[⏳] HTTPS настроен (проверить на проде)
[⏳] Redirects работают корректно
[⏳] Page speed > 80/100

Content:
[⏳] Уникальный контент на главной
[⏳] Блог создан
[⏳] FAQ страница
[⏳] О компании
[⏳] Контакты

Off-Page:
[⏳] Социальные сети созданы
[⏳] Google My Business (если применимо)
[⏳] Яндекс.Справочник
[⏳] Первые backlinks

Analytics:
[⏳] Google Analytics установлен
[⏳] Яндекс.Метрика установлена
[⏳] Search Console настроен
[⏳] Webmaster настроен
[⏳] Цели настроены
```

---

**Последнее обновление:** 11 октября 2025
**Версия:** 1.0
**Ответственный:** SEO Team

## Контакты

- Technical SEO: tech@floodilka.com
- Content Marketing: content@floodilka.com
- General: info@floodilka.com

