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

  const sendMessage = async (content, files = [], replyTo = null) => {
    if (!currentTextChannel || !user) return;

    const replyToMessageId = replyTo?.messageId || replyTo?.id || null;

    // Если есть файлы, сначала загружаем их
    if (files && files.length > 0) {
      try {
        const formData = new FormData();
        files.forEach(file => {
          formData.append('files', file);
        });

        const uploadResult = await apiService.uploadMessageFiles(formData);

        // Отправляем сообщение с файлами через сокет
        const payload = {
          channelId: currentTextChannel.id,
          content,
          username: user.username,
          displayName: user.displayName,
          avatar: user.avatar,
          badge: user.badge,
          badgeTooltip: user.badgeTooltip,
          userId: user.id,
          attachments: uploadResult.files
        };

        if (replyToMessageId) {
          payload.replyToMessageId = replyToMessageId;
        }

        socketService.sendMessage(payload);
      } catch (error) {
        console.error('Ошибка загрузки файлов:', error);
        alert('Ошибка загрузки файлов: ' + error.message);
      }
    } else {
      // Обычная отправка текстового сообщения
      const payload = {
        channelId: currentTextChannel.id,
        content,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
        badge: user.badge,
        badgeTooltip: user.badgeTooltip,
        userId: user.id
      };

      if (replyToMessageId) {
        payload.replyToMessageId = replyToMessageId;
      }

      socketService.sendMessage(payload);
    }
  };

  return { sendMessage };
};
