# 🚀 Инструкция по деплою Boltushka на DigitalOcean Droplet

## Вариант 1: БЕЗ домена (только для тестирования!)

⚠️ **ВАЖНО:** Без домена и HTTPS:
- WebRTC может не работать
- Браузеры блокируют доступ к микрофону
- Подходит только для локального тестирования

### Шаги:

1. **Подключитесь к серверу:**
```bash
ssh root@YOUR_DROPLET_IP
```

2. **Скопируйте проект на сервер:**
```bash
# На локальной машине:
cd /Users/eldar.tengizov/Desktop/Workspace/Boltushka
rsync -avz --exclude 'node_modules' --exclude '.git' \
  ./ root@YOUR_DROPLET_IP:/var/www/boltushka/
```

3. **На сервере запустите установку:**
```bash
cd /var/www/boltushka/deployment
chmod +x *.sh
sudo bash setup.sh
```

4. **Разверните backend:**
```bash
sudo bash deploy-backend.sh
```

5. **Обновите URL в frontend:**
```bash
nano /var/www/boltushka/frontend/src/App.js
# Замените:
# const BACKEND_URL = 'http://localhost:3001';
# На:
# const BACKEND_URL = 'http://YOUR_DROPLET_IP:3001';
```

6. **Разверните frontend:**
```bash
sudo bash deploy-frontend.sh
```

7. **Настройте Nginx:**
```bash
sudo cp /var/www/boltushka/deployment/nginx-http.conf /etc/nginx/sites-available/boltushka
sudo ln -s /etc/nginx/sites-available/boltushka /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default  # Удалить дефолтный конфиг
sudo nginx -t
sudo systemctl restart nginx
```

8. **Настройте firewall:**
```bash
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 3001/tcp    # Backend (временно)
sudo ufw enable
```

9. **Проверка:**
```bash
pm2 status
pm2 logs boltushka-backend
```

Откройте в браузере: `http://YOUR_DROPLET_IP`

---

## Вариант 2: С доменом (РЕКОМЕНДУЕТСЯ!) ⭐

### Требования:
- Домен (можно купить на Namecheap, GoDaddy и т.д.)
- A-запись домена указывает на IP вашего droplet

### Шаги:

1. **Настройте DNS:**
```
A запись:  your-domain.com        -> YOUR_DROPLET_IP
A запись:  www.your-domain.com    -> YOUR_DROPLET_IP
```
Подождите 5-10 минут для распространения DNS.

2. **Подключитесь к серверу и скопируйте проект:**
```bash
ssh root@YOUR_DROPLET_IP

# На локальной машине скопируйте проект:
rsync -avz --exclude 'node_modules' --exclude '.git' \
  /Users/eldar.tengizov/Desktop/Workspace/Boltushka/ \
  root@YOUR_DROPLET_IP:/var/www/boltushka/
```

3. **На сервере запустите установку:**
```bash
cd /var/www/boltushka/deployment
chmod +x *.sh
sudo bash setup.sh
```

4. **Разверните backend:**
```bash
sudo bash deploy-backend.sh
```

5. **Обновите URL в frontend:**
```bash
nano /var/www/boltushka/frontend/src/App.js
# Замените:
# const BACKEND_URL = 'http://localhost:3001';
# На:
# const BACKEND_URL = 'https://your-domain.com';  # или http:// если SSL еще не настроен
```

6. **Обновите CORS в backend:**
```bash
nano /var/www/boltushka/backend/server.js
# Найдите:
# origin: "http://localhost:3000"
# Замените на:
# origin: "https://your-domain.com"
```

7. **Разверните frontend:**
```bash
sudo bash deploy-frontend.sh
```

8. **Настройте Nginx (пока без SSL):**
```bash
sudo nano /var/www/boltushka/deployment/nginx-https.conf
# Замените your-domain.com на ваш домен
# Закомментируйте SSL строки (строки с ssl_certificate)

sudo cp /var/www/boltushka/deployment/nginx-https.conf /etc/nginx/sites-available/boltushka
sudo ln -s /etc/nginx/sites-available/boltushka /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

9. **Настройте SSL (Let's Encrypt):**
```bash
# Отредактируйте скрипт с вашими данными:
sudo nano /var/www/boltushka/deployment/setup-ssl.sh
# Укажите DOMAIN и EMAIL

