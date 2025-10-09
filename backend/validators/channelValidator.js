const { ValidationError } = require('../utils/errors');
const { CHANNEL_NAME_MAX_LENGTH, CHANNEL_TYPES } = require('../constants');

const validateChannelData = (data) => {
  const { name, type } = data;

  if (!name || typeof name !== 'string') {
    throw new ValidationError('Название канала обязательно');
  }

  const trimmedName = name.trim();
  
  if (trimmedName.length === 0) {
    throw new ValidationError('Название канала не может быть пустым');
  }

  if (trimmedName.length > CHANNEL_NAME_MAX_LENGTH) {
    throw new ValidationError(`Название канала слишком длинное (макс. ${CHANNEL_NAME_MAX_LENGTH} символов)`);
  }

  if (type && !Object.values(CHANNEL_TYPES).includes(type)) {
    throw new ValidationError('Неверный тип канала');
  }

  return {
    name: trimmedName,
    type: type || CHANNEL_TYPES.TEXT
  };
};

module.exports = {
  validateChannelData
};

