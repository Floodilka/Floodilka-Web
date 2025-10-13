const mongoose = require('mongoose');

const replyMetadataSchema = new mongoose.Schema({
  messageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  channelId: {
    type: String,
    default: null
  },
  username: {
    type: String,
    default: null
  },
  displayName: {
    type: String,
    default: null
  },
  content: {
    type: String,
    default: ''
  },
  hasAttachments: {
    type: Boolean,
    default: false
  },
  attachmentPreview: {
    path: {
      type: String,
      default: null
    },
    mimetype: {
      type: String,
      default: null
    },
    originalName: {
      type: String,
      default: null
    }
  },
  isSystem: {
    type: Boolean,
    default: false
  }
}, {
  _id: false
});

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
  replyTo: {
    type: replyMetadataSchema,
    default: null
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
  mentions: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    username: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['user', 'everyone'],
      default: 'user'
    }
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
    if (ret.replyTo && ret.replyTo.messageId) {
      ret.replyTo.messageId = ret.replyTo.messageId.toString();
    }
    return ret;
  }
});

module.exports = mongoose.model('Message', messageSchema);