# Запустите:
sudo bash /var/www/boltushka/deployment/setup-ssl.sh
```

10. **Обновите конфиг Nginx для SSL:**
```bash
# Раскомментируйте SSL строки в конфиге
sudo nano /etc/nginx/sites-available/boltushka
sudo nginx -t
sudo systemctl restart nginx
```

11. **Обновите BACKEND_URL в frontend на HTTPS:**
```bash
nano /var/www/boltushka/frontend/src/App.js
# const BACKEND_URL = 'https://your-domain.com';

# Пересоберите frontend:
cd /var/www/boltushka/deployment
sudo bash deploy-frontend.sh
```

12. **Настройте firewall:**
```bash
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
sudo ufw enable
```

13. **Перезапустите backend с новыми настройками:**
```bash
pm2 restart boltushka-backend
pm2 save
```

14. **Проверка:**
```bash
pm2 status
pm2 logs boltushka-backend
sudo systemctl status nginx
```

Откройте в браузере: `https://your-domain.com` 🎉

---

## Полезные команды

### Управление backend:
```bash
pm2 status                          # Статус
pm2 logs boltushka-backend          # Логи
pm2 restart boltushka-backend       # Перезапуск
pm2 stop boltushka-backend          # Остановка
pm2 start boltushka-backend         # Запуск
pm2 monit                           # Мониторинг
```

### Управление Nginx:
```bash
sudo nginx -t                       # Проверка конфигурации
sudo systemctl restart nginx        # Перезапуск
sudo systemctl status nginx         # Статус
tail -f /var/log/nginx/boltushka-error.log   # Логи ошибок
tail -f /var/log/nginx/boltushka-access.log  # Логи доступа
```

### Обновление приложения:
```bash
# На локальной машине:
rsync -avz --exclude 'node_modules' --exclude '.git' \
  /Users/eldar.tengizov/Desktop/Workspace/Boltushka/ \
  root@YOUR_DROPLET_IP:/var/www/boltushka/

# На сервере:
cd /var/www/boltushka/deployment
sudo bash deploy-backend.sh
sudo bash deploy-frontend.sh
```

### Просмотр логов:
```bash
# Backend логи:
pm2 logs boltushka-backend --lines 100

# Nginx логи:
tail -n 100 /var/log/nginx/boltushka-error.log

# System логи:
journalctl -u nginx -n 50
```

---

## Оптимизация производительности

### PM2 кластер (для высокой нагрузки):
```bash
pm2 start server.js -i max --name boltushka-backend
```

### Увеличение лимитов для Socket.IO:
```bash
# В /etc/security/limits.conf добавить:
* soft nofile 65536
* hard nofile 65536
```

### Мониторинг:
```bash
# Установить PM2 Plus для мониторинга
pm2 link YOUR_PUBLIC_KEY YOUR_SECRET_KEY
```

---

## Решение проблем

### Backend не запускается:
```bash
pm2 logs boltushka-backend
# Проверьте порт 3001 свободен:
lsof -i :3001
```

### Nginx ошибки:
```bash
sudo nginx -t
tail -f /var/log/nginx/error.log
```

### Socket.IO не подключается:
```bash
# Проверьте CORS настройки в backend/server.js
# Проверьте firewall:
sudo ufw status
```

### WebRTC не работает:
- Убедитесь что используете HTTPS (обязательно для production)
- Проверьте что домен правильно настроен
- Откройте консоль браузера для ошибок

---

## 🎉 Готово!

После успешного деплоя ваше приложение будет доступно по адресу:
- **С доменом:** https://your-domain.com
- **Без домена:** http://YOUR_DROPLET_IP (только для теста)

**Рекомендую вариант с доменом для полной функциональности WebRTC!**

