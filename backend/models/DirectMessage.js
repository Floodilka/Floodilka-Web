const mongoose = require('mongoose');

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

module.exports = mongoose.model('DirectMessage', directMessageSchema);
