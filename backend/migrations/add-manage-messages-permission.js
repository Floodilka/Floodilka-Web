const mongoose = require('mongoose');
require('dotenv').config();

const Role = require('../models/Role');

async function migrateRoles() {
  try {
    // Подключаемся к базе данных
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/boltushka';
    await mongoose.connect(mongoURI);
    console.log('✅ Подключено к MongoDB');

    // Находим все роли Administrator
    const adminRoles = await Role.find({ name: 'Administrator' });
    console.log(`Найдено ${adminRoles.length} ролей Administrator`);

    // Обновляем каждую роль, добавляя право manageMessages
    let updated = 0;
    for (const role of adminRoles) {
      if (!role.permissions.manageMessages) {
        role.permissions.manageMessages = true;
        await role.save();
        updated++;
        console.log(`✅ Обновлена роль Administrator на сервере ${role.serverId}`);
      } else {
        console.log(`⏭️  Роль Administrator на сервере ${role.serverId} уже имеет право manageMessages`);
      }
    }

    console.log(`\n✅ Миграция завершена! Обновлено ролей: ${updated}`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Ошибка миграции:', error);
    process.exit(1);
  }
}

migrateRoles();

