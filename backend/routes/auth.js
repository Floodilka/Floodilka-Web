const express = require('express');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const User = require('../models/User');

const router = express.Router();

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/avatars');
    // Создать директорию если не существует
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Разрешить только изображения
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Только изображения разрешены'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: fileFilter
});

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d';

// Регистрация
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Валидация
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Все поля обязательны' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Пароль должен быть минимум 6 символов' });
    }

    // Защита: запретить регистрацию с зарезервированным username
    const reservedUsernames = ['puncher', 'admin', 'administrator', 'system', 'root'];
    if (reservedUsernames.includes(username.toLowerCase())) {
      return res.status(400).json({ error: 'Это имя пользователя зарезервировано' });
    }

    // Проверка существования пользователя
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.status(400).json({
        error: existingUser.email === email
          ? 'Email уже используется'
          : 'Имя пользователя занято'
      });
    }

    // Создание пользователя
    const user = new User({
      username,
      email,
      password
    });

    await user.save();

    // Создание токена
    const token = jwt.sign(
      { userId: user._id, username: user.username },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.status(201).json({
      token,
      user: {
        id: user._id,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        avatar: user.avatar,
        badge: user.badge,
        badgeTooltip: user.badgeTooltip
      }
    });
  } catch (error) {
    console.error('Ошибка регистрации:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Логин
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Валидация
    if (!email || !password) {
      return res.status(400).json({ error: 'Email и пароль обязательны' });
    }

    // Поиск пользователя
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    // Проверка пароля
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    // Создание токена
    const token = jwt.sign(
      { userId: user._id, username: user.username },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // Обновление статуса
    user.status = 'online';
    await user.save();

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        avatar: user.avatar,
        badge: user.badge,
        badgeTooltip: user.badgeTooltip
      }
    });
  } catch (error) {
    console.error('Ошибка логина:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получить текущего пользователя
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    res.json({
      id: user._id,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      avatar: user.avatar,
      badge: user.badge,
      badgeTooltip: user.badgeTooltip,
      status: user.status
    });
  } catch (error) {
    console.error('Ошибка получения пользователя:', error);
    res.status(401).json({ error: 'Неверный токен' });
  }
});

// Получить пользователя по ID
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select('-password -email');

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    res.json({
      id: user._id,
      username: user.username,
      displayName: user.displayName,
      avatar: user.avatar,
      badge: user.badge,
      badgeTooltip: user.badgeTooltip,
      status: user.status
    });
  } catch (error) {
    console.error('Ошибка получения пользователя:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Загрузка аватара
router.post('/avatar', upload.single('avatar'), async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Файл не загружен' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Удалить старый аватар если существует
    if (user.avatar) {
      const oldAvatarPath = path.join(__dirname, '..', user.avatar);
      if (fs.existsSync(oldAvatarPath)) {
        fs.unlinkSync(oldAvatarPath);
      }
    }

    // Сохранить путь к новому аватару
    user.avatar = `/uploads/avatars/${req.file.filename}`;
    await user.save();

    res.json({
      avatar: user.avatar,
      message: 'Аватар успешно загружен'
    });
  } catch (error) {
    console.error('Ошибка загрузки аватара:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Обновление отображаемого имени
router.patch('/displayname', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const { displayName } = req.body;

    if (!displayName || displayName.trim() === '') {
      return res.status(400).json({ error: 'Отображаемое имя не может быть пустым' });
    }

    if (displayName.length > 32) {
      return res.status(400).json({ error: 'Отображаемое имя не может превышать 32 символа' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    user.displayName = displayName.trim();
    await user.save();

    res.json({
      displayName: user.displayName,
      message: 'Отображаемое имя успешно обновлено'
    });
  } catch (error) {
    console.error('Ошибка обновления имени:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Назначение тега пользователю (только для puncher)
router.post('/assign-badge', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      console.warn('[SECURITY] Попытка назначить тег без токена');
      return res.status(401).json({ error: 'Не авторизован' });
    }

    // Верификация токена
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      console.warn('[SECURITY] Попытка с невалидным токеном:', err.message);
      return res.status(401).json({ error: 'Невалидный токен' });
    }

    const adminUser = await User.findById(decoded.userId);

    if (!adminUser) {
      console.warn('[SECURITY] Попытка назначить тег с несуществующим userId:', decoded.userId);
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // СТРОГАЯ ПРОВЕРКА: проверяем И username И что это реально puncher из БД
    if (adminUser.username !== 'puncher') {
      console.warn(`[SECURITY] Попытка назначить тег от пользователя ${adminUser.username} (userId: ${adminUser._id})`);
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    // Дополнительная проверка: userId из токена должен совпадать с найденным пользователем
    if (decoded.userId !== adminUser._id.toString()) {
      console.error('[SECURITY] КРИТИЧНО: Несоответствие userId в токене и БД');
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    const { username, badge, badgeTooltip } = req.body;

    if (!username) {
      return res.status(400).json({ error: 'Username обязателен' });
    }

    if (!badge || badge.trim() === '') {
      return res.status(400).json({ error: 'Badge обязателен' });
    }

    if (badge.trim().length > 4) {
      return res.status(400).json({ error: 'Тег не может превышать 4 символа' });
    }

    // Защита от самоназначения (опционально, можете убрать если нужно менять себе тег)
    if (username.trim() === adminUser.username) {
      console.warn('[SECURITY] Попытка самоназначения тега');
      return res.status(400).json({ error: 'Нельзя назначить тег самому себе' });
    }

    // Найти пользователя по username
    const targetUser = await User.findOne({ username: username.trim() });

    if (!targetUser) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Логирование успешного назначения
    console.log(`[ADMIN] ${adminUser.username} назначил тег "${badge}" пользователю ${targetUser.username} (${targetUser._id})`);

    // Обновить badge и badgeTooltip
    targetUser.badge = badge.trim();
    targetUser.badgeTooltip = badgeTooltip?.trim() || badge.trim();
    await targetUser.save();

    res.json({
      success: true,
      message: `Тег "${badge}" успешно назначен пользователю ${username}`,
      user: {
        id: targetUser._id,
        username: targetUser.username,
        badge: targetUser.badge,
        badgeTooltip: targetUser.badgeTooltip
      }
    });
  } catch (error) {
    console.error('[ERROR] Ошибка назначения тега:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;

