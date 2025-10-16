/**
 * Утилиты для работы с блокировкой пользователей
 */

// Проверка, заблокирован ли пользователь
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

// Обновление статуса блокировки в списке разговоров
export const updateConversationBlockStatus = (directMessages, targetId, status) => {
  if (!targetId) return directMessages;

  return directMessages.map(dm => {
    if (!dm) return dm;

    const dmUserId = dm._id || dm.user?._id;
    if (dmUserId && dmUserId.toString() === targetId.toString()) {
      return {
        ...dm,
        blockStatus: status || null
      };
    }

    return dm;
  });
};

// Получение ID целевого пользователя
export const getTargetUserId = (selectedDM, autoSelectUser) => {
  return selectedDM?.user?._id ||
         selectedDM?._id ||
         autoSelectUser?.user?._id ||
         autoSelectUser?._id;
};
