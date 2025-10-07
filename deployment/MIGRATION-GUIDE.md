# 🚀 Руководство по миграции Boltushka на российский хостинг

## Проблема
Digital Ocean блокирует доступ из России, поэтому нужно перенести сервер на российский хостинг-провайдер.

## 🎯 Рекомендуемые российские хостинг-провайдеры

### VPS/Cloud серверы (рекомендуется)
1. **Timeweb Cloud** ⭐
   - Цена: от 300₽/месяц
   - Сайт: cloud.timeweb.com
   - Плюсы: популярный, работает с Россией, хорошая поддержка

2. **Selectel** ⭐
   - Цена: от 400₽/месяц
   - Сайт: selectel.ru
   - Плюсы: надежный, дата-центры в России

3. **REG.RU**
   - Цена: от 350₽/месяц
   - Сайт: reg.ru
   - Плюсы: крупный провайдер, поддержка на русском

4. **FirstVDS**
   - Цена: от 200₽/месяц
   - Сайт: firstvds.ru
   - Плюсы: недорогие VPS

5. **Beget**
   - Цена: от 150₽/месяц
   - Сайт: beget.com
   - Плюсы: простой в настройке

### Облачные платформы
- **Yandex Cloud** - российский аналог AWS
- **VK Cloud** (бывший Mail.ru Cloud)

## 📋 Минимальные требования к серверу
- **RAM**: 1GB (рекомендуется 2GB)
- **CPU**: 1 ядро
- **Диск**: 20GB SSD
- **ОС**: Ubuntu 20.04/22.04 LTS
- **Сеть**: статический IP

## 🔄 План миграции

### Этап 1: Подготовка нового сервера

1. **Зарегистрируйтесь у провайдера** (рекомендую Timeweb Cloud)
2. **Создайте VPS сервер** с Ubuntu 22.04 LTS
3. **Настройте SSH ключи** для безопасного подключения
4. **Запомните IP адрес** нового сервера

### Этап 2: Миграция данных

#### На старом сервере (Digital Ocean):

```bash
# 1. Подключитесь к старому серверу
ssh root@159.89.110.44

# 2. Перейдите в директорию проекта
cd /var/www/boltushka

# 3. Отредактируйте скрипт миграции
nano deployment/migrate-to-new-server.sh

# 4. Замените NEW_SERVER_IP на IP нового сервера
# NEW_SERVER_IP="YOUR_NEW_IP"

# 5. Запустите миграцию
bash deployment/migrate-to-new-server.sh
```

#### На новом сервере:

```bash
# 1. Подключитесь к новому серверу
ssh root@YOUR_NEW_IP

# 2. Установите базовое ПО
sudo bash /var/www/boltushka/deployment/setup.sh

# 3. Установите MongoDB
sudo bash /var/www/boltushka/deployment/setup-mongodb.sh

# 4. Распакуйте данные
cd /var/www/boltushka
tar -xzf /tmp/boltushka-migration-backup.tar.gz

# 5. Восстановите MongoDB
mongorestore --db boltushka backup/mongodb/boltushka

# 6. Восстановите загруженные файлы
cp -r backup/uploads/* backend/uploads/ 2>/dev/null || true

# 7. Восстановите .env файл
cp backup/.env backend/.env

# 8. Настройте production окружение
sudo bash deployment/setup-production.sh
```

### Этап 3: Настройка nginx

```bash
# 1. Скопируйте конфигурацию nginx
sudo cp deployment/nginx-http.conf /etc/nginx/sites-available/boltushka

# 2. Отредактируйте конфигурацию
sudo nano /etc/nginx/sites-available/boltushka

# 3. Замените server_name _; на ваш IP:
server_name YOUR_NEW_IP;

# 4. Активируйте конфигурацию
sudo ln -sf /etc/nginx/sites-available/boltushka /etc/nginx/sites-enabled/

# 5. Удалите дефолтную конфигурацию
sudo rm -f /etc/nginx/sites-enabled/default

# 6. Проверьте конфигурацию
sudo nginx -t

# 7. Перезапустите nginx
sudo systemctl restart nginx
```

