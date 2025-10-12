const { ValidationError } = require('../utils/errors');
const { MESSAGE_MAX_LENGTH } = require('../constants');

const validateMessageContent = (content, hasAttachments = false) => {
  // Если есть вложения, разрешаем пустой content
  if (hasAttachments && (!content || content.trim().length === 0)) {
    return ''; // Возвращаем пустую строку, если есть файлы
  }

  if (!content || typeof content !== 'string') {
    throw new ValidationError('Содержимое сообщения обязательно');
  }

  const trimmedContent = content.trim();

  if (trimmedContent.length === 0) {
    throw new ValidationError('Сообщение не может быть пустым');
  }

  if (trimmedContent.length > MESSAGE_MAX_LENGTH) {
    throw new ValidationError(`Сообщение слишком длинное (макс. ${MESSAGE_MAX_LENGTH} символов)`);
  }

  return trimmedContent;
};

const canEditMessage = (message) => {
  const messageTime = new Date(message.createdAt);
  const now = new Date();
  const diffInHours = (now - messageTime) / (1000 * 60 * 60);

  return diffInHours <= 24;
};

module.exports = {
  validateMessageContent,
  canEditMessage
};

