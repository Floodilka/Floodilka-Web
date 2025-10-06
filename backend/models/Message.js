const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  channelId: {
    type: String,
    required: true,
    index: true
  },
  username: {
    type: String,
    required: true
  },
  avatar: {
    type: String,
    default: null
  },
    badge: {
    type: String,
    default: null
  },
  badgeTooltip: {
    type: String,
    default: null
  },
  content: {
    type: String,
    required: true,
    maxlength: 2000
  },
  isSystem: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Виртуальное поле id для совместимости с фронтендом
messageSchema.virtual('id').get(function() {
  return this._id.toString();
});

// Виртуальное поле timestamp для совместимости
messageSchema.virtual('timestamp').get(function() {
  return this.createdAt.toISOString();
});

// Включить виртуальные поля при преобразовании в JSON
messageSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    ret.id = ret._id.toString();
    ret.timestamp = ret.createdAt.toISOString();
    return ret;
  }
});

module.exports = mongoose.model('Message', messageSchema);
