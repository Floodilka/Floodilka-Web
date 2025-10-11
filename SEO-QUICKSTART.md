# SEO Quick Start Guide — Floodilka

## Быстрый старт после деплоя

### Шаг 1: Проверка базовых файлов (5 минут)

После деплоя проверьте доступность SEO-файлов:

```bash
# Проверка основных SEO файлов
curl -I https://floodilka.com/robots.txt
curl -I https://floodilka.com/sitemap.xml
curl -I https://floodilka.com/manifest.json
```

Все должны возвращать `200 OK`.

### Шаг 2: Регистрация в Яндекс.Вебмастер (15 минут)

1. **Перейдите:** https://webmaster.yandex.ru
2. **Нажмите:** "Добавить сайт"
3. **Введите:** `https://floodilka.com`
4. **Подтверждение владения (выберите один способ):**

   **Вариант A: Meta-тег (рекомендуется)**
   - Скопируйте предложенный meta-тег
   - Добавьте в `<head>` в `index.html`:
   ```html
   <meta name="yandex-verification" content="ВАSH_КОД" />
   ```
   - Сделайте билд и деплой
   - Нажмите "Проверить"

   **Вариант B: HTML-файл**
   - Скачайте файл верификации
   - Переименуйте/замените `yandex_verification.html`
   - Загрузите на сервер
   - Нажмите "Проверить"

5. **После подтверждения:**
   - Перейдите в "Индексирование" → "Загрузить файл Sitemap"
   - Укажите: `https://floodilka.com/sitemap.xml`
   - Настройте регион: "Россия"

### Шаг 3: Регистрация в Google Search Console (15 минут)

1. **Перейдите:** https://search.google.com/search-console
2. **Выберите:** "URL prefix" → `https://floodilka.com`
3. **Подтверждение владения (выберите один способ):**

   **Вариант A: HTML-тег (рекомендуется)**
   - Скопируйте meta-тег
   - Добавьте в `<head>` в `index.html`:
   ```html
   <meta name="google-site-verification" content="ВАSH_КОД" />
   ```
   - Билд и деплой
   - Нажмите "Verify"

   **Вариант B: HTML-файл**
   - Скачайте файл (например, `google1234567890abcdef.html`)
   - Загрузите в `/frontend/public/`
   - Билд и деплой
   - Нажмите "Verify"

4. **После подтверждения:**
   - Перейдите в "Sitemaps"
   - Добавьте: `sitemap.xml`
   - Нажмите "Submit"

### Шаг 4: Установка аналитики (20 минут)

#### Яндекс.Метрика

1. **Перейдите:** https://metrika.yandex.ru
2. **Создайте счетчик** для `floodilka.com`
3. **Скопируйте код счетчика**
4. **Добавьте в `index.html` перед `</head>`:**

```html
<!-- Яндекс.Метрика -->
<script type="text/javascript">
   (function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
   m[i].l=1*new Date();
   for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
   k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
   (window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");

   ym(ВАSH_ID, "init", {
        clickmap:true,
        trackLinks:true,
        accurateTrackBounce:true,
        webvisor:true,
        trackHash:true
   });
</script>
<noscript><div><img src="https://mc.yandex.ru/watch/ВАSH_ID" style="position:absolute; left:-9999px;" alt="" /></div></noscript>
```

5. **Настройте цели:**
   - Регистрация (URL содержит `/register`)
   - Вход (URL содержит `/login`)
   - Создание сервера (событие)

#### Google Analytics 4

1. **Перейдите:** https://analytics.google.com
2. **Создайте property** для Floodilka
3. **Создайте Web Stream**
4. **Скопируйте Measurement ID** (формат: `G-XXXXXXXXXX`)
5. **Добавьте в `index.html` перед `</head>`:**

```html
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX', {
    'send_page_view': true,
    'page_title': document.title,
    'page_location': window.location.href
  });
</script>
```

### Шаг 5: Проверка SEO (10 минут)

Проверьте техническое SEO с помощью инструментов:

#### Online инструменты

1. **Google PageSpeed Insights**
   - https://pagespeed.web.dev
   - Введите: `https://floodilka.com`
   - Цель: > 80 баллов для Mobile и Desktop

2. **SEO-анализ**
   - https://www.seobility.net/en/seocheck/
   - Проверьте все основные параметры

3. **Structured Data Testing**
   - https://validator.schema.org/
   - Проверьте JSON-LD разметку

