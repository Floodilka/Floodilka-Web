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
    console.log('[SCROLL] 📺 ChatContext.selectTextChannel:', {
      channelId: channel?.id,
      channelName: channel?.name,
      shouldRestoreScrollFlag
    });

    // Проверяем кеш для этого канала
    const cached = messagesCache[channel?.id];
    console.log('[SCROLL] 🔍 Проверка кеша для канала:', {
      channelId: channel?.id,
      hasCached: !!cached,
      hasMessages: !!(cached && cached.messages),
      messagesCount: cached?.messages?.length || 0,
      scrollPosition: cached?.scrollPosition
    });

    // Используем кеш если он есть (даже если сообщений 0)
    if (cached && Array.isArray(cached.messages)) {
      console.log('[SCROLL] ✅ Используем кешированные сообщения:', cached.messages.length);
      setMessages(cached.messages);
      setPreloadedMessages(true);
      setIsLoadingMessages(false); // НЕ показываем загрузку если есть кеш
    } else {
      console.log('[SCROLL] 🔄 Кеша нет - начинаем загрузку');
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
    console.log('[SCROLL] 🧹 ChatContext.clearChannelState:', {
      currentChannelId: currentTextChannel?.id,
      messagesCount: messages.length
    });

    // Сохраняем текущие сообщения в кеш перед очисткой (даже если канал пустой)
    if (currentTextChannel?.id) {
      setMessagesCache(cache => {
        const oldCache = cache[currentTextChannel.id] || {};
        console.log('[SCROLL] 💾 Сохраняем состояние канала перед очисткой:', {
          channelId: currentTextChannel.id,
          messagesCount: messages.length,
          scrollPosition: oldCache.scrollPosition
        });
        const newCache = {
          ...cache,
          [currentTextChannel.id]: {
            messages: messages, // Сохраняем даже пустой массив
            scrollPosition: oldCache.scrollPosition, // СОХРАНЯЕМ scrollPosition из старого кеша!
            timestamp: Date.now()
          }
        };
        return cleanupCache(newCache);
      });
    }

    console.log('[SCROLL] 🧹 Очищаем состояние канала');
    setCurrentTextChannel(null);
    setMessages([]);
    setPreloadedMessages(false);
    setIsLoadingMessages(false);
  }, [currentTextChannel, messages, cleanupCache]);

  const clearServerCache = useCallback(() => {
    console.log('[SCROLL] 🧹 ChatContext.clearServerCache: очищаем весь кеш при смене сервера');
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

    console.log('[SCROLL] 💾 ChatContext.saveScrollPosition:', {
      scrollPosition,
      explicitChannelId: channelId,
      currentChannelId: currentTextChannel?.id,
      targetChannelId
    });

    if (!targetChannelId) {
      console.log('[SCROLL] ⚠️ saveScrollPosition: нет targetChannelId');
      return;
    }

    setMessagesCache(cache => {
      const newCache = {
        ...cache,
        [targetChannelId]: {
          ...cache[targetChannelId],
          messages: cache[targetChannelId]?.messages || messages,
          scrollPosition: scrollPosition,
          timestamp: Date.now()
        }
      };
      console.log('[SCROLL] 💾 Сохранено в кеш:', targetChannelId, 'позиция:', scrollPosition);
      return newCache;
    });
  }, [currentTextChannel, messages]);

  const getSavedScrollPosition = useCallback((channelId) => {
    const cached = messagesCache[channelId];
    const position = (cached && typeof cached.scrollPosition === 'number') ? cached.scrollPosition : null;

    console.log('[SCROLL] 📖 ChatContext.getSavedScrollPosition:', {
      channelId,
      hasCached: !!cached,
      position,
      cacheKeys: Object.keys(messagesCache)
    });

    return position;
  }, [messagesCache]);

  const preloadChannelMessages = useCallback(async (channelId, serverId) => {
    console.log('[SCROLL] 📥 ChatContext.preloadChannelMessages:', {
      channelId,
      serverId
    });

    // Проверяем кеш перед загрузкой
    setMessagesCache(prevCache => {
      const cached = prevCache[channelId];
      if (cached && cached.messages) {
        console.log('[SCROLL] ✅ preloadChannelMessages: найден кеш, используем его');
        setMessages(cached.messages);
        setPreloadedMessages(true);
        setIsLoadingMessages(false);
        return prevCache; // Возвращаем старый кеш без изменений
      }
      console.log('[SCROLL] 🔄 preloadChannelMessages: кеша нет, продолжаем загрузку');
      return prevCache;
    });

    // Если в кеше нет, загружаем
    const cached = messagesCache[channelId];
    if (cached && cached.messages) {
      console.log('[SCROLL] ✅ preloadChannelMessages: кеш уже обработан');
      return; // Уже обработали выше
    }

    console.log('[SCROLL] 🌐 preloadChannelMessages: начинаем загрузку с сервера');
    setIsLoadingMessages(true);
    try {
      const messagesData = await apiService.getChannelMessages(serverId, channelId);
      const messagesArray = Array.isArray(messagesData) ? messagesData : [];

      console.log('[SCROLL] ✅ preloadChannelMessages: загружено сообщений:', messagesArray.length);
      setMessages(messagesArray);
      setPreloadedMessages(true);

      // Сохраняем в кеш
      setMessagesCache(prevCache => {
        const newCache = {
          ...prevCache,
          [channelId]: {
            messages: messagesArray,
            scrollPosition: prevCache[channelId]?.scrollPosition, // Сохраняем старую позицию скролла если была
            timestamp: Date.now()
          }
        };
        console.log('[SCROLL] 💾 preloadChannelMessages: сохранено в кеш, scrollPosition:', prevCache[channelId]?.scrollPosition);
        return cleanupCache(newCache);
      });

      // Скелетон скроется автоматически в Chat.js
    } catch (err) {
      console.error('[SCROLL] ❌ Ошибка предзагрузки сообщений:', err);
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
    clearServerCache,
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

