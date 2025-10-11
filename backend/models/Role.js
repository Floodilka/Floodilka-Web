const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  serverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Server',
    required: true
  },
  permissions: {
    manageServer: {
      type: Boolean,
      default: false
    },
    manageChannels: {
      type: Boolean,
      default: false
    },
    manageRoles: {
      type: Boolean,
      default: false
    },
    manageMembers: {
      type: Boolean,
      default: false
    },
    manageMessages: {
      type: Boolean,
      default: false
    },
    kickMembers: {
      type: Boolean,
      default: false
    },
    banMembers: {
      type: Boolean,
      default: false
    }
  },
  color: {
    type: String,
    default: '#5865f2'
  },
  position: {
    type: Number,
    default: 0
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Виртуальное поле id для совместимости с фронтендом
roleSchema.virtual('id').get(function() {
  return this._id.toString();
});

// Включить виртуальные поля при преобразовании в JSON
roleSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    ret.id = ret._id.toString();
    return ret;
  }
});

// Индексы для оптимизации
roleSchema.index({ serverId: 1, position: -1 });

module.exports = mongoose.model('Role', roleSchema);