4. **Open Graph проверка**
   - https://www.opengraph.xyz/
   - Проверьте как сайт отображается в соцсетях

#### Ручная проверка

```bash
# Проверка title и meta
curl -s https://floodilka.com | grep -i "<title>"
curl -s https://floodilka.com | grep -i "meta name=\"description\""

# Проверка canonical
curl -s https://floodilka.com | grep -i "canonical"

# Проверка robots.txt
curl https://floodilka.com/robots.txt

# Проверка sitemap.xml
curl https://floodilka.com/sitemap.xml
```

### Шаг 6: Настройка NGINX для SEO (опционально)

Если используете NGINX, добавьте SEO-оптимизации:

```nginx
# В конфиг /etc/nginx/sites-available/floodilka

server {
    listen 443 ssl http2;
    server_name floodilka.com;

    # SSL конфигурация
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # GZIP сжатие
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript
               application/json application/javascript application/xml+rss;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Cache для статики
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Основная конфигурация
    location / {
        root /var/www/floodilka/frontend/build;
        try_files $uri $uri/ /index.html;
    }

    # 404 страница
    error_page 404 /404.html;
    location = /404.html {
        root /var/www/floodilka/frontend/build;
        internal;
    }
}

# Redirect www to non-www
server {
    listen 443 ssl http2;
    server_name www.floodilka.com;
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    return 301 https://floodilka.com$request_uri;
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name floodilka.com www.floodilka.com;
    return 301 https://floodilka.com$request_uri;
}
```

После изменений:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

### Шаг 7: Первый контент (начните сразу)

Создайте первый контент для SEO:

1. **Страница "О проекте"** (`/about`)
   - История создания
   - Миссия и ценности
   - Команда

2. **Страница "Функции"** (`/features`)
   - Голосовые каналы
   - Текстовые чаты
   - Серверы и права
   - Безопасность

3. **FAQ страница** (`/faq`)
   - Как зарегистрироваться?
   - Как создать сервер?
   - Бесплатно ли это?
   - Доступно ли на мобильных?

### Шаг 8: Социальные сети (в течение недели)

Создайте присутствие в соцсетях:

1. **VKontakte**
   - Создайте группу: vk.com/floodilka
   - Заполните описание с ключевыми словами
   - Добавьте ссылку на сайт

2. **Telegram**
   - Создайте канал: @floodilka
   - Создайте чат для комьюнити: @floodilka_chat
   - Регулярные обновления

3. **YouTube**
   - Создайте канал
   - Загрузите первые видео-гайды
   - SEO оптимизация названий и описаний

### Чек-лист запуска

После выполнения всех шагов проверьте:

```
✅ Сайт доступен по HTTPS
✅ robots.txt доступен и правильный
✅ sitemap.xml доступен и валиден
✅ Яндекс.Вебмастер настроен
✅ Google Search Console настроен
✅ Яндекс.Метрика установлена
✅ Google Analytics установлена
✅ Title и description оптимизированы
✅ Open Graph теги работают
✅ Structured data валидна
✅ PageSpeed > 80 баллов
✅ 404 страница работает
✅ Мобильная версия оптимизирована
✅ Социальные сети созданы
```

## Ежедневные задачи

### Первая неделя
- Проверяйте индексацию в вебмастерах (1 раз в день)
- Мониторьте ошибки в Search Console
- Публикуйте в социальных сетях (1-2 поста в день)

### Первый месяц
- Создавайте контент для блога (2-3 статьи в неделю)
- Работайте над backlinks (5-10 новых в неделю)
- Анализируйте поведение пользователей в метрике
- Оптимизируйте на основе данных

## Получение помощи

Если возникли проблемы:

1. **Документация**
   - `TECHNICAL-SEO.md` — полная техническая документация
   - `SEO-GUIDE.md` — общее руководство по SEO

2. **Инструменты проверки**
   - Яндекс.Вебмастер — проблемы индексации
   - Google Search Console — ошибки crawling
   - PageSpeed Insights — проблемы производительности

3. **Сообщества**
   - Habr Q&A
   - Stack Overflow
   - Reddit r/SEO

---

**Время выполнения:** ~1 час
**Сложность:** Начальный уровень
**Результат:** Полностью настроенное SEO для Floodilka

**Следующий шаг:** Начните создавать контент и получать backlinks!

