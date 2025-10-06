const mongoose = require('mongoose');

const inviteSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  serverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Server',
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  expiresAt: {
    type: Date,
    default: null // null = без срока действия
  },
  maxUses: {
    type: Number,
    default: null // null = неограниченно
  },
  uses: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Метод для проверки валидности инвайта
inviteSchema.methods.isValid = function() {
  // Проверка срока действия
  if (this.expiresAt && this.expiresAt < new Date()) {
    return false;
  }

  // Проверка лимита использований
  if (this.maxUses !== null && this.uses >= this.maxUses) {
    return false;
  }

  return true;
};

module.exports = mongoose.model('Invite', inviteSchema);

