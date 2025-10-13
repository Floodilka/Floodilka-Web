const messageService = require('../services/messageService');
const asyncHandler = require('../utils/asyncHandler');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads/messages');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 5 // максимум 5 файлов
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Неподдерживаемый тип файла. Разрешены только изображения (JPEG, PNG, GIF, WebP)'), false);
    }
  }
});

exports.getChannelMessages = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  const { before, after, limit } = req.query;

  const messages = await messageService.getChannelMessages(channelId, {
    before,
    after,
    limit
  });
  res.json(messages);
});

exports.editMessage = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const { content } = req.body;

  const message = await messageService.editMessage(messageId, content);

  // Отправляем обновление всем в канале через WebSocket
  const io = req.app.get('io');
  if (io) {
    io.to(message.channelId).emit('message:edited', message);
  }

  res.json(message);
});

exports.deleteMessage = asyncHandler(async (req, res) => {
  const { messageId } = req.params;

  const { messageId: deletedId, channelId } = await messageService.deleteMessage(messageId);

  // Отправляем уведомление об удалении всем в канале
  const io = req.app.get('io');
  if (io) {
    io.to(channelId).emit('message:deleted', { messageId: deletedId });
  }

  res.json({ success: true });
});

// Middleware для обработки загрузки файлов
exports.uploadFiles = upload.array('files', 5);

// Обработчик загрузки файлов
exports.uploadMessageFiles = asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'Файлы не найдены' });
  }

  const uploadedFiles = req.files.map(file => ({
    filename: file.filename,
    originalName: file.originalname,
    size: file.size,
    mimetype: file.mimetype,
    path: `/uploads/messages/${file.filename}`
  }));

  res.json({
    success: true,
    files: uploadedFiles
  });
});
