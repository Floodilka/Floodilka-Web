const mongoose = require('mongoose');

const channelSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 30
  },
  type: {
    type: String,
    enum: ['text', 'voice'],
    default: 'text'
  },
  topic: {
    type: String,
    trim: true,
    maxlength: 1024,
    default: ''
  },
  slowMode: {
    type: String,
    enum: ['off', '5', '10', '15', '30', '60', '120', '300', '600'],
    default: 'off'
  },
  nsfw: {
    type: Boolean,
    default: false
  },
  hideAfterInactivity: {
    type: String,
    enum: ['never', '1', '3', '7', '14', '30'],
    default: 'never'
  },
  serverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Server',
    default: null // null для глобальных каналов
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
channelSchema.virtual('id').get(function() {
  return this._id.toString();
});

// Включить виртуальные поля при преобразовании в JSON
channelSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    ret.id = ret._id.toString();
    // Преобразуем serverId в строку для совместимости с фронтендом
    if (ret.serverId) {
      ret.serverId = ret.serverId.toString();
    }
    return ret;
  }
});

module.exports = mongoose.model('Channel', channelSchema);

