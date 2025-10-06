require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

// Импорт моделей
const Channel = require('./models/Channel');
const Message = require('./models/Message');

// Загрузка переменных окружения
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const NODE_ENV = process.env.NODE_ENV || 'development';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/boltushka';

// Подключение к MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => console.log('📦 MongoDB подключена'))
  .catch(err => console.error('❌ Ошибка подключения к MongoDB:', err));

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.use(cors({
  origin: FRONTEND_URL,
  credentials: true
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ limit: '2mb', extended: true }));

// Статические файлы (для аватаров)
app.use('/uploads', express.static('uploads'));

// Импорт роутов
const authRoutes = require('./routes/auth');
const serverRoutes = require('./routes/servers');
app.use('/api/auth', authRoutes);
app.use('/api/servers', serverRoutes);

// Хранилище данных в памяти (временно, потом переведем на БД)
const channels = new Map();
const messages = new Map();
const onlineUsers = new Map(); // channelId -> Set of usernames
const voiceUsers = new Map(); // channelId -> Map(socketId -> {username, isMuted, isDeafened})

// Создать дефолтные каналы
const defaultTextChannelId = uuidv4();
channels.set(defaultTextChannelId, {
  id: defaultTextChannelId,
  name: 'Общий',
  type: 'text',
  createdAt: new Date().toISOString()
});
messages.set(defaultTextChannelId, []);
onlineUsers.set(defaultTextChannelId, new Map());

const defaultVoiceChannelId = uuidv4();
channels.set(defaultVoiceChannelId, {
  id: defaultVoiceChannelId,
  name: 'Голосовой чат',
  type: 'voice',
  createdAt: new Date().toISOString()
});
voiceUsers.set(defaultVoiceChannelId, new Map());

// Функция для миграции старых каналов
function migrateOldChannels() {
  channels.forEach((channel, channelId) => {
    // Если канал не имеет типа, это старый канал - считаем его текстовым
    if (!channel.type) {
      channel.type = 'text';
      channels.set(channelId, channel);
    }

    // Убедиться, что для текстовых каналов есть структуры данных
    if (channel.type === 'text') {
      if (!messages.has(channelId)) {
        messages.set(channelId, []);
      }
      if (!onlineUsers.has(channelId)) {
        onlineUsers.set(channelId, new Map());
      }
    }

    // Убедиться, что для голосовых каналов есть структуры данных
    if (channel.type === 'voice') {
      if (!voiceUsers.has(channelId)) {
        voiceUsers.set(channelId, new Map());
      }
    }
  });
}

// Запустить миграцию при старте
migrateOldChannels();

// REST API endpoints

