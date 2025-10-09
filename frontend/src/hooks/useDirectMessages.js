import { useState, useEffect, useCallback } from 'react';
import apiService from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';

export const useDirectMessages = () => {
  const { user } = useAuth();
  const { showDirectMessages, setHasUnreadDMs } = useChat();
  const [loading, setLoading] = useState(false);

  const loadUnreadDMs = useCallback(async () => {
    if (!user) return;

    try {
      const conversations = await apiService.getConversations();
      const hasUnread = conversations.some(conv => conv.unreadCount > 0);
      setHasUnreadDMs(hasUnread);
    } catch (err) {
      console.error('Ошибка загрузки непрочитанных сообщений:', err);
    }
  }, [user, setHasUnreadDMs]);

  // Загрузка непрочитанных сообщений при входе
  useEffect(() => {
    if (user && !showDirectMessages) {
      loadUnreadDMs();
    }
  }, [user, showDirectMessages, loadUnreadDMs]);

  const sendDirectMessage = async (receiverId, content) => {
    try {
      setLoading(true);
      await apiService.sendDirectMessage(receiverId, content);
    } catch (err) {
      console.error('Ошибка отправки личного сообщения:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getConversation = async (userId, page = 1, limit = 50) => {
    try {
      setLoading(true);
      const messages = await apiService.getConversation(userId, page, limit);
      return messages;
    } catch (err) {
      console.error('Ошибка загрузки разговора:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getConversations = async () => {
    try {
      setLoading(true);
      const conversations = await apiService.getConversations();
      return conversations;
    } catch (err) {
      console.error('Ошибка загрузки списка разговоров:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (userId) => {
    try {
      await apiService.markMessagesAsRead(userId);
      await loadUnreadDMs();
    } catch (err) {
      console.error('Ошибка отметки сообщений как прочитанных:', err);
      throw err;
    }
  };

  return {
    loading,
    sendDirectMessage,
    getConversation,
    getConversations,
    markAsRead,
    loadUnreadDMs
  };
};

