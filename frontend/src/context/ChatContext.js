import React, { createContext, useContext, useState, useCallback } from 'react';
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
  const [messages, setMessages] = useState([]);
  const [showDirectMessages, setShowDirectMessages] = useState(false);
  const [autoSelectUser, setAutoSelectUser] = useState(null);
  const [hasUnreadDMs, setHasUnreadDMs] = useState(false);
  const [preloadedMessages, setPreloadedMessages] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  // Кеш сообщений для каналов: { channelId: { messages: [], scrollPosition: number, timestamp: Date } }
  const [messagesCache, setMessagesCache] = useState({});

  // Функция для очистки старых записей из кеша
  const cleanupCache = useCallback((cache) => {
    const entries = Object.entries(cache);
    if (entries.length <= MAX_CACHE_SIZE) {
      return cache;
    }

    // Сортируем по timestamp (новые первыми)
    const sorted = entries.sort((a, b) => b[1].timestamp - a[1].timestamp);

    // Оставляем только MAX_CACHE_SIZE самых свежих
    const cleaned = Object.fromEntries(sorted.slice(0, MAX_CACHE_SIZE));

    return cleaned;
  }, []);

  const selectTextChannel = useCallback((channel, shouldRestoreScrollFlag) => {
    // Проверяем кеш для этого канала
    const cached = messagesCache[channel?.id];
    if (cached && cached.messages) {
      setMessages(cached.messages);
      setPreloadedMessages(true);
      setIsLoadingMessages(false); // НЕ показываем загрузку если есть кеш
    } else {
      setIsLoadingMessages(true);
      setPreloadedMessages(false);
    }

    setCurrentTextChannel(channel);
    setShowDirectMessages(false);
  }, [messagesCache]);

  const selectDirectMessages = useCallback(() => {
    setShowDirectMessages(true);
    setCurrentTextChannel(null);
    setHasUnreadDMs(false);
  }, []);

  const exitDirectMessages = useCallback(() => {
    setShowDirectMessages(false);
  }, []);

  const sendMessage = useCallback((selectedUser) => {
    setAutoSelectUser(selectedUser);
    setShowDirectMessages(true);
    setCurrentTextChannel(null);
  }, []);

  const clearAutoSelectUser = useCallback(() => {
    setAutoSelectUser(null);
  }, []);

  const clearChannelState = useCallback(() => {
    // Сохраняем текущие сообщения в кеш перед очисткой
    if (currentTextChannel?.id && messages.length > 0) {
      setMessagesCache(cache => {
        const oldCache = cache[currentTextChannel.id] || {};
        const newCache = {
          ...cache,
          [currentTextChannel.id]: {
            messages: messages,
            scrollPosition: oldCache.scrollPosition, // СОХРАНЯЕМ scrollPosition из старого кеша!
            timestamp: Date.now()
          }
        };
        return cleanupCache(newCache);
      });
    }

    setCurrentTextChannel(null);
    setMessages([]);
    setPreloadedMessages(false);
    setIsLoadingMessages(false);
  }, [currentTextChannel, messages, cleanupCache]);

  const addMessage = useCallback((message) => {
    setMessages(prev => {
      // Проверяем на дубликаты - если сообщение с таким ID уже есть, не добавляем
      const isDuplicate = prev.some(msg => msg.id === message.id);
      if (isDuplicate) {
        return prev; // Возвращаем массив без изменений
      }

      const updated = [...prev, message];
      // Обновляем кеш для текущего канала
      if (currentTextChannel?.id) {
        setMessagesCache(cache => {
          const oldCache = cache[currentTextChannel.id] || {};
          const newCache = {
            ...cache,
            [currentTextChannel.id]: {
              messages: updated,
              scrollPosition: oldCache.scrollPosition, // Сохраняем scrollPosition
              timestamp: Date.now()
            }
          };
          return cleanupCache(newCache);
        });
      }
      return updated;
    });
  }, [currentTextChannel, cleanupCache]);

  const editMessage = useCallback((editedMessage) => {
    setMessages(prev => {
      const updated = prev.map(msg =>
        msg.id === editedMessage.id ? editedMessage : msg
      );
      // Обновляем кеш для текущего канала
      if (currentTextChannel?.id) {
        setMessagesCache(cache => {
          const oldCache = cache[currentTextChannel.id] || {};
          const newCache = {
            ...cache,
            [currentTextChannel.id]: {
              messages: updated,
              scrollPosition: oldCache.scrollPosition, // Сохраняем scrollPosition
              timestamp: Date.now()
            }
          };
          return cleanupCache(newCache);
        });
      }
      return updated;
    });
  }, [currentTextChannel, cleanupCache]);

  const deleteMessage = useCallback((messageId) => {
    setMessages(prev => {
      const updated = prev.filter(msg => msg.id !== messageId);
      // Обновляем кеш для текущего канала
      if (currentTextChannel?.id) {
        setMessagesCache(cache => {
          const oldCache = cache[currentTextChannel.id] || {};
          const newCache = {
            ...cache,
            [currentTextChannel.id]: {
              messages: updated,
              scrollPosition: oldCache.scrollPosition, // Сохраняем scrollPosition
              timestamp: Date.now()
            }
          };
          return cleanupCache(newCache);
        });
      }
      return updated;
    });
  }, [currentTextChannel, cleanupCache]);

  const updateMessageReactions = useCallback((messageId, reactions) => {
    setMessages(prev => {
      const updated = prev.map(msg =>
        msg.id === messageId ? { ...msg, reactions } : msg
      );
      // Обновляем кеш для текущего канала
      if (currentTextChannel?.id) {
        setMessagesCache(cache => {
          const oldCache = cache[currentTextChannel.id] || {};
          const newCache = {
            ...cache,
            [currentTextChannel.id]: {
              messages: updated,
              scrollPosition: oldCache.scrollPosition, // Сохраняем scrollPosition
              timestamp: Date.now()
            }
          };
          return cleanupCache(newCache);
        });
      }
      return updated;
    });
  }, [currentTextChannel, cleanupCache]);

  const saveScrollPosition = useCallback((scrollPosition, channelId) => {
    // Если channelId передан явно, используем его, иначе берем из currentTextChannel
    const targetChannelId = channelId || currentTextChannel?.id;

    if (!targetChannelId) return;

    setMessagesCache(cache => ({
      ...cache,
      [targetChannelId]: {
        ...cache[targetChannelId],
        messages: cache[targetChannelId]?.messages || messages,
        scrollPosition: scrollPosition,
        timestamp: Date.now()
      }
    }));
  }, [currentTextChannel, messages]);

  const getSavedScrollPosition = useCallback((channelId) => {
    const cached = messagesCache[channelId];
    if (cached && typeof cached.scrollPosition === 'number') {
      return cached.scrollPosition;
    }
    return null;
  }, [messagesCache]);

  const preloadChannelMessages = useCallback(async (channelId, serverId) => {
    // Проверяем кеш перед загрузкой
    setMessagesCache(prevCache => {
      const cached = prevCache[channelId];
      if (cached && cached.messages) {
        setMessages(cached.messages);
        setPreloadedMessages(true);
        setIsLoadingMessages(false);
        return prevCache; // Возвращаем старый кеш без изменений
      }
      return prevCache;
    });

    // Если в кеше нет, загружаем
    const cached = messagesCache[channelId];
    if (cached && cached.messages) {
      return; // Уже обработали выше
    }

    setIsLoadingMessages(true);
    try {
      const messagesData = await apiService.getChannelMessages(serverId, channelId);
      const messagesArray = Array.isArray(messagesData) ? messagesData : [];

      setMessages(messagesArray);
      setPreloadedMessages(true);

      // Сохраняем в кеш
      setMessagesCache(prevCache => {
        const newCache = {
          ...prevCache,
          [channelId]: {
            messages: messagesArray,
            timestamp: Date.now()
          }
        };
        return cleanupCache(newCache);
      });

      // Скелетон скроется автоматически в Chat.js
    } catch (err) {
      console.error('Ошибка предзагрузки сообщений:', err);
      setMessages([]);
      setIsLoadingMessages(false);
    }
  }, [messagesCache, cleanupCache]);

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
    setMessages,
    addMessage,
    editMessage,
    deleteMessage,
    updateMessageReactions,
    setHasUnreadDMs,
    preloadChannelMessages,
    setIsLoadingMessages,
    saveScrollPosition,
    getSavedScrollPosition
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

