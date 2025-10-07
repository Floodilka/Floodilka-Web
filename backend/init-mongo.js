// Скрипт инициализации MongoDB для Boltushka
// Создает базу данных и пользователя для приложения

// Переключиться на базу данных boltushka
db = db.getSiblingDB('boltushka');

// Создать пользователя для приложения
db.createUser({
  user: 'boltushka_user',
  pwd: 'boltushka_pass',
  roles: [
    {
      role: 'readWrite',
      db: 'boltushka'
    }
  ]
});

// Создать коллекции
db.createCollection('users');
db.createCollection('servers');
db.createCollection('channels');
db.createCollection('messages');
db.createCollection('roles');
db.createCollection('serverroles');
db.createCollection('invites');

// Создать индексы для оптимизации
db.users.createIndex({ "username": 1 }, { unique: true });
db.users.createIndex({ "email": 1 }, { unique: true });
db.messages.createIndex({ "channelId": 1, "createdAt": 1 });
db.messages.createIndex({ "userId": 1 });
db.channels.createIndex({ "serverId": 1 });
db.roles.createIndex({ "serverId": 1 });
db.serverroles.createIndex({ "serverId": 1, "userId": 1 }, { unique: true });

print('✅ База данных boltushka инициализирована');
print('👤 Пользователь: boltushka_user');
print('🔑 Пароль: boltushka_pass');
print('🌐 База данных: boltushka');