### Этап 4: Деплой приложения

```bash
# 1. Деплой приложения
sudo bash deployment/update.sh

# 2. Проверьте статус сервисов
sudo -u boltushka pm2 status
sudo systemctl status nginx
sudo systemctl status mongod

# 3. Протестируйте работу
curl http://YOUR_NEW_IP
```

### Этап 5: Настройка домена (опционально)

Если у вас есть домен:

```bash
# 1. Настройте DNS запись
# A запись: your-domain.ru -> YOUR_NEW_IP

# 2. Обновите nginx конфигурацию
sudo nano /etc/nginx/sites-available/boltushka
# server_name your-domain.ru;

# 3. Перезапустите nginx
sudo systemctl restart nginx

# 4. Настройте SSL (опционально)
sudo bash deployment/setup-ssl.sh
```

## 🔧 Обновление клиентских приложений

После миграции нужно обновить frontend, чтобы он подключался к новому серверу:

### Если используете IP адрес:
```javascript
// В frontend/src/App.js найдите и замените:
const API_URL = 'http://YOUR_NEW_IP:3001';
```

### Если используете домен:
```javascript
// В frontend/src/App.js найдите и замените:
const API_URL = 'https://your-new-domain.ru';
```

## 🧪 Тестирование после миграции

### 1. Проверка основных функций:
- [ ] Регистрация/авторизация
- [ ] Создание серверов
- [ ] Создание каналов
- [ ] Отправка сообщений
- [ ] Загрузка аватаров
- [ ] Голосовые каналы

### 2. Проверка производительности:
```bash
# Мониторинг ресурсов
htop
sudo -u boltushka pm2 monit

# Логи
sudo -u boltushka pm2 logs
sudo tail -f /var/log/nginx/boltushka-error.log
```

## 🆘 Решение проблем

### Backend не запускается:
```bash
# Проверьте логи
sudo -u boltushka pm2 logs boltushka-backend

# Проверьте .env файл
cat /var/www/boltushka/backend/.env

# Перезапустите
sudo -u boltushka pm2 restart boltushka-backend
```

### MongoDB не подключается:
```bash
# Проверьте статус
sudo systemctl status mongod

# Перезапустите
sudo systemctl restart mongod

# Проверьте подключение
mongosh
use boltushka
show collections
```

### Nginx ошибки:
```bash
# Проверьте конфигурацию
sudo nginx -t

# Проверьте логи
sudo tail -f /var/log/nginx/boltushka-error.log

# Перезапустите
sudo systemctl restart nginx
```

### WebSocket не работает:
- Убедитесь что nginx правильно настроен для Socket.IO
- Проверьте firewall (порты 80, 443 должны быть открыты)
- Проверьте что backend запущен на порту 3001

## 📞 Поддержка

Если возникли проблемы:

1. **Проверьте логи** (см. выше)
2. **Посмотрите статус сервисов**:
   ```bash
   sudo -u boltushka pm2 status
   sudo systemctl status nginx mongod
   ```
3. **Проверьте конфигурацию**:
   ```bash
   sudo nginx -t
   cat /var/www/boltushka/backend/.env
   ```

## 💰 Примерные расходы

- **Timeweb Cloud**: 300-500₽/месяц
- **Selectel**: 400-600₽/месяц
- **REG.RU**: 350-550₽/месяц
- **FirstVDS**: 200-400₽/месяц

## ✅ Чек-лист миграции

- [ ] Создан новый сервер у российского провайдера
- [ ] Настроен SSH доступ
- [ ] Выполнена миграция данных со старого сервера
- [ ] Установлено ПО на новом сервере
- [ ] Восстановлена база данных MongoDB
- [ ] Восстановлены загруженные файлы
- [ ] Настроен nginx с новым IP/доменом
- [ ] Запущено приложение
- [ ] Протестированы основные функции
- [ ] Обновлен frontend для подключения к новому серверу
- [ ] Настроен домен (если есть)
- [ ] Настроен SSL (если нужно)

---

🎉 **Поздравляем!** Ваш Boltushka теперь работает на российском хостинге!



