const mongoose = require('mongoose');

const replyMetadataSchema = new mongoose.Schema({
  messageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DirectMessage'
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
  }
}, {
  _id: false
});

const directMessageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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
  timestamp: {
    type: Date,
    default: Date.now
  },
  read: {
    type: Boolean,
    default: false
  },
  edited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date
  },
  deleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Индекс для быстрого поиска сообщений между пользователями
directMessageSchema.index({ sender: 1, receiver: 1, timestamp: -1 });

// Индекс для поиска непрочитанных сообщений
directMessageSchema.index({ receiver: 1, read: 1 });

directMessageSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    ret.id = ret._id.toString();
    if (ret.replyTo && ret.replyTo.messageId) {
      ret.replyTo.messageId = ret.replyTo.messageId.toString();
    }
    return ret;
  }
});

module.exports = mongoose.model('DirectMessage', directMessageSchema);
