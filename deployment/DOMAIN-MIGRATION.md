# 🔄 Миграция на новые домены floodilka.com и floodilka.ru

Это руководство описывает процесс миграции с `boltushka.fitronyx.com` на новые домены `floodilka.com` и `floodilka.ru`.

## 📋 Предварительные требования

### 1. Настройка DNS записей

**ВАЖНО:** Перед началом миграции убедитесь, что DNS записи настроены правильно!

📖 **Подробная инструкция:** См. [DNS-SETUP.md](./DNS-SETUP.md) для пошаговой настройки DNS у разных регистраторов.

Для **floodilka.com**:
```
A     @              159.89.110.44
A     www            159.89.110.44
```

Для **floodilka.ru**:
```
A     @              159.89.110.44
A     www            159.89.110.44
```

Проверьте DNS записи:
```bash
# Автоматическая проверка всех DNS записей
bash deployment/check-dns.sh

# Или вручную:
dig floodilka.com +short
dig www.floodilka.com +short
dig floodilka.ru +short
dig www.floodilka.ru +short
```

**Все должны возвращать ТОЛЬКО `159.89.110.44`**

⚠️ **Важно:** Если возвращается несколько IP адресов или не возвращается ничего - DNS настроен неправильно!

### 2. Подключение к серверу

```bash
ssh root@159.89.110.44
```

## 🚀 Автоматическая миграция (Рекомендуется)

Используйте готовый скрипт миграции:

```bash
cd /var/www/boltushka
sudo bash deployment/migrate-domains.sh
```

Скрипт автоматически выполнит:
1. ✅ Обновление Git репозитория
2. ✅ Создание бэкапа текущей конфигурации nginx
3. ✅ Установка новой конфигурации nginx для floodilka.com/ru
4. ✅ Настройка SSL сертификатов для обоих доменов
5. ✅ Обновление переменных окружения backend
6. ✅ Перезапуск всех сервисов

## 🛠️ Ручная миграция (Для продвинутых пользователей)

### Шаг 1: Обновление репозитория

```bash
cd /var/www/boltushka
git stash
git pull origin main
```

### Шаг 2: Бэкап старой конфигурации

```bash
sudo cp /etc/nginx/sites-available/boltushka /etc/nginx/sites-available/boltushka.backup
```

### Шаг 3: Установка новой конфигурации nginx

```bash
# Копируем новую конфигурацию
sudo cp /var/www/boltushka/deployment/nginx-https.conf /etc/nginx/sites-available/floodilka

# Удаляем старый симлинк
sudo rm /etc/nginx/sites-enabled/boltushka

# Создаем новый симлинк
sudo ln -s /etc/nginx/sites-available/floodilka /etc/nginx/sites-enabled/floodilka

# Проверяем конфигурацию
sudo nginx -t
```

### Шаг 4: Настройка SSL сертификатов

```bash
cd /var/www/boltushka/deployment
sudo bash setup-ssl.sh
```

Этот скрипт получит SSL сертификаты для:
- floodilka.com
- www.floodilka.com
- floodilka.ru
- www.floodilka.ru

### Шаг 5: Обновление переменных окружения backend

```bash
# Бэкап .env
sudo cp /var/www/boltushka/backend/.env /var/www/boltushka/backend/.env.backup

# Редактируем .env
sudo nano /var/www/boltushka/backend/.env
```

Измените:
```bash
FRONTEND_URL=https://boltushka.fitronyx.com
```

На:
```bash
FRONTEND_URL=https://floodilka.com
```

### Шаг 6: Перезапуск сервисов

```bash
# Перезапуск nginx
sudo systemctl restart nginx

# Перезапуск backend
sudo -u boltushka pm2 restart boltushka-backend

# Проверка статуса
sudo systemctl status nginx
sudo -u boltushka pm2 status
```

## ✅ Проверка работы

### 1. Проверка доступности сайтов

Откройте в браузере:
- https://floodilka.com
- https://www.floodilka.com (должно редиректить на floodilka.com)
- https://floodilka.ru
- https://www.floodilka.ru (должно редиректить на floodilka.ru)

### 2. Проверка SSL сертификатов

