# Миграция MongoDB: boltushka → floodilka

## 📋 Что нужно сделать на сервере

### 1. Проверка текущей базы данных

```bash
# Подключиться к MongoDB
mongosh --username admin --password password123 --authenticationDatabase admin

# Проверить существующие базы данных
show dbs

# Посмотреть коллекции в базе boltushka
use boltushka
show collections

# Проверить количество документов
db.users.countDocuments()
db.servers.countDocuments()
db.channels.countDocuments()
db.messages.countDocuments()
```

### 2. Создание бэкапа (ОБЯЗАТЕЛЬНО!)

```bash
# Создать бэкап текущей базы данных
mongodump --username admin --password password123 --authenticationDatabase admin --db boltushka --out /var/backups/mongodb/boltushka-backup-$(date +%Y%m%d)

# Проверить, что бэкап создан
ls -lh /var/backups/mongodb/
```

### 3. Копирование базы данных

```bash
# Подключиться к MongoDB
mongosh --username admin --password password123 --authenticationDatabase admin

# Скопировать базу boltushka в floodilka
use admin
db.copyDatabase("boltushka", "floodilka")

# ИЛИ использовать mongodump/mongorestore:
```

```bash
# Экспорт базы boltushka
mongodump --username admin --password password123 --authenticationDatabase admin --db boltushka --archive=/tmp/boltushka.archive

# Импорт в базу floodilka
mongorestore --username admin --password password123 --authenticationDatabase admin --nsFrom="boltushka.*" --nsTo="floodilka.*" --archive=/tmp/boltushka.archive

# Удалить временный файл
rm /tmp/boltushka.archive
```

### 4. Создание пользователя для новой базы

```bash
# Подключиться к MongoDB
mongosh --username admin --password password123 --authenticationDatabase admin

# Переключиться на базу floodilka
use floodilka

# Создать пользователя floodilka_user
db.createUser({
  user: 'floodilka_user',
  pwd: 'floodilka_pass',  // ПОМЕНЯЙТЕ ПАРОЛЬ!
  roles: [
    {
      role: 'readWrite',
      db: 'floodilka'
    }
  ]
});

# Проверить пользователя
db.getUsers()

# Выйти
exit
```

### 5. Проверка новой базы данных

```bash
# Подключиться от имени нового пользователя
mongosh --username floodilka_user --password floodilka_pass --authenticationDatabase floodilka

# Проверить коллекции
use floodilka
show collections

# Проверить количество документов (должно совпадать с boltushka)
db.users.countDocuments()
db.servers.countDocuments()
db.channels.countDocuments()
db.messages.countDocuments()

# Выйти
exit
```

### 6. Обновление .env файла на сервере

```bash
# Перейти в директорию проекта
cd /var/www/floodilka/backend

# Создать бэкап старого .env
cp .env .env.backup

# Отредактировать .env
nano .env
```

**Изменить строку:**
```env
# Было:
MONGODB_URI=mongodb://boltushka_user:boltushka_pass@localhost:27017/boltushka

# Стало:
MONGODB_URI=mongodb://floodilka_user:floodilka_pass@localhost:27017/floodilka
```

**Также обновить:**
```env
FRONTEND_URL=https://floodilka.com
```

### 7. Перезапуск backend

```bash
# Перезапустить backend с новыми переменными окружения
sudo -u floodilka pm2 restart floodilka-backend --update-env

# Проверить логи
sudo -u floodilka pm2 logs floodilka-backend
```

### 8. Проверка работы приложения

```bash
# Проверить подключение к базе данных
sudo -u floodilka pm2 logs floodilka-backend | grep -i "mongodb"

# Должно быть: "✅ MongoDB подключен к floodilka"
```

**В браузере:**
- Откройте https://floodilka.com
- Попробуйте войти
- Проверьте, что все данные отображаются

### 9. Удаление старой базы (ТОЛЬКО ПОСЛЕ ПРОВЕРКИ!)

⚠️ **ВНИМАНИЕ: Выполняйте ТОЛЬКО после полной проверки работы!**

```bash
# Подождите минимум 1-2 дня работы на новой базе
# Убедитесь, что всё работает корректно

# Подключиться к MongoDB
mongosh --username admin --password password123 --authenticationDatabase admin

# Удалить старого пользователя
use boltushka
db.dropUser("boltushka_user")

# Удалить старую базу данных (БУДЬТЕ ОСТОРОЖНЫ!)
use admin
db.dropDatabase("boltushka")

# Выйти
exit
```

## 🔄 Альтернативный подход: Переименование базы

MongoDB не поддерживает прямое переименование базы данных, но можно:

```bash
# 1. Создать бэкап
mongodump --username admin --password password123 --authenticationDatabase admin --db boltushka --out /var/backups/mongodb/

# 2. Восстановить с новым именем
mongorestore --username admin --password password123 --authenticationDatabase admin --db floodilka /var/backups/mongodb/boltushka/

# 3. Создать нового пользователя (см. шаг 4 выше)

# 4. Удалить старую базу (после проверки)
```

## 📝 Чеклист миграции

- [ ] Создан бэкап базы данных boltushka
- [ ] База данных скопирована в floodilka
- [ ] Создан пользователь floodilka_user
- [ ] Проверено количество документов в новой базе
- [ ] Обновлен файл .env на сервере
- [ ] Backend перезапущен с новыми переменными
- [ ] Приложение работает с новой базой данных
- [ ] Проверена работа в течение 1-2 дней
- [ ] Удалены старая база и пользователь (опционально)

## 🆘 Восстановление при проблемах

Если что-то пошло не так:

```bash
# 1. Остановить backend
sudo -u floodilka pm2 stop floodilka-backend

# 2. Восстановить старый .env
cd /var/www/floodilka/backend
cp .env.backup .env

# 3. Запустить backend
sudo -u floodilka pm2 start floodilka-backend

# 4. Восстановить базу из бэкапа (если нужно)
mongorestore --username admin --password password123 --authenticationDatabase admin --db boltushka /var/backups/mongodb/boltushka-backup-YYYYMMDD/boltushka/
```

## 💡 Рекомендации

1. **Делайте миграцию в нерабочее время** (ночью или в выходные)
2. **Создавайте бэкап перед каждым шагом**
3. **Не удаляйте старую базу минимум 1-2 дня**
4. **Проверяйте логи после каждого шага**
5. **Имейте план отката** (план Б)

## 🔐 Безопасность

⚠️ **Важно:** Пароли в этом файле - примеры! Используйте свои надёжные пароли:

```bash
# Сгенерировать надёжный пароль
openssl rand -base64 32
```

Обновите пароли в:
- MongoDB (createUser)
- .env файле (MONGODB_URI)

