/**
 * Утилита для объединения данных пользователя из разных источников
 * Приоритет: globalOnlineUsers (актуальные) > исходные данные (старые)
 */

/**
 * Получить актуальные данные пользователя
 * @param {Object} sourceData - исходные данные (из message, member и т.д.)
 * @param {Array} globalOnlineUsers - массив онлайн пользователей
 * @returns {Object} - объединенные данные с актуальным avatar/displayName
 */
export function getMergedUserData(sourceData, globalOnlineUsers) {
  if (!sourceData) return null;

  const userId = sourceData.userId || sourceData.id || sourceData._id;

  // Если нет userId, возвращаем исходные данные
  if (!userId) return sourceData;

  // Ищем актуальные данные в globalOnlineUsers
  const onlineUser = globalOnlineUsers.find(u =>
    (u.userId || u.id || u._id) === userId
  );

  // Если пользователь онлайн, используем актуальные данные
  if (onlineUser) {
    return {
      ...sourceData,
      avatar: onlineUser.avatar,
      displayName: onlineUser.displayName,
      badge: onlineUser.badge,
      badgeTooltip: onlineUser.badgeTooltip
    };
  }

  // Если оффлайн, возвращаем исходные данные
  return sourceData;
}

/**
 * Обновить массив сообщений с актуальными данными пользователей
 * @param {Array} messages - массив сообщений
 * @param {Array} globalOnlineUsers - массив онлайн пользователей
 * @returns {Array} - обновленный массив сообщений
 */
export function mergeMessagesWithLiveUsers(messages, globalOnlineUsers) {
  if (!messages || !Array.isArray(messages)) return messages;
  if (!globalOnlineUsers || !Array.isArray(globalOnlineUsers)) return messages;

  return messages.map(message => {
    const mergedData = getMergedUserData(message, globalOnlineUsers);
    return mergedData || message;
  });
}