```bash
# Для .com
curl -I https://floodilka.com

# Для .ru
curl -I https://floodilka.ru
```

Оба должны возвращать `200 OK` и показывать действительные SSL сертификаты.

### 3. Проверка логов

```bash
# Логи backend
sudo -u boltushka pm2 logs boltushka-backend

# Логи nginx
sudo tail -f /var/log/nginx/floodilka-error.log
sudo tail -f /var/log/nginx/floodilka-ru-error.log
```

### 4. Проверка функциональности

- ✅ Авторизация работает
- ✅ Создание серверов работает
- ✅ Отправка сообщений работает
- ✅ Загрузка аватаров работает
- ✅ WebSocket соединение работает
- ✅ Голосовые каналы работают

## 🔧 Troubleshooting

### Ошибка SSL сертификата

Если certbot не может получить сертификат:

```bash
# Проверьте, что DNS записи корректны
dig floodilka.com +short

# Проверьте, что nginx слушает на порту 80
sudo netstat -tlnp | grep :80

# Попробуйте получить сертификат вручную
sudo certbot certonly --nginx -d floodilka.com -d www.floodilka.com
```

### Ошибка CORS

Если появляются ошибки CORS в консоли браузера:

```bash
# Проверьте FRONTEND_URL в .env
cat /var/www/boltushka/backend/.env | grep FRONTEND_URL

# Должно быть:
# FRONTEND_URL=https://floodilka.com
```

### 502 Bad Gateway

```bash
# Проверьте статус backend
sudo -u boltushka pm2 status

# Если не запущен, запустите:
sudo -u boltushka pm2 restart boltushka-backend

# Проверьте логи
sudo -u boltushka pm2 logs boltushka-backend
```

### WebSocket не подключается

```bash
# Проверьте nginx конфигурацию
sudo nginx -t

# Убедитесь, что секция socket.io/ есть в конфигурации
sudo cat /etc/nginx/sites-available/floodilka | grep -A 10 "socket.io"
```

## 🗑️ Очистка старых файлов (опционально)

После успешной миграции и проверки можете удалить старые файлы:

```bash
# Удаление старой конфигурации nginx
sudo rm /etc/nginx/sites-available/boltushka
sudo rm /etc/nginx/sites-available/boltushka.backup

# Удаление старых SSL сертификатов (опционально)
sudo certbot delete --cert-name boltushka.fitronyx.com
```

## 📊 Мониторинг после миграции

### Проверка логов в реальном времени

```bash
# Все логи backend
sudo -u boltushka pm2 logs

# Логи nginx для .com
sudo tail -f /var/log/nginx/floodilka-access.log

# Логи nginx для .ru
sudo tail -f /var/log/nginx/floodilka-ru-access.log
```

### Проверка автообновления SSL

```bash
# Статус таймера certbot
sudo systemctl status certbot.timer

# Список всех сертификатов
sudo certbot certificates

# Тест автообновления
sudo certbot renew --dry-run
```

## 🔐 Важные замечания

1. **Оба домена работают параллельно** - floodilka.com и floodilka.ru показывают одно и то же приложение
2. **www редиректится на основной домен** - www.floodilka.com → floodilka.com
3. **HTTP редиректится на HTTPS** - автоматически для безопасности
4. **SSL сертификаты обновляются автоматически** - через certbot timer
5. **Backend использует один FRONTEND_URL** - floodilka.com (основной домен)

## 📞 Поддержка

Если возникли проблемы:
1. Проверьте логи (см. раздел "Проверка логов")
2. Убедитесь, что DNS записи корректны
3. Проверьте статус всех сервисов
4. Если проблема не решается, можете откатиться к старой конфигурации:

```bash
# Восстановление старой конфигурации
sudo cp /etc/nginx/sites-available/boltushka.backup /etc/nginx/sites-available/boltushka
sudo ln -sf /etc/nginx/sites-available/boltushka /etc/nginx/sites-enabled/boltushka
sudo rm /etc/nginx/sites-enabled/floodilka
sudo systemctl restart nginx
```

## 🎉 Поздравляем!

Ваше приложение теперь доступно на новых доменах:
- 🌐 https://floodilka.com
- 🌐 https://floodilka.ru

