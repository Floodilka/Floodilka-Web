const mongoose = require('mongoose');

const serverSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  icon: {
    type: String, // URL или emoji для иконки сервера
    default: null
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

serverSchema.index({ ownerId: 1 });
serverSchema.index({ members: 1 });
serverSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Server', serverSchema);
