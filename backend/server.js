const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

// Загрузка переменных окружения
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const NODE_ENV = process.env.NODE_ENV || 'development';

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
app.use(express.json());

// Хранилище данных в памяти
const channels = new Map();
const messages = new Map();
const onlineUsers = new Map(); // channelId -> Set of usernames
const voiceUsers = new Map(); // channelId -> Map(socketId -> {username, isMuted})

// Создать дефолтные каналы
const defaultTextChannelId = uuidv4();
channels.set(defaultTextChannelId, {
  id: defaultTextChannelId,
  name: 'Общий',
  type: 'text',
  createdAt: new Date().toISOString()
});
messages.set(defaultTextChannelId, []);
onlineUsers.set(defaultTextChannelId, new Set());

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
        onlineUsers.set(channelId, new Set());
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

// Получить все каналы
app.get('/api/channels', (req, res) => {
  const channelList = Array.from(channels.values());
  res.json(channelList);
});

// Создать новый канал
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
    onlineUsers.set(channelId, new Set());
  } else {
    voiceUsers.set(channelId, new Map());
  }

  // Уведомить всех клиентов о новом канале
  io.emit('channel:created', newChannel);

  res.status(201).json(newChannel);
});

// Получить сообщения канала
app.get('/api/channels/:channelId/messages', (req, res) => {
  const { channelId } = req.params;

  if (!channels.has(channelId)) {
    return res.status(404).json({ error: 'Канал не найден' });
  }

  const channelMessages = messages.get(channelId) || [];
  res.json(channelMessages);
});

// WebSocket обработка
io.on('connection', (socket) => {
  console.log('Новое подключение:', socket.id);

  let currentChannel = null;
  let currentUsername = null;

  // Присоединиться к каналу
  socket.on('channel:join', ({ channelId, username }) => {
    if (!channels.has(channelId)) {
      socket.emit('error', { message: 'Канал не найден' });
      return;
    }

    const channel = channels.get(channelId);

    // Проверить, что это текстовый канал
    if (channel.type === 'voice') {
      socket.emit('error', { message: 'Используйте voice:join для голосовых каналов' });
      return;
    }

    // Покинуть предыдущий канал
    if (currentChannel) {
      socket.leave(currentChannel);
      const users = onlineUsers.get(currentChannel);
      if (users) {
        users.delete(currentUsername);
        io.to(currentChannel).emit('users:update', {
          channelId: currentChannel,
          users: Array.from(users)
        });
      }
    }

    // Присоединиться к новому каналу
    currentChannel = channelId;
    currentUsername = username || `Гость${Math.floor(Math.random() * 1000)}`;
    socket.join(channelId);

    // Получить или создать Set пользователей для канала
    let users = onlineUsers.get(channelId);
    if (!users) {
      users = new Set();
      onlineUsers.set(channelId, users);
    }
    users.add(currentUsername);

    // Получить или создать массив сообщений для канала
    let channelMessages = messages.get(channelId);
    if (!channelMessages) {
      channelMessages = [];
      messages.set(channelId, channelMessages);
    }

    // Отправить текущие сообщения
    socket.emit('messages:history', channelMessages);

    // Уведомить всех о новом пользователе
    io.to(channelId).emit('users:update', {
      channelId,
      users: Array.from(users)
    });
  });

  // Отправить сообщение
  socket.on('message:send', ({ channelId, content }) => {
    if (!channels.has(channelId)) {
      socket.emit('error', { message: 'Канал не найден' });
      return;
    }

    if (!content || content.trim() === '') {
      return;
    }

    const message = {
      id: uuidv4(),
      channelId,
      username: currentUsername || 'Аноним',
      content: content.trim(),
      timestamp: new Date().toISOString(),
      isSystem: false
    };

    // Получить или создать массив сообщений для канала
    let channelMessages = messages.get(channelId);
    if (!channelMessages) {
      channelMessages = [];
      messages.set(channelId, channelMessages);
    }
    channelMessages.push(message);

    // Отправить всем в канале
    io.to(channelId).emit('message:new', message);
  });

  // WebRTC сигналинг для голосовых каналов

  // Присоединиться к голосовому каналу
  socket.on('voice:join', ({ channelId, username }) => {
    if (!channels.has(channelId)) {
      socket.emit('error', { message: 'Канал не найден' });
      return;
    }

    const channel = channels.get(channelId);
    if (channel.type !== 'voice') {
      socket.emit('error', { message: 'Это не голосовой канал' });
      return;
    }

    // Получить или создать Map пользователей для голосового канала
    let users = voiceUsers.get(channelId);
    if (!users) {
      users = new Map();
      voiceUsers.set(channelId, users);
    }
    users.set(socket.id, { username, isMuted: false });

    // Присоединиться к комнате
    socket.join(channelId);

    // Получить список других пользователей в канале
    const otherUsers = Array.from(users.entries())
      .filter(([id]) => id !== socket.id)
      .map(([id, data]) => ({ id, username: data.username, isMuted: data.isMuted }));

    // Отправить текущему пользователю список других пользователей
    socket.emit('voice:users', otherUsers);

    // Уведомить других пользователей о новом участнике
    socket.to(channelId).emit('voice:user-joined', {
      id: socket.id,
      username,
      isMuted: false
    });

    // Отправить обновленный список всем пользователям для сайдбара
    broadcastVoiceChannelUsers();

    console.log(`${username} присоединился к голосовому каналу ${channel.name}`);
  });

  // Покинуть голосовой канал
  socket.on('voice:leave', ({ channelId }) => {
    if (!channels.has(channelId)) return;

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
    if (currentChannel && currentUsername) {
      const users = onlineUsers.get(currentChannel);
      if (users) {
        users.delete(currentUsername);
        io.to(currentChannel).emit('users:update', {
          channelId: currentChannel,
          users: Array.from(users)
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
        isMuted: data.isMuted
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
        isMuted: data.isMuted
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

