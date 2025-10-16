/**
 * Утилиты для работы с сообщениями в DirectMessages
 */

// Форматирование времени
export const formatTime = (timestamp) => {
  return new Date(timestamp).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Обрезка текста
export const truncateText = (text, limit = 120) => {
  if (!text) return '';
  return text.length > limit ? `${text.slice(0, limit).trim()}…` : text;
};

// Получение сниппета ответа из сообщения
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

// Получение сниппета ответа из метаданных
export const getReplySnippetFromMeta = (replyMeta) => {
  if (!replyMeta) return '';
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

// Построение снапшота ответа
export const buildReplySnapshot = (message) => ({
  id: message._id,
  sender: {
    username: message.sender.username,
    displayName: message.sender.displayName
  },
  username: message.sender.username,
  displayName: message.sender.displayName,
  content: message.content,
  attachments: message.attachments || []
});

// Проверка, может ли пользователь редактировать сообщение
export const canEditMessage = (message, userId) => {
  if (message.sender._id !== userId) return false;
  return true;
};

// Проверка, может ли пользователь удалить сообщение
export const canDeleteMessage = (message, userId) => {
  if (message.sender._id !== userId) return false;
  return true;
};

// Группировка сообщений как в Discord
export const groupMessages = (messages, { thresholdMs = 60_000, userId } = {}) => {
  if (!Array.isArray(messages) || messages.length === 0) return [];

  const grouped = [];
  let currentGroup = null;

  for (const msg of messages) {
    const t = new Date(msg.timestamp);
    const dayKey = t.getFullYear() + '-' + (t.getMonth()+1) + '-' + t.getDate();

    const needNewGroup =
      !currentGroup ||
      currentGroup.senderId !== msg.sender._id ||
      currentGroup.dayKey !== dayKey ||
      (t - new Date(currentGroup.lastTimestamp)) > thresholdMs ||
      msg.isSystem;

    if (needNewGroup) {
      currentGroup = {
        senderId: msg.sender._id,
        sender: msg.sender,
        dayKey,
        date: new Date(t.getFullYear(), t.getMonth(), t.getDate()).toDateString(),
        messages: [msg],
        firstTimestamp: msg.timestamp,
        lastTimestamp: msg.timestamp,
        isOwn: msg.sender._id === userId,
      };
      grouped.push(currentGroup);
    } else {
      currentGroup.messages.push(msg);
      currentGroup.lastTimestamp = msg.timestamp;
    }
  }

  return grouped;
};

// Форматирование даты в русском формате
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