// Получить все каналы (для обратной совместимости - старые каналы из памяти)
app.get('/api/channels', async (req, res) => {
  try {
    // Возвращаем старые каналы из памяти, если они есть
    const channelList = Array.from(channels.values());
    res.json(channelList);
  } catch (error) {
    console.error('Ошибка получения каналов:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Создать новый канал (старый endpoint для обратной совместимости)
app.post('/api/channels', (req, res) => {
  const { name, type } = req.body;

  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Название канала обязательно' });
  }

  const channelType = type === 'voice' ? 'voice' : 'text';
  const channelId = uuidv4();
  const newChannel = {
    id: channelId,
    name: name.trim(),
    type: channelType,
    createdAt: new Date().toISOString()
  };

  channels.set(channelId, newChannel);

  if (channelType === 'text') {
    messages.set(channelId, []);
    onlineUsers.set(channelId, new Map());
  } else {
    voiceUsers.set(channelId, new Map());
  }

  // Уведомить всех клиентов о новом канале
  io.emit('channel:created', newChannel);

  res.status(201).json(newChannel);
});

// Получить сообщения канала
app.get('/api/channels/:channelId/messages', async (req, res) => {
  try {
    const { channelId } = req.params;

    // Сначала проверим в памяти (старые каналы)
    if (channels.has(channelId)) {
      const channelMessages = messages.get(channelId) || [];
      return res.json(channelMessages);
    }

    // Если не в памяти, ищем в БД
    const channelMessages = await Message.find({ channelId })
      .sort({ createdAt: 1 })
      .limit(100);

    res.json(channelMessages);
  } catch (error) {
    console.error('Ошибка получения сообщений:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// WebSocket обработка
io.on('connection', (socket) => {
  console.log('Новое подключение:', socket.id);

  let currentChannel = null;
  let currentUsername = null;

  // Присоединиться к каналу
  socket.on('channel:join', async ({ channelId, username, avatar, badge, badgeTooltip, displayName, userId }) => {
    // Проверяем в памяти (для обратной совместимости) и в базе данных
    const channelInMemory = channels.get(channelId);

    // Если канал из памяти, проверяем тип
    if (channelInMemory && channelInMemory.type === 'voice') {
      socket.emit('error', { message: 'Используйте voice:join для голосовых каналов' });
      return;
    }

    // Покинуть предыдущий канал
    if (currentChannel) {
      socket.leave(currentChannel);
      const users = onlineUsers.get(currentChannel);
      if (users) {
        users.delete(socket.id);
        io.to(currentChannel).emit('users:update', {
          channelId: currentChannel,
          users: Array.from(users.values())
        });
      }
    }

    // Присоединиться к новому каналу
    currentChannel = channelId;
    currentUsername = username || `Гость${Math.floor(Math.random() * 1000)}`;
    socket.currentAvatar = avatar;
    socket.join(channelId);

    // Получить или создать Map пользователей для канала
    let users = onlineUsers.get(channelId);
    if (!users) {
      users = new Map();
      onlineUsers.set(channelId, users);
    }
    users.set(socket.id, { username: currentUsername, avatar, badge, badgeTooltip, displayName, userId });

    // Загрузить сообщения из БД или памяти
    let channelMessages = [];
    if (channelInMemory) {
      // Старый канал из памяти
      channelMessages = messages.get(channelId) || [];
      if (!messages.has(channelId)) {
        messages.set(channelId, []);
      }
    } else {
      // Канал из БД
      try {
        const dbMessages = await Message.find({ channelId })
          .sort({ createdAt: 1 })
          .limit(100);
        channelMessages = dbMessages;
      } catch (err) {
        console.error('Ошибка загрузки сообщений:', err);
      }
    }

    // Отправить текущие сообщения
    socket.emit('messages:history', channelMessages);

    // Уведомить всех о новом пользователе
    io.to(channelId).emit('users:update', {
      channelId,
      users: Array.from(users.values())
    });
  });

  // Отправить сообщение
  socket.on('message:send', async ({ channelId, content, username, avatar, badge, badgeTooltip, displayName, userId }) => {
    if (!content || content.trim() === '') {
      return;
    }

    const messageData = {
      channelId,
      userId: userId || null,
      username: username || currentUsername || 'Аноним',
      displayName: displayName || null,
      avatar: avatar || socket.currentAvatar || null,
      badge: badge || null,
      badgeTooltip: badgeTooltip || null,
      content: content.trim(),
      isSystem: false
    };

    const channelInMemory = channels.get(channelId);

    if (channelInMemory) {
      // Старый канал из памяти
      const message = {
        id: uuidv4(),
        ...messageData,
        timestamp: new Date().toISOString()
      };

      let channelMessages = messages.get(channelId);
      if (!channelMessages) {
        channelMessages = [];
        messages.set(channelId, channelMessages);
      }
      channelMessages.push(message);

      io.to(channelId).emit('message:new', message);
    } else {
      // Канал из БД - сохраняем сообщение в БД
      try {
        const message = new Message(messageData);
        await message.save();

        // Отправить всем в канале (с виртуальными полями)
        io.to(channelId).emit('message:new', message.toJSON());
      } catch (err) {
        console.error('Ошибка сохранения сообщения:', err);
        socket.emit('error', { message: 'Ошибка отправки сообщения' });
      }
    }
  });

  // WebRTC сигналинг для голосовых каналов

  // Присоединиться к голосовому каналу
  socket.on('voice:join', ({ channelId, username, avatar, badge, badgeTooltip, displayName, userId }) => {
    // Проверяем в памяти (для обратной совместимости)
    const channelInMemory = channels.get(channelId);

    // Если канал из памяти, проверяем тип
    if (channelInMemory && channelInMemory.type !== 'voice') {
      socket.emit('error', { message: 'Это не голосовой канал' });
      return;
    }

    // Получить или создать Map пользователей для голосового канала
    let users = voiceUsers.get(channelId);
    if (!users) {
      users = new Map();
      voiceUsers.set(channelId, users);
    }
    users.set(socket.id, { username, avatar, badge, badgeTooltip, displayName, userId, isMuted: false, isDeafened: false });

    // Присоединиться к комнате
    socket.join(channelId);

    // Получить список других пользователей в канале
    const otherUsers = Array.from(users.entries())
      .filter(([id]) => id !== socket.id)
      .map(([id, data]) => ({ id, username: data.username, avatar: data.avatar, isMuted: data.isMuted, isDeafened: data.isDeafened }));

    // Отправить текущему пользователю список других пользователей
    socket.emit('voice:users', otherUsers);

    // Уведомить других пользователей о новом участнике
    socket.to(channelId).emit('voice:user-joined', {
      id: socket.id,
      username,
      avatar,
      isMuted: false,
      isDeafened: false
    });

    // Отправить обновленный список всем пользователям для сайдбара
    broadcastVoiceChannelUsers();

    console.log(`${username} присоединился к голосовому каналу ${channelId}`);
  });

  // Покинуть голосовой канал
  socket.on('voice:leave', ({ channelId }) => {
    // Каналы из базы данных также поддерживаются

    const users = voiceUsers.get(channelId);
    if (users) {
      users.delete(socket.id);
      socket.leave(channelId);
      socket.to(channelId).emit('voice:user-left', { id: socket.id });

      // Обновить сайдбар у всех
      broadcastVoiceChannelUsers();
    }
  });

  // Изменить статус mute
  socket.on('voice:mute-toggle', ({ channelId, isMuted }) => {
    const users = voiceUsers.get(channelId);
    if (users && users.has(socket.id)) {
      const userData = users.get(socket.id);
      userData.isMuted = isMuted;
      users.set(socket.id, userData);

      // Уведомить всех в канале
      io.to(channelId).emit('voice:user-muted', {
        id: socket.id,
        isMuted
      });

      // Обновить сайдбар у всех
      broadcastVoiceChannelUsers();
    }
  });

  // Изменить статус deafen
  socket.on('voice:deafen-toggle', ({ channelId, isDeafened }) => {
    const users = voiceUsers.get(channelId);
    if (users && users.has(socket.id)) {
      const userData = users.get(socket.id);
      userData.isDeafened = isDeafened;
      users.set(socket.id, userData);

      // Уведомить всех в канале
      io.to(channelId).emit('voice:user-deafened', {
        id: socket.id,
        isDeafened
      });

      // Обновить сайдбар у всех
      broadcastVoiceChannelUsers();
    }
  });

  // WebRTC offer
  socket.on('voice:offer', ({ offer, to }) => {
    socket.to(to).emit('voice:offer', {
      offer,
      from: socket.id
    });
  });

  // WebRTC answer
  socket.on('voice:answer', ({ answer, to }) => {
    socket.to(to).emit('voice:answer', {
      answer,
      from: socket.id
    });
  });

  // ICE candidate
  socket.on('voice:ice-candidate', ({ candidate, to }) => {
    socket.to(to).emit('voice:ice-candidate', {
      candidate,
      from: socket.id
    });
  });

  // Отключение
  socket.on('disconnect', () => {
    console.log('Отключение:', socket.id);

    // Обработка текстовых каналов
    if (currentChannel) {
      const users = onlineUsers.get(currentChannel);
      if (users) {
        users.delete(socket.id);
        io.to(currentChannel).emit('users:update', {
          channelId: currentChannel,
          users: Array.from(users.values())
        });
      }
    }

    // Обработка голосовых каналов
    voiceUsers.forEach((users, channelId) => {
      if (users.has(socket.id)) {
        users.delete(socket.id);
        socket.to(channelId).emit('voice:user-left', { id: socket.id });
      }
    });

    // Обновить сайдбар у всех после отключения
    broadcastVoiceChannelUsers();
  });

  // Запрос на получение всех пользователей в голосовых каналах
  socket.on('voice:get-all-users', () => {
    const voiceChannelsData = {};
    voiceUsers.forEach((users, channelId) => {
      voiceChannelsData[channelId] = Array.from(users.entries()).map(([id, data]) => ({
        id,
        username: data.username,
        avatar: data.avatar,
        badge: data.badge,
        badgeTooltip: data.badgeTooltip,
        displayName: data.displayName,
        userId: data.userId,
        isMuted: data.isMuted,
        isDeafened: data.isDeafened
      }));
    });
    console.log('📡 Отправка voice:channels-update:', JSON.stringify(voiceChannelsData, null, 2));
    socket.emit('voice:channels-update', voiceChannelsData);
  });

  // Функция для отправки списка пользователей в голосовых каналах всем
  function broadcastVoiceChannelUsers() {
    const voiceChannelsData = {};

    voiceUsers.forEach((users, channelId) => {
      voiceChannelsData[channelId] = Array.from(users.entries()).map(([id, data]) => ({
        id,
        username: data.username,
        avatar: data.avatar,
        badge: data.badge,
        badgeTooltip: data.badgeTooltip,
        displayName: data.displayName,
        userId: data.userId,
        isMuted: data.isMuted,
        isDeafened: data.isDeafened
      }));
    });

    io.emit('voice:channels-update', voiceChannelsData);
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`📝 Режим: ${NODE_ENV}`);
  console.log(`🌐 CORS настроен для: ${FRONTEND_URL}`);
});

