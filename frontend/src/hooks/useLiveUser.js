import { useState, useEffect } from 'react';
import { useGlobalUsers } from '../context/GlobalUsersContext';

/**
 * Хук для получения актуальных данных пользователя в реальном времени
 * Автоматически обновляется при изменении avatar/displayName через GLOBAL_USERS_UPDATE
 * 
 * @param {Object} initialUser - начальные данные пользователя
 * @returns {Object} - актуальные данные пользователя
 */
export function useLiveUser(initialUser) {
  const { globalOnlineUsers } = useGlobalUsers();
  const [liveUser, setLiveUser] = useState(initialUser);

  useEffect(() => {
    if (!initialUser) {
      setLiveUser(null);
      return;
    }

    // Ищем актуальные данные пользователя в globalOnlineUsers
    const userId = initialUser.userId || initialUser.id || initialUser._id;
    if (!userId) {
      setLiveUser(initialUser);
      return;
    }

    const onlineUser = globalOnlineUsers.find(u => 
      (u.userId || u.id || u._id) === userId
    );

    if (onlineUser) {
      // Если пользователь онлайн, используем актуальные данные
      setLiveUser({
        ...initialUser,
        avatar: onlineUser.avatar,
        displayName: onlineUser.displayName,
        badge: onlineUser.badge,
        badgeTooltip: onlineUser.badgeTooltip
      });
    } else {
      // Если оффлайн, используем начальные данные
      setLiveUser(initialUser);
    }
  }, [initialUser, globalOnlineUsers]);

  return liveUser;
}

