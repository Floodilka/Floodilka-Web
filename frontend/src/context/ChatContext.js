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
  // Кеш сообщений для каналов: { channelId: { messages: [], scrollPosition: number, timestamp: Date } }
  const [messagesCache, setMessagesCache] = useState({});

  // Refs для доступа к актуальным значениям без пересоздания колбеков
  const currentTextChannelRef = useRef(null);
  const messagesRef = useRef([]);

  // Обновляем refs при изменении state
  currentTextChannelRef.current = currentTextChannel;
  messagesRef.current = messages;

  // 🔍 ЛОГ: Отслеживаем изменения messages
  useEffect(() => {
    const stackLines = new Error().stack.split('\n');
    const caller = stackLines[2] || stackLines[1] || 'unknown';
    console.log('[🔍 MESSAGES DEBUG] Messages изменились:', {
      count: messages.length,
      channelId: currentTextChannel?.id,
      channelName: currentTextChannel?.name,
      caller: caller.trim(),
      firstMessage: messages[0]?.content?.substring(0, 50)
    });

    if (messages.length === 0 && currentTextChannel?.id) {
      console.warn('[⚠️ MESSAGES EMPTY] Сообщения обнулились для канала:', currentTextChannel.id);
      console.trace('Stack trace для пустых сообщений:');
    }
  }, [messages, currentTextChannel]);

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

    // ВАЖНО: НЕ используем кеш с 0 сообщениями, если это не новый канал
    // Это предотвращает затирание реальных сообщений пустым кешем
    const shouldUseCache = cached && Array.isArray(cached.messages) && cached.messages.length > 0;

    if (shouldUseCache) {
      console.log('[SCROLL] ✅ Используем кешированные сообщения:', cached.messages.length);
      setMessages(cached.messages);
      setPreloadedMessages(true);
      setIsLoadingMessages(false);
    } else {
      console.log('[SCROLL] 🔄 Кеша нет или он пустой - начинаем загрузку');
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
    const currentChannel = currentTextChannelRef.current;
    const currentMessages = messagesRef.current;

    console.log('[SCROLL] 🧹 ChatContext.clearChannelState:', {
      currentChannelId: currentChannel?.id,
      messagesCount: currentMessages.length
    });

    // Сохраняем текущие сообщения в кеш перед очисткой (даже если канал пустой)
    if (currentChannel?.id) {
      setMessagesCache(cache => {
        const oldCache = cache[currentChannel.id] || {};
        console.log('[SCROLL] 💾 Сохраняем состояние канала перед очисткой:', {
          channelId: currentChannel.id,
          messagesCount: currentMessages.length,
          scrollPosition: oldCache.scrollPosition
        });
        const newCache = {
          ...cache,
          [currentChannel.id]: {
            messages: currentMessages, // Сохраняем даже пустой массив
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
  }, [cleanupCache]);

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

  const saveScrollPosition = useCallback((scrollPosition, channelId) => {
    // Если channelId передан явно, используем его, иначе берем из currentTextChannel
    const currentChannel = currentTextChannelRef.current;
    const currentMessages = messagesRef.current;
    const targetChannelId = channelId || currentChannel?.id;

    console.log('[SCROLL] 💾 ChatContext.saveScrollPosition:', {
      scrollPosition,
      explicitChannelId: channelId,
      currentChannelId: currentChannel?.id,
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
          messages: cache[targetChannelId]?.messages || currentMessages,
          scrollPosition: scrollPosition,
          timestamp: Date.now()
        }
      };
      console.log('[SCROLL] 💾 Сохранено в кеш:', targetChannelId, 'позиция:', scrollPosition);
      return newCache;
    });
  }, []);

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

    // Используем ref для проверки кеша без зависимости
    let cacheChecked = false;

    // Проверяем кеш перед загрузкой
    setMessagesCache(prevCache => {
      const cached = prevCache[channelId];
      // ВАЖНО: НЕ используем пустой кеш! Загружаем заново если кеш пуст
      if (cached && cached.messages && cached.messages.length > 0) {
        console.log('[SCROLL] ✅ preloadChannelMessages: найден кеш с', cached.messages.length, 'сообщениями');
        setMessages(cached.messages);
        setPreloadedMessages(true);
        setIsLoadingMessages(false);
        cacheChecked = true;
        return prevCache; // Возвращаем старый кеш без изменений
      }
      console.log('[SCROLL] 🔄 preloadChannelMessages: кеша нет или он пустой, продолжаем загрузку');
      return prevCache;
    });

    // Если кеш был найден, выходим
    if (cacheChecked) {
      console.log('[SCROLL] ✅ preloadChannelMessages: кеш уже обработан');
      return;
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
  }, [cleanupCache]);

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

