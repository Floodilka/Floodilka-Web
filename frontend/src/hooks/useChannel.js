import { useEffect, useRef } from 'react';
import socketService from '../services/socket';
import { useChat } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';

export const useChannel = () => {
  const { currentTextChannel } = useChat();
  const { user } = useAuth();
  const lastJoinedChannelRef = useRef(null);

  useEffect(() => {
    if (currentTextChannel && user) {
      // Не присоединяемся повторно к тому же каналу
      if (lastJoinedChannelRef.current === currentTextChannel.id) {
        return;
      }

      lastJoinedChannelRef.current = currentTextChannel.id;

      socketService.joinChannel({
        channelId: currentTextChannel.id,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
        badge: user.badge,
        badgeTooltip: user.badgeTooltip,
        userId: user.id
      });
    }
    // НЕ сбрасываем lastJoinedChannelRef когда канал null - сохраняем последний ID!
  }, [currentTextChannel, user]);

  const sendMessage = (content) => {
    if (currentTextChannel && user) {
      socketService.sendMessage({
        channelId: currentTextChannel.id,
        content,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
        badge: user.badge,
        badgeTooltip: user.badgeTooltip,
        userId: user.id
      });
    }
  };

  return { sendMessage };
};

