# 🔧 Hotfix: Исправление загрузки аватаров

## Проблема
При загрузке аватаров в продакшене возникали ошибки:
- `GET /uploads/avatars/avatar-*.jpg 404 (Not Found)`
- `Uncaught SyntaxError: Unexpected end of JSON input`

## Причина
В конфигурации nginx отсутствовала настройка для проксирования запросов к `/uploads/` на backend сервер. Nginx пытался найти файлы аватаров в директории фронтенда и возвращал 404.

## Решение

### Шаг 1: Обновить код на сервере
```bash
ssh root@your-server

cd /var/www/floodilka
git pull
```

### Шаг 2: Обновить конфигурацию nginx
```bash
# Обновить nginx конфигурацию
sudo bash /var/www/floodilka/deployment/update-nginx.sh
```

Или вручную:
```bash
# Скопировать новую конфигурацию
sudo cp /var/www/floodilka/deployment/nginx-https.conf /etc/nginx/sites-available/floodilka

# Проверить конфигурацию
sudo nginx -t

# Перезагрузить nginx
sudo systemctl reload nginx
```

### Шаг 3: Проверить
1. Откройте https://floodilka.fitronyx.com
2. Зайдите в настройки пользователя
3. Загрузите новый аватар
4. Проверьте, что аватар отображается

## Что изменилось
В конфигурацию nginx добавлен новый блок `location /uploads/`:

```nginx
# Загруженные файлы (аватары)
location /uploads/ {
    proxy_pass http://localhost:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Этот блок проксирует все запросы к `/uploads/` на backend сервер (порт 3001), который раздаёт статические файлы через Express.

## Проверка статуса
```bash
# Проверить логи nginx
sudo tail -f /var/log/nginx/floodilka-error.log

# Проверить логи backend
sudo -u floodilka pm2 logs floodilka-backend
```

## Дополнительная информация
- Backend раздаёт статические файлы из директории `uploads/` через Express
- Nginx проксирует запросы к `/uploads/` на backend
- Размер загружаемых файлов ограничен 5MB (настройка в backend) и 50MB (настройка в nginx)

