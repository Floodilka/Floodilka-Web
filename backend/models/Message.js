const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  channelId: {
    type: String,
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  username: {
    type: String,
    required: true
  },
  displayName: {
    type: String,
    default: null
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
    default: '',
    maxlength: 2000,
    validate: {
      validator: function(value) {
        // content обязателен только если нет вложений
        if (!value || value.trim() === '') {
          return this.attachments && this.attachments.length > 0;
        }
        return true;
      },
      message: 'Содержимое сообщения обязательно, если нет вложений'
    }
  },
  isSystem: {
    type: Boolean,
    default: false
  },
  attachments: [{
    filename: {
      type: String,
      required: true
    },
    originalName: {
      type: String,
      required: true
    },
    size: {
      type: Number,
      required: true
    },
    mimetype: {
      type: String,
      required: true
    },
    path: {
      type: String,
      required: true
    }
  }],
  reactions: [{
    emoji: {
      type: String,
      required: true
    },
    users: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      username: {
        type: String,
        required: true
      }
    }]
  }],
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
