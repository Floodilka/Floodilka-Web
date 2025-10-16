/**
 * Утилиты для работы с сообщениями
 */

/**
 * Группировка сообщений как в Discord
 * @param {Array} messages - массив сообщений
 * @param {Object} options - опции группировки
 * @returns {Array} сгруппированные сообщения
 */
export const groupMessages = (messages, { thresholdMs = 60_000 } = {}) => {
  if (!Array.isArray(messages) || messages.length === 0) return [];

  const grouped = [];
  let currentGroup = null;

  for (const msg of messages) {
    const t = new Date(msg.timestamp);
    const dayKey = t.getFullYear() + '-' + (t.getMonth()+1) + '-' + t.getDate();

    const needNewGroup =
      !currentGroup ||
      currentGroup.username !== msg.username ||
      currentGroup.dayKey !== dayKey ||
      (t - new Date(currentGroup.lastTimestamp)) > thresholdMs ||
      msg.isSystem;

    if (needNewGroup) {
      currentGroup = {
        username: msg.username,
        userId: msg.userId,
        dayKey,
        date: new Date(t.getFullYear(), t.getMonth(), t.getDate()).toDateString(),
        messages: [msg],
        firstTimestamp: msg.timestamp,
        lastTimestamp: msg.timestamp,
        isOwn: false, // будет переопределено в компоненте
      };
      grouped.push(currentGroup);
    } else {
      currentGroup.messages.push(msg);
      currentGroup.lastTimestamp = msg.timestamp;
    }
  }

  return grouped;
};

/**
 * Форматирование времени
 * @param {string|Date} timestamp - временная метка
 * @returns {string} отформатированное время
 */
export const formatTime = (timestamp) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Форматирование даты в русском формате
 * @param {string} dateString - строка даты
 * @returns {string} отформатированная дата
 */
export const formatDate = (dateString) => {
  const date = new Date(dateString);
  const months = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
  ];

  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();

  return `${day} ${month} ${year} г.`;
};

/**
 * Обрезка текста
 * @param {string} text - текст для обрезки
 * @param {number} limit - максимальная длина
 * @returns {string} обрезанный текст
 */
export const truncateText = (text, limit = 120) => {
  if (!text) return '';
  return text.length > limit ? `${text.slice(0, limit).trim()}…` : text;
};

/**
 * Получение превью для ответа на сообщение
 * @param {Object} message - сообщение
 * @returns {string} превью сообщения
 */
export const getReplySnippetFromMessage = (message) => {
  if (!message) return '';
  if (message.content) {
    return truncateText(message.content);
  }
  if (Array.isArray(message.attachments) && message.attachments.length > 0) {
    const attachment = message.attachments[0];
    if (attachment?.mimetype?.startsWith('image/')) {
      return '📷 Изображение';
    }
    return `📎 ${attachment?.originalName || 'Вложение'}`;
  }
  return 'Без текста';
};

/**
 * Получение превью для мета-данных ответа
 * @param {Object} replyMeta - мета-данные ответа
 * @returns {string} превью ответа
 */
export const getReplySnippetFromMeta = (replyMeta) => {
  if (!replyMeta) return '';
  if (replyMeta.isSystem) {
    return 'Системное сообщение';
  }
  if (replyMeta.content) {
    return truncateText(replyMeta.content);
  }
  if (replyMeta.hasAttachments) {
    if (replyMeta.attachmentPreview?.mimetype?.startsWith('image/')) {
      return '📷 Изображение';
    }
    return `📎 ${replyMeta.attachmentPreview?.originalName || 'Вложение'}`;
  }
  return 'Без текста';
};

/**
 * Создание снапшота сообщения для ответа
 * @param {Object} message - сообщение
 * @returns {Object} снапшот сообщения
 */
export const buildReplySnapshot = (message) => ({
  id: message.id,
  username: message.username,
  displayName: message.displayName,
  content: message.content,
  attachments: message.attachments || []
});

/**
 * Проверка, упомянут ли пользователь в сообщении
 * @param {Object} message - сообщение
 * @param {string} username - имя пользователя
 * @returns {boolean} упомянут ли пользователь
 */
export const isUserMentioned = (message, username) => {
  if (!message.mentions || !username) return false;

  return message.mentions.some(mention => {
    if (mention.type === 'everyone') {
      return true;
    }
    if (mention.type === 'user' && mention.username) {
      return mention.username.toLowerCase() === username.toLowerCase();
    }
    return false;
  });
};

/**
 * Проверка блокировки пользователя
 * @param {Object} targetUser - целевой пользователь
 * @param {Object} currentUser - текущий пользователь
 * @returns {boolean} заблокирован ли пользователь
 */
export const isUserBlocked = (targetUser, currentUser) => {
  if (!targetUser || !currentUser || !currentUser.blockedUsers) {
    return false;
  }

  const targetUserId = targetUser.userId || targetUser.id || targetUser._id;
  if (!targetUserId) return false;

  return currentUser.blockedUsers.some(blockedUser => {
    const blockedUserId = blockedUser.userId?._id || blockedUser.userId;
    return blockedUserId && blockedUserId.toString() === targetUserId.toString();
  });
};

/**
 * Проверка возможности редактирования сообщения
 * @param {Object} message - сообщение
 * @param {string} username - имя текущего пользователя
 * @returns {boolean} можно ли редактировать
 */
export const canEditMessage = (message, username) => {
  if (message.username !== username) return false;
  if (message.isSystem) return false;

  const messageTime = new Date(message.timestamp);
  const now = new Date();
  const diffInHours = (now - messageTime) / (1000 * 60 * 60);

  return diffInHours <= 24;
};

/**
 * Проверка возможности удаления сообщения
 * @param {Object} message - сообщение
 * @param {string} username - имя текущего пользователя
 * @param {Object} userPermissions - права пользователя
 * @returns {boolean} можно ли удалить
 */
export const canDeleteMessage = (message, username, userPermissions) => {
  if (message.isSystem) return false;

  // Можно удалить свое сообщение
  if (message.username === username) return true;

  // Проверяем права администратора
  if (userPermissions && (
    userPermissions.manageMessages ||
    userPermissions.manageServer ||
    userPermissions.isOwner
  )) {
    return true;
  }

  return false;
};
