const jwt = require('jsonwebtoken');
const config = require('../config/env');

const authenticateToken = (req, res, next) => {
  try {
    const headerToken = req.headers.authorization?.split(' ')[1];
    const cookieToken = req.signedCookies?.[config.jwtCookie.name] || req.cookies?.[config.jwtCookie.name];
    const token = headerToken || cookieToken;

    if (!token) {
      return res.status(401).json({ error: 'Токен не предоставлен' });
    }

    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = { id: decoded.userId, username: decoded.username };
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Неверный токен' });
  }
};

module.exports = { authenticateToken };
