const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 2,
    maxlength: 20
  },
  displayName: {
    type: String,
    trim: true,
    maxlength: 32,
    default: function() {
      return this.username;
    }
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  avatar: {
    type: String,
    default: null
  },
  badge: {
    type: String,
    default: 'User'
  },
  badgeTooltip: {
    type: String,
    default: 'Пользователь'
  },
  status: {
    type: String,
    enum: ['online', 'offline', 'idle', 'dnd'],
    default: 'online'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  friends: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  blockedUsers: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 200
    },
    blockedAt: {
      type: Date,
      default: Date.now
    }
  }]
});

// Хеширование пароля перед сохранением
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Метод для проверки пароля
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.index({ status: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ 'blockedUsers.userId': 1 });

module.exports = mongoose.model('User', userSchema);
