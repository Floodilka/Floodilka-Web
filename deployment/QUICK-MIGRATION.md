# ⚡ Быстрая миграция с Digital Ocean

## 🎯 Что делать прямо сейчас

### 1. Выберите российский хостинг (5 минут)
**Рекомендую Timeweb Cloud:**
- Заходите на cloud.timeweb.com
- Регистрируетесь
- Создаете VPS: Ubuntu 22.04, 1GB RAM, 20GB SSD
- Записываете IP адрес сервера

### 2. Миграция данных (10 минут)

#### На старом сервере (Digital Ocean):
```bash
ssh root@159.89.110.44
cd /var/www/boltushka
nano deployment/migrate-to-new-server.sh
# Замените NEW_SERVER_IP на IP нового сервера
bash deployment/migrate-to-new-server.sh
```

#### На новом сервере:
```bash
ssh root@YOUR_NEW_IP
sudo bash /var/www/boltushka/deployment/setup.sh
sudo bash /var/www/boltushka/deployment/setup-mongodb.sh
cd /var/www/boltushka
tar -xzf /tmp/boltushka-migration-backup.tar.gz
mongorestore --db boltushka backup/mongodb/boltushka
cp -r backup/uploads/* backend/uploads/ 2>/dev/null || true
cp backup/.env backend/.env
sudo bash deployment/setup-production.sh
```

### 3. Настройка nginx (5 минут)
```bash
sudo cp deployment/nginx-http.conf /etc/nginx/sites-available/boltushka
sudo nano /etc/nginx/sites-available/boltushka
# Замените server_name _; на server_name YOUR_NEW_IP;
sudo ln -sf /etc/nginx/sites-available/boltushka /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

### 4. Запуск приложения (2 минуты)
```bash
sudo bash deployment/update.sh
sudo -u boltushka pm2 status
curl http://YOUR_NEW_IP
```

### 5. Обновление frontend (если нужно)
В файле `frontend/src/App.js` замените:
```javascript
const API_URL = 'http://YOUR_NEW_IP:3001';
```

## ✅ Готово!
Ваш Boltushka теперь работает на российском хостинге!

## 🆘 Если что-то пошло не так
```bash
# Проверьте логи
sudo -u boltushka pm2 logs
sudo systemctl status nginx mongod

# Перезапустите сервисы
sudo -u boltushka pm2 restart boltushka-backend
sudo systemctl restart nginx mongod
```

📖 **Подробная инструкция**: [MIGRATION-GUIDE.md](./MIGRATION-GUIDE.md)
