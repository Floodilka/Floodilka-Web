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

module.exports = mongoose.model('Channel', channelSchema);

