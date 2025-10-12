import { useEffect, useRef } from 'react';
import socketService from '../services/socket';
import { useChat } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/api';

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

  const sendMessage = async (content, files = []) => {
    if (!currentTextChannel || !user) return;

    // Если есть файлы, сначала загружаем их
    if (files && files.length > 0) {
      try {
        const formData = new FormData();
        files.forEach(file => {
          formData.append('files', file);
        });

        const uploadResult = await apiService.uploadMessageFiles(formData);

        // Отправляем сообщение с файлами через сокет
        socketService.sendMessage({
          channelId: currentTextChannel.id,
          content,
          username: user.username,
          displayName: user.displayName,
          avatar: user.avatar,
          badge: user.badge,
          badgeTooltip: user.badgeTooltip,
          userId: user.id,
          attachments: uploadResult.files
        });
      } catch (error) {
        console.error('Ошибка загрузки файлов:', error);
        alert('Ошибка загрузки файлов: ' + error.message);
      }
    } else {
      // Обычная отправка текстового сообщения
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

