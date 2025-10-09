import { useEffect } from 'react';
import socketService from '../services/socket';
import { useChat } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';

export const useChannel = () => {
  const { currentTextChannel, setMessages } = useChat();
  const { user } = useAuth();

  useEffect(() => {
    if (currentTextChannel && user) {
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
    }
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

