import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import apiService from '../services/api';

const ChatContext = createContext();

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within ChatProvider');
  }
  return context;
};

const MAX_CACHE_SIZE = 20; // Максимум 20 каналов в кеше

export const ChatProvider = ({ children }) => {
  const [currentTextChannel, setCurrentTextChannel] = useState(null);
  const [messages, setMessagesState] = useState([]);
  const setMessages = setMessagesState;
  const [showDirectMessages, setShowDirectMessages] = useState(false);
  const [autoSelectUser, setAutoSelectUser] = useState(null);
  const [hasUnreadDMs, setHasUnreadDMs] = useState(false);
  const [preloadedMessages, setPreloadedMessages] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [messagesCache, setMessagesCache] = useState({});

  // Refs для доступа к актуальным значениям без пересоздания колбеков
  const currentTextChannelRef = useRef(null);
  const messagesRef = useRef([]);
  const loadIdRef = useRef(0);

  // Обновляем refs при изменении state
  currentTextChannelRef.current = currentTextChannel;
  messagesRef.current = messages;

  // Функция для создания ключа кеша
  const getCacheKey = useCallback((serverId, channelId) => {
    return `${serverId || 'undefined'}:${channelId}`;
  }, []);

  // Функция для очистки старых записей кеша
  const cleanupCache = useCallback((cache) => {
    const entries = Object.entries(cache);
    const sorted = entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
    const cleaned = Object.fromEntries(sorted.slice(0, MAX_CACHE_SIZE));

    return cleaned;
  }, []);

  const selectTextChannel = useCallback((channel, shouldRestoreScrollFlag, serverId) => {
    // Создаем ключ кэша с учетом serverId
    const cacheKey = getCacheKey(serverId, channel?.id);
    const cached = messagesCache[cacheKey];

    // ВАЖНО: НЕ используем кеш с 0 сообщениями, если это не новый канал
    // Это предотвращает затирание реальных сообщений пустым кешем
    const shouldUseCache = cached && Array.isArray(cached.messages) && cached.messages.length > 0;

    if (shouldUseCache) {
      setMessages(cached.messages);
      setPreloadedMessages(true);
      setIsLoadingMessages(false);
    } else {
      setIsLoadingMessages(true);
      setPreloadedMessages(false);
    }

    setCurrentTextChannel(channel);
    setShowDirectMessages(false);
  }, [messagesCache, getCacheKey, setMessages]);

  const selectDirectMessages = useCallback(() => {
    setCurrentTextChannel(null);
    setShowDirectMessages(true);
  }, []);

  const exitDirectMessages = useCallback(() => {
    setShowDirectMessages(false);
  }, []);

  const clearAutoSelectUser = useCallback(() => {
    setAutoSelectUser(null);
  }, []);

  const clearChannelState = useCallback((serverId) => {
    const currentChannel = currentTextChannelRef.current;
    const currentMessages = messagesRef.current;

    // Сохраняем текущие сообщения в кеш перед очисткой ТОЛЬКО если есть сообщения
    if (currentChannel?.id && currentMessages.length > 0 && serverId) {
      const cacheKey = getCacheKey(serverId, currentChannel.id);
      setMessagesCache(cache => {
        const newCache = {
          ...cache,
          [cacheKey]: {
            messages: currentMessages,
            timestamp: Date.now()
          }
        };
        return cleanupCache(newCache);
      });
    }

    setCurrentTextChannel(null);

    // НЕ очищаем сообщения если serverId undefined - это означает смену сервера
    // и сообщения уже загружаются для нового канала
    if (serverId !== undefined) {
      setMessages([]);
    }

    setPreloadedMessages(false);
    setIsLoadingMessages(false);
  }, [cleanupCache, getCacheKey, setMessages]);

  const clearServerCache = useCallback(() => {
    setMessagesCache({});
    setCurrentTextChannel(null);
    setMessages([]);
    setPreloadedMessages(false);
    setIsLoadingMessages(false);
  }, [setMessages]);

  const sendMessage = useCallback(async (content, files = []) => {
    if (!currentTextChannelRef.current) return;

    const messageData = {
      content,
      files,
      channelId: currentTextChannelRef.current.id
    };

    try {
      await apiService.sendMessage(messageData);
    } catch (error) {
      console.error('Ошибка отправки сообщения:', error);
      throw error;
    }
  }, []);

  const addMessage = useCallback((message) => {
    setMessages(prev => [...prev, message]);
  }, [setMessages]);

  const editMessage = useCallback((messageId, content) => {
    setMessages(prev => prev.map(msg =>
      msg.id === messageId ? { ...msg, content } : msg
    ));
  }, [setMessages]);

  const deleteMessage = useCallback((messageId) => {
    setMessages(prev => prev.filter(msg => msg.id !== messageId));
  }, [setMessages]);

  const updateMessageReactions = useCallback((messageId, reactions) => {
    setMessages(prev => prev.map(msg =>
      msg.id === messageId ? { ...msg, reactions } : msg
    ));
  }, [setMessages]);

  const preloadChannelMessages = useCallback(async (channelId, serverId) => {
    // Защита от гонок: увеличиваем ID запроса
    const loadId = ++loadIdRef.current;

    // Используем ref для проверки кеша без зависимости
    let cacheChecked = false;
    const cacheKey = getCacheKey(serverId, channelId);

    // Проверяем кеш перед загрузкой
    setMessagesCache(prevCache => {
      const cached = prevCache[cacheKey];

      // ВАЖНО: НЕ используем пустой кеш! Загружаем заново если кеш пуст
      if (cached && cached.messages && cached.messages.length > 0) {
        // НЕ вызываем setMessages здесь - это может вызвать гонки
        cacheChecked = true;
        return prevCache; // Возвращаем старый кеш без изменений
      }
      return prevCache;
    });

    // Если кеш был найден, устанавливаем сообщения ВНЕ setMessagesCache
    if (cacheChecked) {
      const cached = messagesCache[cacheKey];
      if (cached && cached.messages && cached.messages.length > 0) {
        setMessages(cached.messages);
        setPreloadedMessages(true);
        setIsLoadingMessages(false);
      }
      return;
    }

    setIsLoadingMessages(true);
    try {
      const messagesData = await apiService.getChannelMessages(channelId);

      // Проверяем, не устарел ли запрос
      if (loadId !== loadIdRef.current) {
        return;
      }

      const messagesArray = Array.isArray(messagesData) ? messagesData : [];

      setMessages(messagesArray);
      setPreloadedMessages(true);

      // Сохраняем в кеш ТОЛЬКО если есть сообщения
      if (messagesArray.length > 0) {
        setMessagesCache(prevCache => {
          const newCache = {
            ...prevCache,
            [cacheKey]: {
              messages: messagesArray,
              timestamp: Date.now()
            }
          };
          return cleanupCache(newCache);
        });
      }

    } catch (err) {
      // Проверяем, не устарел ли запрос
      if (loadId !== loadIdRef.current) {
        return;
      }

      console.error('Ошибка предзагрузки сообщений:', err);
      setMessages([]);
      setIsLoadingMessages(false);
    }
  }, [cleanupCache, getCacheKey, messagesCache, setMessages]);

  const value = {
    currentTextChannel,
    messages,
    showDirectMessages,
    autoSelectUser,
    hasUnreadDMs,
    preloadedMessages,
    isLoadingMessages,
    selectTextChannel,
    selectDirectMessages,
    exitDirectMessages,
    sendMessage,
    clearAutoSelectUser,
    clearChannelState,
    clearServerCache,
    setMessages,
    addMessage,
    editMessage,
    deleteMessage,
    updateMessageReactions,
    setHasUnreadDMs,
    preloadChannelMessages,
    setIsLoadingMessages,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};