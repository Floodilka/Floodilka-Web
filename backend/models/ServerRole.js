const mongoose = require('mongoose');

const serverRoleSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  serverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Server',
    required: true
  },
  roleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Role',
    required: true
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedAt: {
    type: Date,
    default: Date.now
  }
});

// Виртуальное поле id для совместимости с фронтендом
serverRoleSchema.virtual('id').get(function() {
  return this._id.toString();
});

// Включить виртуальные поля при преобразовании в JSON
serverRoleSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    ret.id = ret._id.toString();
    return ret;
  }
});

// Индексы для оптимизации
serverRoleSchema.index({ userId: 1, serverId: 1 });
serverRoleSchema.index({ serverId: 1, roleId: 1 });

// Уникальная комбинация пользователя и роли на сервере
serverRoleSchema.index({ userId: 1, serverId: 1, roleId: 1 }, { unique: true });

module.exports = mongoose.model('ServerRole', serverRoleSchema);
