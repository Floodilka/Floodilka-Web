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
      password,
      displayName: username
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
        badgeTooltip: user.badgeTooltip,
        blockedUsers: user.blockedUsers || []
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
      status: user.status,
      blockedUsers: user.blockedUsers || []
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
      blockedUsers: user.blockedUsers || [],
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

    // Разрешаем админу назначать теги самому себе

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

// Получить список всех онлайн пользователей (публичный эндпоинт для мониторинга)
router.get('/users/online', async (req, res) => {
  try {
    // Найти всех пользователей со статусом 'online'
    const onlineUsers = await User.find({ status: 'online' })
      .select('username displayName avatar badge badgeTooltip status')
      .sort({ username: 1 });

    const totalUsers = await User.countDocuments();
    const onlineCount = onlineUsers.length;

    // Красивый HTML-ответ
    const html = `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Болтушка - Онлайн пользователи</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
      color: #333;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
    }
    .header {
      background: white;
      border-radius: 12px;
      padding: 30px;
      margin-bottom: 20px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.1);
      text-align: center;
    }
    .header h1 {
      color: #667eea;
      font-size: 2.5em;
      margin-bottom: 10px;
    }
    .stats {
      display: flex;
      gap: 20px;
      justify-content: center;
      margin-top: 20px;
    }
    .stat-card {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px 30px;
      border-radius: 10px;
      text-align: center;
      min-width: 150px;
    }
    .stat-card .number {
      font-size: 2.5em;
      font-weight: bold;
      margin-bottom: 5px;
    }
    .stat-card .label {
      font-size: 0.9em;
      opacity: 0.9;
    }
    .users-list {
      background: white;
      border-radius: 12px;
      padding: 30px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.1);
    }
    .users-list h2 {
      color: #667eea;
      margin-bottom: 20px;
      font-size: 1.5em;
    }
    .user-item {
      display: flex;
      align-items: center;
      padding: 15px;
      margin-bottom: 10px;
      background: #f8f9fa;
      border-radius: 8px;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .user-item:hover {
      transform: translateX(5px);
      box-shadow: 0 5px 15px rgba(0,0,0,0.1);
    }
    .user-avatar {
      width: 50px;
      height: 50px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: 1.2em;
      margin-right: 15px;
      position: relative;
    }
    .user-avatar img {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      object-fit: cover;
    }
    .online-indicator {
      position: absolute;
      bottom: 2px;
      right: 2px;
      width: 12px;
      height: 12px;
      background: #00ff00;
      border: 2px solid white;
      border-radius: 50%;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    .user-info {
      flex: 1;
    }
    .user-name {
      font-weight: 600;
      font-size: 1.1em;
      color: #333;
      margin-bottom: 3px;
    }
    .user-username {
      color: #666;
      font-size: 0.9em;
    }
    .user-badge {
      background: linear-gradient(135deg, #ffd700 0%, #ffed4e 100%);
      color: #333;
      padding: 4px 10px;
      border-radius: 5px;
      font-size: 0.75em;
      font-weight: bold;
      margin-left: 10px;
    }
    .empty-state {
      text-align: center;
      padding: 40px;
      color: #999;
    }
    .empty-state-icon {
      font-size: 4em;
      margin-bottom: 10px;
    }
    .refresh-btn {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      padding: 12px 30px;
      border-radius: 8px;
      font-size: 1em;
      font-weight: 600;
      cursor: pointer;
      margin-top: 20px;
      transition: transform 0.2s;
    }
    .refresh-btn:hover {
      transform: scale(1.05);
    }
    .timestamp {
      text-align: center;
      color: white;
      margin-top: 20px;
      opacity: 0.8;
      font-size: 0.9em;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎙️ Болтушка</h1>
      <p>Мониторинг онлайн пользователей</p>
      <div class="stats">
        <div class="stat-card">
          <div class="number">${onlineCount}</div>
          <div class="label">Онлайн</div>
        </div>
        <div class="stat-card">
          <div class="number">${totalUsers}</div>
          <div class="label">Всего пользователей</div>
        </div>
      </div>
    </div>

    <div class="users-list">
      <h2>Пользователи онлайн</h2>
      ${onlineUsers.length > 0 ? onlineUsers.map(user => `
        <div class="user-item">
          <div class="user-avatar">
            ${user.avatar
              ? `<img src="${user.avatar}" alt="${user.username}">`
              : user.username.charAt(0).toUpperCase()
            }
            <div class="online-indicator"></div>
          </div>
          <div class="user-info">
            <div class="user-name">${user.displayName || user.username}</div>
            <div class="user-username">@${user.username}</div>
          </div>
          ${user.badge && user.badge !== 'User'
            ? `<span class="user-badge" title="${user.badgeTooltip || user.badge}">${user.badge}</span>`
            : ''
          }
        </div>
      `).join('') : `
        <div class="empty-state">
          <div class="empty-state-icon">😴</div>
          <p>Никого нет онлайн</p>
        </div>
      `}
      <center>
        <button class="refresh-btn" onclick="location.reload()">🔄 Обновить</button>
      </center>
    </div>

    <div class="timestamp">
      Обновлено: ${new Date().toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })}
    </div>
  </div>

  <script>
    // Автоматическое обновление каждые 30 секунд
    setTimeout(() => {
      location.reload();
    }, 30000);
  </script>
</body>
</html>`;

    res.send(html);
  } catch (error) {
    console.error('Ошибка получения онлайн пользователей:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получить список онлайн пользователей в формате JSON
router.get('/users/online/json', async (req, res) => {
  try {
    const onlineUsers = await User.find({ status: 'online' })
      .select('username displayName avatar badge badgeTooltip status')
      .sort({ username: 1 });

    const totalUsers = await User.countDocuments();

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      stats: {
        online: onlineUsers.length,
        total: totalUsers,
        percentage: totalUsers > 0 ? ((onlineUsers.length / totalUsers) * 100).toFixed(1) : 0
      },
      users: onlineUsers.map(user => ({
        id: user._id,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
        badge: user.badge,
        badgeTooltip: user.badgeTooltip,
        status: user.status
      }))
    });
  } catch (error) {
    console.error('Ошибка получения онлайн пользователей:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;

