const logger = require('./logger');

const redact = (value) => {
  if (!value) {
    return value;
  }

  if (typeof value === 'string' && value.length > 64) {
    return `${value.substring(0, 61)}...`;
  }

  return value;
};

const recordAuditEvent = ({ category, action, userId, username, ip, userAgent, metadata = {} }) => {
  const payload = {
    category,
    action,
    userId,
    username,
    ip,
    userAgent: redact(userAgent),
    metadata,
    timestamp: new Date().toISOString()
  };

  logger.info('[AUDIT]', JSON.stringify(payload));
};

const recordAuthEvent = (event) => recordAuditEvent({ category: 'auth', ...event });

module.exports = {
  recordAuditEvent,
  recordAuthEvent
};
