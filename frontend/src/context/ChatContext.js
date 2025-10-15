import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
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
  // Кеш сообщений для каналов: { "serverId:channelId": { messages: [], scrollPosition: number, timestamp: Date } }
  const [messagesCache, setMessagesCache] = useState({});

  // Refs для доступа к актуальным значениям без пересоздания колбеков
  const currentTextChannelRef = useRef(null);
  const messagesRef = useRef([]);

  // Обновляем refs при изменении state
  currentTextChannelRef.current = currentTextChannel;
  messagesRef.current = messages;

  // Функция для создания ключа кэша
  const getCacheKey = useCallback((serverId, channelId) => {
    return `${serverId}:${channelId}`;
  }, []);


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

  const selectTextChannel = useCallback((channel, shouldRestoreScrollFlag, serverId) => {
    console.log(`[CHAT_CONTEXT] selectTextChannel called:`, {
      channelId: channel?.id,
      channelName: channel?.name,
      serverId,
      shouldRestoreScrollFlag,
      currentChannel: currentTextChannelRef.current?.id,
      currentMessagesCount: messagesRef.current.length
    });

    // Создаем ключ кэша с учетом serverId
    const cacheKey = getCacheKey(serverId, channel?.id);
    const cached = messagesCache[cacheKey];

    console.log(`[CHAT_CONTEXT] Cache check:`, {
      cacheKey,
      hasCached: !!cached,
      cachedMessagesCount: cached?.messages?.length || 0
    });

    // ВАЖНО: НЕ используем кеш с 0 сообщениями, если это не новый канал
    // Это предотвращает затирание реальных сообщений пустым кешем
    const shouldUseCache = cached && Array.isArray(cached.messages) && cached.messages.length > 0;

    if (shouldUseCache) {
      console.log(`[CHAT_CONTEXT] Using cached messages:`, {
        channelId: channel?.id,
        messagesCount: cached.messages.length
      });
      setMessages(cached.messages);
      setPreloadedMessages(true);
      setIsLoadingMessages(false);
    } else {
      console.log(`[CHAT_CONTEXT] Loading fresh messages:`, {
        channelId: channel?.id
      });
      setIsLoadingMessages(true);
      setPreloadedMessages(false);
    }

    setCurrentTextChannel(channel);
    setShowDirectMessages(false);
  }, [messagesCache, getCacheKey]);

  const selectDirectMessages = useCallback(() => {
    console.log(`[CHAT_CONTEXT] selectDirectMessages called:`, {
      currentChannel: currentTextChannelRef.current?.id,
      currentChannelName: currentTextChannelRef.current?.name,
      currentMessagesCount: messagesRef.current.length
    });
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

  const clearChannelState = useCallback((serverId) => {
    const currentChannel = currentTextChannelRef.current;
    const currentMessages = messagesRef.current;

    console.log(`[CHAT_CONTEXT] clearChannelState called:`, {
      serverId,
      currentChannelId: currentChannel?.id,
      currentChannelName: currentChannel?.name,
      messagesCount: currentMessages.length,
      hasMessages: currentMessages.length > 0
    });

    // Сохраняем текущие сообщения в кеш перед очисткой ТОЛЬКО если есть сообщения
    if (currentChannel?.id && currentMessages.length > 0 && serverId) {
      const cacheKey = getCacheKey(serverId, currentChannel.id);
      console.log(`[CHAT_CONTEXT] Saving messages to cache:`, {
        cacheKey,
        messagesCount: currentMessages.length
      });
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

    console.log(`[CHAT_CONTEXT] Clearing channel state:`, {
      serverId,
      clearingChannel: currentChannel?.id
    });
    setCurrentTextChannel(null);
    setMessages([]);
    setPreloadedMessages(false);
    setIsLoadingMessages(false);
  }, [cleanupCache, getCacheKey]);

  const clearServerCache = useCallback(() => {
    setMessagesCache({});
    setCurrentTextChannel(null);
    setMessages([]);
    setPreloadedMessages(false);
    setIsLoadingMessages(false);
  }, []);

  const addMessage = useCallback((message) => {
    setMessages(prev => {
      // Проверяем на дубликаты - если сообщение с таким ID уже есть, не добавляем
      const isDuplicate = prev.some(msg => msg.id === message.id);
      if (isDuplicate) {
        return prev; // Возвращаем массив без изменений
      }

      const updated = [...prev, message];
      // Обновляем кеш для текущего канала (нужен serverId для ключа)
      const currentChannel = currentTextChannelRef.current;
      if (currentChannel?.id) {
        // Для обновления кэша нужен serverId, но у нас его нет в контексте
        // Пока что не обновляем кэш при добавлении сообщений
        // Это можно будет исправить позже, передав serverId в функцию
      }
      return updated;
    });
  }, [cleanupCache]);

  const editMessage = useCallback((editedMessage) => {
    setMessages(prev => {
      const updated = prev.map(msg =>
        msg.id === editedMessage.id ? editedMessage : msg
      );
      // Обновляем кеш для текущего канала
      const currentChannel = currentTextChannelRef.current;
      if (currentChannel?.id) {
        setMessagesCache(cache => {
          const oldCache = cache[currentChannel.id] || {};
          const newCache = {
            ...cache,
            [currentChannel.id]: {
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
  }, [cleanupCache]);

  const deleteMessage = useCallback((messageId) => {
    setMessages(prev => {
      const updated = prev.filter(msg => msg.id !== messageId);
      // Обновляем кеш для текущего канала
      const currentChannel = currentTextChannelRef.current;
      if (currentChannel?.id) {
        setMessagesCache(cache => {
          const oldCache = cache[currentChannel.id] || {};
          const newCache = {
            ...cache,
            [currentChannel.id]: {
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
  }, [cleanupCache]);

  const updateMessageReactions = useCallback((messageId, reactions) => {
    setMessages(prev => {
      const updated = prev.map(msg =>
        msg.id === messageId ? { ...msg, reactions } : msg
      );
      // Обновляем кеш для текущего канала
      const currentChannel = currentTextChannelRef.current;
      if (currentChannel?.id) {
        setMessagesCache(cache => {
          const oldCache = cache[currentChannel.id] || {};
          const newCache = {
            ...cache,
            [currentChannel.id]: {
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
  }, [cleanupCache]);


  const preloadChannelMessages = useCallback(async (channelId, serverId) => {
    // Используем ref для проверки кеша без зависимости
    let cacheChecked = false;
    const cacheKey = getCacheKey(serverId, channelId);

    // Проверяем кеш перед загрузкой
    setMessagesCache(prevCache => {
      const cached = prevCache[cacheKey];

      // ВАЖНО: НЕ используем пустой кеш! Загружаем заново если кеш пуст
      if (cached && cached.messages && cached.messages.length > 0) {
        setMessages(cached.messages);
        setPreloadedMessages(true);
        setIsLoadingMessages(false);
        cacheChecked = true;
        return prevCache; // Возвращаем старый кеш без изменений
      }
      return prevCache;
    });

    // Если кеш был найден, выходим
    if (cacheChecked) {
      return;
    }

    setIsLoadingMessages(true);
    try {
      const messagesData = await apiService.getChannelMessages(serverId, channelId);
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

      // Скелетон скроется автоматически в Chat.js
    } catch (err) {
      console.error('Ошибка предзагрузки сообщений:', err);
      setMessages([]);
      setIsLoadingMessages(false);
    }
  }, [cleanupCache, getCacheKey]);

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

