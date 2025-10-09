import { useEffect } from 'react';
import socketService from '../services/socket';
import { useChat } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';

export const useChannel = () => {
  const { currentTextChannel, setMessages } = useChat();
  const { user } = useAuth();

  console.log('🎯 useChannel вызван, currentTextChannel:', currentTextChannel, 'user:', user);

  useEffect(() => {
    console.log('🔄 useChannel effect:', {
      hasChannel: !!currentTextChannel,
      hasUser: !!user,
      channelId: currentTextChannel?.id,
      channelType: currentTextChannel?.type,
      userId: user?.id
    });

    if (currentTextChannel && user) {
      console.log('✅ Условие выполнено, присоединяемся к каналу');
      setMessages([]);

      socketService.joinChannel({
        channelId: currentTextChannel.id,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
        badge: user.badge,
        badgeTooltip: user.badgeTooltip,
        userId: user.id
      });
    } else {
      console.log('❌ Условие НЕ выполнено:', {
        currentTextChannel,
        user
      });
    }
  }, [currentTextChannel, user, setMessages]);

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

