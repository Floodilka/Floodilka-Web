import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import './Chat.css';
import FriendActionButton from './FriendActionButton';
import { useChat } from '../context/ChatContext';
import { SOCKET_EVENTS } from '../constants/events';
import EmojiPicker from './EmojiPicker';
import MessageReactions from './MessageReactions';
import MentionAutocomplete from './MentionAutocomplete';

const BACKEND_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : `${window.location.protocol}//${window.location.hostname}`;

function Chat({ channel, messages, username, user, currentServer, onSendMessage, hasServer, hasTextChannels, serverLoading, socket, onMessageSent, preloadedMessages, isLoadingMessages }) {
  const { setIsLoadingMessages, saveScrollPosition, getSavedScrollPosition } = useChat();
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [profilePosition, setProfilePosition] = useState({ top: 0, left: 0 });
  const [contextMenu, setContextMenu] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [userPermissions, setUserPermissions] = useState(null);
  const [deletingMessageId, setDeletingMessageId] = useState(null);
  const [showMessages, setShowMessages] = useState(messages.length > 0); // Для предотвращения дергания
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [showFileSizeError, setShowFileSizeError] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiPickerPosition, setEmojiPickerPosition] = useState(null);
  const [selectedMessageForReaction, setSelectedMessageForReaction] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);

  // Состояния для автокомплита упоминаний
  const [showMentionAutocomplete, setShowMentionAutocomplete] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0, width: 0 });
  const [mentionSelectedIndex, setMentionSelectedIndex] = useState(0);
  const [serverMembers, setServerMembers] = useState([]);
  const inputRef = useRef(null);
  const messageInputFieldRef = useRef(null);

  const handleUserClick = async (message, event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const cardWidth = 300; // Примерная ширина карточки
    const cardHeight = 200; // Примерная высота карточки
    const padding = 10; // Отступ от края экрана

    let top = rect.top;
    let left = rect.right + 8;

    // Проверяем, не уходит ли карточка за правый край экрана
    if (left + cardWidth > window.innerWidth - padding) {
      left = rect.left - cardWidth - 8; // Показываем слева от элемента
    }

    // Проверяем, не уходит ли карточка за нижний край экрана
    if (top + cardHeight > window.innerHeight - padding) {
      // Если места внизу мало, показываем над элементом
      // Выравниваем нижний край карточки с верхним краем элемента
      top = rect.top - cardHeight - 8;

      // Проверяем, не уходит ли карточка за верхний край экрана после сдвига вверх
      if (top < padding) {
        // Если карточка все еще не помещается сверху, центрируем её по вертикали
        top = Math.max(padding, (window.innerHeight - cardHeight) / 2);
      }
    }

    // Проверяем, не уходит ли карточка за верхний край экрана (для обычного случая)
    if (top < padding) {
      top = padding;
    }

    // Проверяем, не уходит ли карточка за левый край экрана
    if (left < padding) {
      left = padding;
    }

    setProfilePosition({
      top: Math.max(padding, top),
      left: Math.max(padding, left)
    });

    // Если есть userId, загрузить актуальные данные пользователя
    if (message.userId) {
      try {
        const response = await fetch(`${BACKEND_URL}/api/auth/user/${message.userId}`);
        if (response.ok) {
          const userData = await response.json();
          setSelectedUser(userData);
          return;
        }
      } catch (err) {
        console.error('Ошибка загрузки данных пользователя:', err);
      }
    }

    // Fallback: использовать данные из сообщения
    setSelectedUser({
      username: message.username,
      displayName: message.displayName,
      avatar: message.avatar,
      badge: message.badge,
      badgeTooltip: message.badgeTooltip
    });
  };

  const handleCloseProfile = () => {
    setSelectedUser(null);
    setMessageText('');
  };

  // Загрузка прав пользователя при смене сервера
  useEffect(() => {
    const loadUserPermissions = async () => {
      if (!currentServer || !user?.id) {
        setUserPermissions(null);
        return;
      }

      try {
        const response = await fetch(
          `${BACKEND_URL}/api/roles/servers/${currentServer._id}/users/${user.id}/roles`,
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          }
        );

        if (response.ok) {
          const userRoles = await response.json();

          // Объединяем права из всех ролей
          const combinedPermissions = userRoles.reduce((acc, userRole) => {
            if (userRole.roleId && userRole.roleId.permissions) {
              Object.keys(userRole.roleId.permissions).forEach(key => {
                if (userRole.roleId.permissions[key]) {
                  acc[key] = true;
                }
              });
            }
            return acc;
          }, {});

          // Проверяем, является ли владельцем
          if (currentServer.ownerId === user.id) {
            combinedPermissions.isOwner = true;
            combinedPermissions.manageServer = true;
            combinedPermissions.manageMessages = true;
          }

          setUserPermissions(combinedPermissions);
        }
      } catch (err) {
        console.error('Ошибка загрузки прав:', err);
        setUserPermissions(null);
      }
    };

    loadUserPermissions();
  }, [currentServer, user]);

  // Загрузка участников сервера для автокомплита упоминаний
  useEffect(() => {
    const loadServerMembers = async () => {
      if (!currentServer?._id) {
        setServerMembers([]);
        return;
      }

      try {
        const response = await fetch(
          `${BACKEND_URL}/api/servers/${currentServer._id}/members`,
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          }
        );

        if (response.ok) {
          const members = await response.json();
          setServerMembers(members);
        }
      } catch (err) {
        console.error('Ошибка загрузки участников:', err);
        setServerMembers([]);
      }
    };

    loadServerMembers();
  }, [currentServer]);

  useEffect(() => {
    if (replyingTo && inputRef.current) {
      inputRef.current.focus({ preventScroll: true });
    }
  }, [replyingTo]);

  useEffect(() => {
    setReplyingTo(null);
    setHighlightedMessageId(null);
  }, [channel?.id]);

  useEffect(() => {
    if (replyingTo && !messages.find(msg => msg.id === replyingTo.id)) {
      setReplyingTo(null);
    }
  }, [messages, replyingTo]);

  useEffect(() => {
    if (!highlightedMessageId) return;

    const timeout = setTimeout(() => {
      setHighlightedMessageId(null);
    }, 1800);

    return () => clearTimeout(timeout);
  }, [highlightedMessageId]);

  const handleSendDirectMessage = async () => {
    if (!messageText.trim() || !selectedUser || sendingMessage) return;

    // Не отправляем сообщение самому себе
    if (selectedUser.userId === username || selectedUser.username === username) return;

    setSendingMessage(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Токен не найден');

      const response = await fetch(`${BACKEND_URL}/api/direct-messages/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          receiverId: selectedUser.userId || selectedUser.id,
          content: messageText.trim()
        })
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Ошибка отправки сообщения:', response.status, error);
        throw new Error(error.error || 'Ошибка отправки сообщения');
      }

      setMessageText('');

      // Вызываем колбэк для открытия DM с этим пользователем
      if (onMessageSent && selectedUser) {
        onMessageSent(selectedUser);
      }
    } catch (error) {
      console.error('Ошибка отправки сообщения:', error);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendDirectMessage();
    }
  };

  const handleMoreActions = (message, event) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();

    // Размеры контекстного меню (примерные)
    const menuHeight = 120; // Высота меню
    const menuWidth = 210; // Ширина меню
    const padding = 10; // Отступ от края экрана

    // Вычисляем позицию по умолчанию (справа от кнопки)
    let top = rect.top + rect.height / 2 - 18; // Центрируем по вертикали
    let left = rect.left - menuWidth;

    // Проверяем, помещается ли меню вниз
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    // Если места внизу мало, но вверху больше - показываем вверху
    if (spaceBelow < menuHeight && spaceAbove > spaceBelow) {
      top = rect.top - menuHeight - 5; // Показываем над сообщением
    }

    // Проверяем, не уходит ли меню за левый край экрана
    if (left < padding) {
      left = rect.right + 5; // Показываем справа от кнопки
    }

    // Проверяем, не уходит ли меню за правый край экрана
    if (left + menuWidth > window.innerWidth - padding) {
      left = window.innerWidth - menuWidth - padding;
    }

    setContextMenu({
      message,
      position: {
        top: Math.max(padding, top), // Минимум 10px от верха
        left: Math.max(padding, left) // Минимум 10px слева
      }
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  const truncateText = (text, limit = 120) => {
    if (!text) return '';
    return text.length > limit ? `${text.slice(0, limit).trim()}…` : text;
  };

  const getReplySnippetFromMessage = (message) => {
    if (!message) return '';
    if (message.content) {
      return truncateText(message.content);
    }
    if (Array.isArray(message.attachments) && message.attachments.length > 0) {
      const attachment = message.attachments[0];
      if (attachment?.mimetype?.startsWith('image/')) {
        return '📷 Изображение';
      }
      return `📎 ${attachment?.originalName || 'Вложение'}`;
    }
    return 'Без текста';
  };

  const getReplySnippetFromMeta = (replyMeta) => {
    if (!replyMeta) return '';
    if (replyMeta.isSystem) {
      return 'Системное сообщение';
    }
    if (replyMeta.content) {
      return truncateText(replyMeta.content);
    }
    if (replyMeta.hasAttachments) {
      if (replyMeta.attachmentPreview?.mimetype?.startsWith('image/')) {
        return '📷 Изображение';
      }
      return `📎 ${replyMeta.attachmentPreview?.originalName || 'Вложение'}`;
    }
    return 'Без текста';
  };

  const buildReplySnapshot = (message) => ({
    id: message.id,
    username: message.username,
    displayName: message.displayName,
    content: message.content,
    attachments: message.attachments || []
  });

  const handleReplySelect = (message) => {
    if (!message || message.isSystem) return;
    setReplyingTo(buildReplySnapshot(message));
    setContextMenu(null);
    requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true });
    });
  };

  const cancelReply = () => setReplyingTo(null);

  const handleReplyNavigation = (messageId) => {
    if (!messageId) return;
    scrollToMessageById(messageId);
  };

  const canEditMessage = (message) => {
    if (message.username !== username) return false;
    if (message.isSystem) return false;

    const messageTime = new Date(message.timestamp);
    const now = new Date();
    const diffInHours = (now - messageTime) / (1000 * 60 * 60);

    return diffInHours <= 24;
  };

  const canDeleteMessage = (message) => {
    if (message.isSystem) return false;

    // Можно удалить свое сообщение
    if (message.username === username) return true;

    // Проверяем права администратора
    if (userPermissions && (
      userPermissions.manageMessages ||
      userPermissions.manageServer ||
      userPermissions.isOwner
    )) {
      return true;
    }

    return false;
  };

  const handleEditMessage = (message) => {
    setEditingMessage(message);
    setEditValue(message.content);
    setContextMenu(null);
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setEditValue('');
  };

  const handleSaveEdit = () => {
    if (!editingMessage || !editValue.trim() || !socket) return;

    socket.emit('message:edit', {
      messageId: editingMessage.id,
      content: editValue.trim()
    });

    setEditingMessage(null);
    setEditValue('');
  };

  const handleDeleteMessage = (message) => {
    if (!window.confirm('Вы уверены, что хотите удалить это сообщение?')) return;
    if (!socket) return;

    // Сначала запускаем анимацию
    setDeletingMessageId(message.id);
    setContextMenu(null);

    // Через 300мс отправляем запрос на удаление
    setTimeout(() => {
      socket.emit('message:delete', {
        messageId: message.id,
        userId: user?.id
      });

      // Сбрасываем состояние после удаления
      setTimeout(() => setDeletingMessageId(null), 100);
    }, 300);
  };

  // Обработчики реакций
  const handleAddReaction = (messageId, event) => {
    const rect = event.currentTarget.getBoundingClientRect();

    // Размеры EmojiPicker (примерные)
    const pickerHeight = 444; // Высота picker
    const pickerWidth = 352; // Ширина picker
    const padding = 10; // Отступ от края экрана

    // Позиция по умолчанию (рядом с кнопкой)
    let top = rect.top;
    let left = rect.left;

    // Проверяем, помещается ли picker вниз
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    // Если места внизу мало, показываем вверху
    if (spaceBelow < pickerHeight && spaceAbove > spaceBelow) {
      top = rect.top - pickerHeight - 5; // Показываем над кнопкой
    }

    // Проверяем, не уходит ли picker за правый край экрана
    if (left + pickerWidth > window.innerWidth - padding) {
      left = window.innerWidth - pickerWidth - padding;
    }

    // Проверяем, не уходит ли picker за левый край экрана
    if (left < padding) {
      left = padding;
    }

    // Проверяем, не уходит ли picker за верхний край экрана
    if (top < padding) {
      top = padding;
    }

    setEmojiPickerPosition({
      top: Math.max(padding, top),
      left: Math.max(padding, left)
    });
    setSelectedMessageForReaction(messageId);
    setShowEmojiPicker(true);
  };

  const handleEmojiSelect = (emoji) => {
    if (!selectedMessageForReaction || !socket || !user) return;

    socket.emit(SOCKET_EVENTS.REACTION_ADD, {
      messageId: selectedMessageForReaction,
      emoji,
      userId: user.id,
      username: user.username,
      isDM: false
    });

    setShowEmojiPicker(false);
    setSelectedMessageForReaction(null);
  };

  const handleReactionClick = (messageId, emoji, userReacted) => {
    if (!socket || !user) return;

    if (userReacted) {
      // Удалить реакцию
      socket.emit(SOCKET_EVENTS.REACTION_REMOVE, {
        messageId,
        emoji,
        userId: user.id,
        isDM: false
      });
    } else {
      // Добавить реакцию
      socket.emit(SOCKET_EVENTS.REACTION_ADD, {
        messageId,
        emoji,
        userId: user.id,
        username: user.username,
        isDM: false
      });
    }
  };

  const AUTO_SCROLL_EPSILON = 32;
  const MAX_AUTO_SCROLL_ATTEMPTS = 12;
  const autoScrollStateRef = useRef({ channelId: null, attempts: 0 });

  const scrollTimeoutsRef = useRef([]);

  const scrollContainerToBottom = useCallback((trigger = 'default') => {
    const container = messagesContainerRef.current;
    if (!container) return;

    // Отменяем предыдущие таймауты
    scrollTimeoutsRef.current.forEach(id => clearTimeout(id));
    scrollTimeoutsRef.current = [];

    const applyScroll = (source) => {
      const maxScrollTop = container.scrollHeight - container.clientHeight;
      const nextScrollTop = maxScrollTop > 0 ? maxScrollTop : 0;
      container.scrollTop = nextScrollTop;

      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'auto', block: 'end' });
      }

      console.log('[SCROLL] 📐 scrollContainerToBottom:', {
        trigger,
        source,
        scrollTop: container.scrollTop,
        scrollHeight: container.scrollHeight,
        clientHeight: container.clientHeight,
        hasOverflow: container.scrollHeight > container.clientHeight
      });
    };

    applyScroll('immediate');
    requestAnimationFrame(() => applyScroll('raf'));

    const t1 = setTimeout(() => applyScroll('timeout'), 0);
    const t2 = setTimeout(() => applyScroll('timeout-10'), 10);
    const t3 = setTimeout(() => applyScroll('timeout-50'), 50);
    const t4 = setTimeout(() => applyScroll('timeout-100'), 100);

    scrollTimeoutsRef.current.push(t1, t2, t3, t4);
  }, []);

  const scrollToMessageById = useCallback((messageId) => {
    if (!messageId || !messagesContainerRef.current) return;

    const target = messagesContainerRef.current.querySelector(`[data-message-id="${messageId}"]`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMessageId(messageId);
    }
  }, []);

  const markChannelScrolled = useCallback((channelId, reason) => {
    if (!channelId) return;
    scrolledChannelsRef.current.add(channelId);
    isInitialLoad.current = false;
    autoScrollStateRef.current = { channelId: null, attempts: 0 };
    console.log('[SCROLL] 🟢 Автоскролл завершен', { channelId, reason });
  }, []);

  const finalizeAutoScroll = useCallback((reason) => {
    const container = messagesContainerRef.current;
    const channelId = channel?.id;
    if (!container || !channelId) return;

    const totalMessages = messages.length;

    if (totalMessages === 0) {
      console.log('[SCROLL] 🔁 Автоскролл: ждем сообщений перед проверкой', {
        channelId,
        reason
      });
      return;
    }

    const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
    const hasOverflow = container.scrollHeight > container.clientHeight;

    // ВАЖНО: Если много сообщений, но нет переполнения - DOM еще не обновился
    if (totalMessages > 10 && !hasOverflow) {
      const prevState = autoScrollStateRef.current;
      const prevAttempts = prevState.channelId === channelId ? prevState.attempts : 0;
      const nextAttempts = prevAttempts + 1;

      if (nextAttempts >= MAX_AUTO_SCROLL_ATTEMPTS) {
        console.log('[SCROLL] ⚠️ Автоскролл: достигнут лимит попыток (нет overflow)', {
          channelId,
          reason,
          totalMessages,
          scrollHeight: container.scrollHeight,
          clientHeight: container.clientHeight,
          attempts: nextAttempts
        });
        markChannelScrolled(channelId, reason);
        return;
      }

      console.log('[SCROLL] 🔄 Автоскролл: ждем рендер сообщений', {
        channelId,
        reason,
        totalMessages,
        hasOverflow,
        attempts: nextAttempts
      });

      autoScrollStateRef.current = { channelId, attempts: nextAttempts };
      setTimeout(() => {
        scrollContainerToBottom(`${reason}-retry-${nextAttempts}`);
        finalizeAutoScroll(reason);
      }, 50);
      return;
    }

    if (!hasOverflow || distance <= AUTO_SCROLL_EPSILON) {
      markChannelScrolled(channelId, reason);
      return;
    }

    const prevState = autoScrollStateRef.current;
    const prevAttempts = prevState.channelId === channelId ? prevState.attempts : 0;
    const nextAttempts = prevAttempts + 1;

    if (nextAttempts >= MAX_AUTO_SCROLL_ATTEMPTS) {
      console.log('[SCROLL] ⚠️ Автоскролл: достигнут лимит попыток', {
        channelId,
        reason,
        distance,
        attempts: nextAttempts
      });
      autoScrollStateRef.current = { channelId: null, attempts: 0 };
      return;
    }

    autoScrollStateRef.current = { channelId, attempts: nextAttempts };
    requestAnimationFrame(() => {
      scrollContainerToBottom(`${reason}-retry-${nextAttempts}`);
      finalizeAutoScroll(reason);
    });
  }, [channel?.id, markChannelScrolled, scrollContainerToBottom, messages.length]);

  const autoScrollToBottom = useCallback((reason) => {
    scrollContainerToBottom(reason);
    finalizeAutoScroll(reason);
  }, [finalizeAutoScroll, scrollContainerToBottom]);

  const scrollToBottom = useCallback(() => {
    console.log('[SCROLL] 📍 scrollToBottom вызван');
    autoScrollToBottom('manual');
  }, [autoScrollToBottom]);

  // Автоматическое скрытие скелетона
  useEffect(() => {
    if (!isLoadingMessages || !channel) return;

    // Если предзагружены сообщения, скрываем скелетон немедленно (без задержки)
    if (preloadedMessages && messages.length > 0) {
      setIsLoadingMessages(false);
      return;
    }

    // Если сообщений нет (пустой канал), скрываем скелетон быстро
    if (messages.length === 0) {
      const timer = setTimeout(() => {
        setIsLoadingMessages(false);
      }, 50);
      return () => clearTimeout(timer);
    }

    // Максимальный таймаут на случай если что-то пошло не так
    const maxTimer = setTimeout(() => {
      setIsLoadingMessages(false);
    }, 500);

    return () => clearTimeout(maxTimer);
  }, [isLoadingMessages, channel, messages.length, preloadedMessages, setIsLoadingMessages]);

  // Обработчик скролла для сохранения позиции
  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current || !channel?.id) return;

    const { scrollTop } = messagesContainerRef.current;
    const currentChannelId = channel.id;

    // Дебаунс - сохраняем не чаще раза в 300мс
    if (handleScroll.timeoutId) {
      clearTimeout(handleScroll.timeoutId);
    }

    handleScroll.timeoutId = setTimeout(() => {
      console.log('[SCROLL] 💾 Сохраняем позицию скролла для канала:', currentChannelId, 'позиция:', scrollTop);
      saveScrollPosition(scrollTop, currentChannelId);
    }, 300);
  }, [channel?.id, saveScrollPosition]);

  // Скролл вниз при смене канала
  const prevChannelRef = useRef(null);
  const isInitialLoad = useRef(true); // true по умолчанию для первой загрузки при обновлении страницы
  const scrolledChannelsRef = useRef(new Set()); // Список каналов, для которых уже делали скролл
  const shouldRestoreScroll = useRef(false); // Флаг для восстановления скролла
  const resizeObserverRef = useRef(null); // ResizeObserver для отслеживания изменения высоты

  // Очистка таймаутов при размонтировании
  useEffect(() => {
    return () => {
      scrollTimeoutsRef.current.forEach(id => clearTimeout(id));
      scrollTimeoutsRef.current = [];
    };
  }, []);

  useEffect(() => {
    // Игнорируем смену на undefined/null (промежуточное состояние при clearChannelState)
    const newChannelId = channel?.id;
    const oldChannelId = prevChannelRef.current;

    console.log('[SCROLL] 🔄 useEffect смены канала:', {
      oldChannelId,
      newChannelId,
      changed: newChannelId !== oldChannelId
    });

    if (newChannelId !== oldChannelId) {
      autoScrollStateRef.current = { channelId: null, attempts: 0 };

      // Отменяем все таймауты скролла при смене канала
      scrollTimeoutsRef.current.forEach(id => clearTimeout(id));
      scrollTimeoutsRef.current = [];

      // СНАЧАЛА сохраняем позицию СТАРОГО канала перед переключением
      if (oldChannelId && messagesContainerRef.current) {
        const currentScrollPos = messagesContainerRef.current.scrollTop;
        console.log('[SCROLL] 💾 Сохраняем старую позицию перед сменой канала:', oldChannelId, 'позиция:', currentScrollPos);
        if (currentScrollPos > 0) {
          saveScrollPosition(currentScrollPos, oldChannelId);
        }
      }

      // Обновляем ref только если новый канал реально существует
      if (newChannelId) {
        prevChannelRef.current = newChannelId;

        // Проверяем, был ли уже скролл для этого канала
        const hasScrolledForThisChannel = scrolledChannelsRef.current.has(newChannelId);

        // Проверяем, есть ли сохраненная позиция скролла для НОВОГО канала
        const savedPosition = getSavedScrollPosition(newChannelId);

        console.log('[SCROLL] 🔍 Проверка нового канала:', {
          newChannelId,
          hasScrolledForThisChannel,
          savedPosition,
          scrolledChannels: Array.from(scrolledChannelsRef.current)
        });

        if (savedPosition !== null) {
          // Если есть сохраненная позиция - ВСЕГДА восстанавливаем, даже если уже скроллили
          console.log('[SCROLL] 📋 Есть сохраненная позиция:', savedPosition, '- будем восстанавливать');
          shouldRestoreScroll.current = true;
          isInitialLoad.current = false; // НЕ скроллим вниз
          // Убираем из scrolledChannels чтобы разрешить восстановление
          scrolledChannelsRef.current.delete(newChannelId);
        } else {
          console.log('[SCROLL] ⬇️ Нет сохраненной позиции - сбрасываем состояние и скроллим вниз');
          shouldRestoreScroll.current = false;
          isInitialLoad.current = true; // Скроллим вниз
          // На всякий случай убираем id из списка проскролленных каналов
          scrolledChannelsRef.current.delete(newChannelId);
        }

        console.log('[SCROLL] 🎯 Установлены флаги:', {
          shouldRestoreScroll: shouldRestoreScroll.current,
          isInitialLoad: isInitialLoad.current
        });

        setShowMessages(false); // Скрываем сообщения при смене канала
      } else {
        // Если канал стал null/undefined, просто обновляем ref
        console.log('[SCROLL] ❌ Канал стал null/undefined');
        prevChannelRef.current = null;
      }
    }
  }, [channel?.id, getSavedScrollPosition, saveScrollPosition]);

  // Восстановление позиции скролла - используем useLayoutEffect для синхронного выполнения
  useLayoutEffect(() => {
    const hasScrolledForThisChannel = scrolledChannelsRef.current.has(channel?.id);

    console.log('[SCROLL] 🎨 useLayoutEffect восстановление позиции:', {
      channelId: channel?.id,
      preloadedMessages,
      messagesLength: messages.length,
      hasScrolledForThisChannel,
      hasContainer: !!messagesContainerRef.current,
      shouldRestoreScroll: shouldRestoreScroll.current
    });

    if (preloadedMessages && messages.length > 0 && !hasScrolledForThisChannel && messagesContainerRef.current && channel?.id) {
      // Показываем сообщения
      setShowMessages(true);

      // Проверяем позицию скролла прямо здесь
      const savedPosition = getSavedScrollPosition(channel.id);

      console.log('[SCROLL] 🔍 Проверка сохраненной позиции:', savedPosition);

      if (savedPosition !== null) {
        // Есть сохраненная позиция - восстанавливаем
        console.log('[SCROLL] ✅ Восстанавливаем позицию:', savedPosition);
        messagesContainerRef.current.scrollTop = savedPosition;
        shouldRestoreScroll.current = false;
        prevMessagesLengthRef.current = messages.length; // ВАЖНО: обновляем prevMessagesLength!
        markChannelScrolled(channel.id, 'restore-saved-position');
      } else if (shouldRestoreScroll.current) {
        // Флаг установлен но позиция не найдена
        console.log('[SCROLL] ⚠️ Флаг shouldRestoreScroll был true, но позиция не найдена - переключаем на isInitialLoad');
        shouldRestoreScroll.current = false;
        isInitialLoad.current = true;
      }
    }
  }, [preloadedMessages, messages.length, channel?.id, getSavedScrollPosition, markChannelScrolled]);

  // Умный автоскролл - скроллит только если пользователь был внизу
  // Используем useLayoutEffect для синхронного скролла после рендеринга DOM
  const prevMessagesLengthRef = useRef(0);
  useLayoutEffect(() => {
    if (!messagesContainerRef.current || !messagesEndRef.current) {
      console.log('[SCROLL] ⚠️ useLayoutEffect автоскролл: нет контейнера или endRef');
      return;
    }

    const container = messagesContainerRef.current;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    const hasScrolledForThisChannel = scrolledChannelsRef.current.has(channel?.id);

    // ВАЖНО: Проверяем и сбрасываем shouldRestoreScroll ДО проверки автоскролла
    // Это нужно для случая, когда переключаемся на новый канал без сохраненной позиции
    if (shouldRestoreScroll.current && channel?.id) {
      const savedPosition = getSavedScrollPosition(channel.id);
      if (savedPosition === null) {
        console.log('[SCROLL] 🔄 Сброс shouldRestoreScroll - нет сохраненной позиции для канала');
        shouldRestoreScroll.current = false;
        isInitialLoad.current = true;
      }
    }

    console.log('[SCROLL] 🤖 useLayoutEffect автоскролл:', {
      channelId: channel?.id,
      messagesLength: messages.length,
      prevMessagesLength: prevMessagesLengthRef.current,
      isNearBottom,
      hasScrolledForThisChannel,
      isInitialLoad: isInitialLoad.current,
      shouldRestoreScroll: shouldRestoreScroll.current,
      scrollHeight: container.scrollHeight,
      scrollTop: container.scrollTop,
      clientHeight: container.clientHeight,
      distanceFromBottom: container.scrollHeight - container.scrollTop - container.clientHeight
    });

    // НЕ скроллим вниз если нужно восстановить позицию скролла
    if (shouldRestoreScroll.current) {
      console.log('[SCROLL] ⛔ НЕ скроллим: нужно восстановить позицию (shouldRestoreScroll=true)');
      return;
    }

    // НЕ скроллим если уже скроллили для этого канала
    if (hasScrolledForThisChannel) {
      console.log('[SCROLL] ⛔ НЕ скроллим: канал уже был проскроллен');
      return;
    }

    // Скроллим вниз если:
    // 1. Это начальная загрузка сообщений для нового канала И есть хотя бы одно сообщение
    // 2. ИЛИ пользователь был близко к низу И количество сообщений увеличилось
    const shouldScroll = (isInitialLoad.current && messages.length > 0) || (isNearBottom && messages.length >= prevMessagesLengthRef.current);

    console.log('[SCROLL] 🔎 Проверка shouldScroll:', {
      shouldScroll,
      condition1: isInitialLoad.current && messages.length > 0,
      condition2: isNearBottom && messages.length >= prevMessagesLengthRef.current
    });

    if (shouldScroll) {
      console.log('[SCROLL] ✅ СКРОЛЛИМ ВНИЗ');
      autoScrollToBottom('layoutEffect');
    } else {
      console.log('[SCROLL] ⏭️ НЕ скроллим по условию');
    }

    prevMessagesLengthRef.current = messages.length;
  }, [messages, channel?.id, autoScrollToBottom, getSavedScrollPosition]);

  // ResizeObserver для автоматического скролла при росте высоты (загрузка изображений)
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || !channel?.id) return;

    // Проверяем, нужно ли следить за изменением высоты для этого канала
    // ResizeObserver нужен только если НЕТ сохраненной позиции (т.е. это новый канал или первая загрузка)
    const savedPosition = getSavedScrollPosition(channel.id);
    const needsAutoScroll = savedPosition === null && !shouldRestoreScroll.current;

    if (!needsAutoScroll) {
      console.log('[SCROLL] 👁️ ResizeObserver НЕ нужен для этого канала (есть savedPosition или shouldRestoreScroll)');
      return;
    }

    console.log('[SCROLL] 👁️ Создаем ResizeObserver для канала:', channel.id);

    let lastHeight = container.scrollHeight;
    let resizeCount = 0;
    const maxResizes = 50; // Максимум 50 ресайзов, потом отключаемся

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newHeight = entry.target.scrollHeight;

        if (newHeight > lastHeight) {
          resizeCount++;
          console.log('[SCROLL] 📏 ResizeObserver: высота увеличилась с', lastHeight, 'до', newHeight, `(resize #${resizeCount})`);

          // Скроллим вниз при увеличении высоты
          autoScrollToBottom('resizeObserver');
          console.log('[SCROLL] ✅ ResizeObserver: автоскролл выполнен');

          lastHeight = newHeight;

          // Останавливаем наблюдение после максимального количества ресайзов
          if (resizeCount >= maxResizes) {
            console.log('[SCROLL] 🛑 ResizeObserver: достигнут лимит ресайзов, останавливаем');
            resizeObserver.disconnect();
          }
        }
      }
    });

    resizeObserver.observe(container);
    resizeObserverRef.current = resizeObserver;

    // Автоматически останавливаем наблюдение через 5 секунд
    const timeout = setTimeout(() => {
      console.log('[SCROLL] ⏱️ ResizeObserver: таймаут 5 секунд, останавливаем');
      resizeObserver.disconnect();
      resizeObserverRef.current = null;
    }, 5000);

    return () => {
      console.log('[SCROLL] 🧹 ResizeObserver: cleanup');
      resizeObserver.disconnect();
      resizeObserverRef.current = null;
      clearTimeout(timeout);
    };
  }, [channel?.id, getSavedScrollPosition, autoScrollToBottom]);

  // Привязываем обработчик скролла
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (handleScroll.timeoutId) {
        clearTimeout(handleScroll.timeoutId);
      }
    };
  }, [handleScroll]);

  // Дополнительный эффект для скролла при первом рендере с сообщениями
  useEffect(() => {
    console.log('[SCROLL] 🔧 useEffect дополнительный скролл:', {
      channelId: channel?.id,
      preloadedMessages,
      messagesLength: messages.length,
      hasScrolledForThisChannel: scrolledChannelsRef.current.has(channel?.id),
      shouldRestoreScroll: shouldRestoreScroll.current
    });

    // Если есть предзагруженные сообщения, показываем их сразу
    if (preloadedMessages && messages.length > 0) {
      console.log('[SCROLL] 📦 Есть предзагруженные сообщения - показываем сразу');
      setShowMessages(true);
      return;
    }

    const hasScrolledForThisChannel = scrolledChannelsRef.current.has(channel?.id);

    // Если есть сообщения и мы еще не скроллили этот канал
    if (messages.length > 0 && !hasScrolledForThisChannel && messagesEndRef.current) {
      console.log('[SCROLL] 📝 Есть сообщения и канал не был проскроллен');

      // Проверяем, нужно ли восстановить скролл
      if (shouldRestoreScroll.current && channel?.id) {
        const savedPosition = getSavedScrollPosition(channel.id);
        console.log('[SCROLL] 🔄 Проверяем восстановление скролла, savedPosition:', savedPosition);

        if (savedPosition !== null && messagesContainerRef.current) {
          console.log('[SCROLL] ✅ Восстанавливаем сохраненную позицию:', savedPosition);
          messagesContainerRef.current.scrollTop = savedPosition;
          shouldRestoreScroll.current = false;
          markChannelScrolled(channel.id, 'initial-effect-restore');
          setShowMessages(true);
          return;
        }
      }

      // Скроллим вниз для нового канала
      console.log('[SCROLL] ⬇️ Скроллим вниз для нового канала');
      autoScrollToBottom('initial-load-effect');

      // Показываем сообщения после скролла
      setShowMessages(true);

      // Дополнительный скролл через микрозадачу для надежности
      Promise.resolve().then(() => {
        autoScrollToBottom('initial-load-effect-microtask');
        console.log('[SCROLL] ✅ Дополнительный скролл через Promise выполнен');
      });
    } else if (messages.length === 0 && channel?.id) {
      // Если сообщений нет, показываем приветственное сообщение сразу
      console.log('[SCROLL] 📄 Нет сообщений - показываем приветственное сообщение');
      setShowMessages(true);
    }
  }, [messages.length, channel?.id, preloadedMessages, getSavedScrollPosition, autoScrollToBottom, markChannelScrolled]);

  // Обработка изменения в поле ввода для автокомплита упоминаний
  const handleInputChange = (e) => {
    const value = e.target.value;
    setInputValue(value);

    // Проверяем, есть ли @ в тексте
    const cursorPosition = e.target.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      // Проверяем, что после @ нет пробела
      if (!textAfterAt.includes(' ')) {
        // Показываем автокомплит
        // Получаем размеры родительского контейнера поля ввода
        const fieldRect = messageInputFieldRef.current?.getBoundingClientRect();
        if (fieldRect) {
          setMentionPosition({
            top: fieldRect.top - 8, // Показываем прямо над полем ввода с небольшим отступом
            left: fieldRect.left,
            width: fieldRect.width
          });
          setMentionFilter(textAfterAt);
          setShowMentionAutocomplete(true);
          setMentionSelectedIndex(0);
        }
      } else {
        setShowMentionAutocomplete(false);
      }
    } else {
      setShowMentionAutocomplete(false);
    }
  };

  // Выбор пользователя из автокомплита
  const handleMentionSelect = (user) => {
    const cursorPosition = inputRef.current.selectionStart;
    const textBeforeCursor = inputValue.substring(0, cursorPosition);
    const textAfterCursor = inputValue.substring(cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const newValue =
        inputValue.substring(0, lastAtIndex) +
        `@${user.username} ` +
        textAfterCursor;
      setInputValue(newValue);

      // Устанавливаем курсор после упоминания
      setTimeout(() => {
        const newCursorPos = lastAtIndex + user.username.length + 2;
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
        inputRef.current.focus();
      }, 0);
    }

    setShowMentionAutocomplete(false);
  };

  // Обработка клавиш в поле ввода
  const handleInputKeyDown = (e) => {
    if (showMentionAutocomplete) {
      const filteredUsers = serverMembers.filter(user =>
        user.username.toLowerCase().startsWith(mentionFilter.toLowerCase())
      );

      // Добавляем @everyone если подходит
      let suggestions = [];
      if ('everyone'.startsWith(mentionFilter.toLowerCase())) {
        suggestions.push({ id: 'everyone', username: 'everyone' });
      }
      suggestions = [...suggestions, ...filteredUsers];

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionSelectedIndex(prev =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionSelectedIndex(prev => prev > 0 ? prev - 1 : 0);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (suggestions[mentionSelectedIndex]) {
          handleMentionSelect(suggestions[mentionSelectedIndex]);
        }
        return;
      } else if (e.key === 'Escape') {
        setShowMentionAutocomplete(false);
      }
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Закрываем автокомплит если он открыт
    if (showMentionAutocomplete) {
      setShowMentionAutocomplete(false);
    }

    const trimmedValue = inputValue.trim();
    if (trimmedValue || selectedFiles.length > 0) {
      const replyTarget = replyingTo
        ? messages.find(msg => msg.id === replyingTo.id) || replyingTo
        : null;

      console.log('[SCROLL] 📤 Отправка сообщения - будет скролл через 100мс');
      onSendMessage(trimmedValue, selectedFiles, replyTarget);
      setInputValue('');
      setSelectedFiles([]);
      setReplyingTo(null);

      // Автоматически прокручиваем вниз после отправки сообщения
      setTimeout(() => {
        scrollToBottom();
      }, 100);
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

    // Проверяем, есть ли файл больше 5 МБ
    const hasOversizedFile = files.some(file => file.size > maxSize);
    if (hasOversizedFile) {
      setShowFileSizeError(true);
      e.target.value = ''; // Очищаем input
      return;
    }

    const validFiles = files.filter(file => {
      if (!allowedTypes.includes(file.type)) {
        alert(`Файл "${file.name}" не поддерживается. Разрешены только изображения (JPEG, PNG, GIF, WebP)`);
        return false;
      }
      return true;
    });

    setSelectedFiles(prev => [...prev, ...validFiles]);
    e.target.value = ''; // Очищаем input для возможности выбора того же файла
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const openFileDialog = () => {
    document.getElementById('file-input').click();
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Обработка клика на упоминание пользователя
  const handleMentionClick = async (mentionUsername, event) => {
    // Не показываем профиль для @everyone
    if (mentionUsername === 'everyone') return;

    // Ищем пользователя среди участников сервера
    const mentionedUser = serverMembers.find(member =>
      member.username.toLowerCase() === mentionUsername.toLowerCase()
    );

    if (!mentionedUser) return;

    // Умное позиционирование профильной карточки
    const rect = event.currentTarget.getBoundingClientRect();
    const cardWidth = 300; // Примерная ширина карточки
    const cardHeight = 200; // Примерная высота карточки
    const padding = 10; // Отступ от края экрана

    let top = rect.top;
    let left = rect.right + 8;

    // Проверяем, не уходит ли карточка за правый край экрана
    if (left + cardWidth > window.innerWidth - padding) {
      left = rect.left - cardWidth - 8; // Показываем слева от элемента
    }

    // Проверяем, не уходит ли карточка за нижний край экрана
    if (top + cardHeight > window.innerHeight - padding) {
      // Если места внизу мало, показываем над элементом
      // Выравниваем нижний край карточки с верхним краем элемента
      top = rect.top - cardHeight - 8;

      // Проверяем, не уходит ли карточка за верхний край экрана после сдвига вверх
      if (top < padding) {
        // Если карточка все еще не помещается сверху, центрируем её по вертикали
        top = Math.max(padding, (window.innerHeight - cardHeight) / 2);
      }
    }

    // Проверяем, не уходит ли карточка за верхний край экрана (для обычного случая)
    if (top < padding) {
      top = padding;
    }

    // Проверяем, не уходит ли карточка за левый край экрана
    if (left < padding) {
      left = padding;
    }

    setProfilePosition({
      top: Math.max(padding, top),
      left: Math.max(padding, left)
    });

    setSelectedUser({
      username: mentionedUser.username,
      displayName: mentionedUser.displayName,
      avatar: mentionedUser.avatar,
      badge: mentionedUser.badge,
      badgeTooltip: mentionedUser.badgeTooltip,
      userId: mentionedUser.id
    });
  };

  // Функция для подсветки упоминаний в тексте
  const highlightMentions = (text) => {
    if (!text) return null;

    // Регулярное выражение для поиска упоминаний
    const mentionRegex = /(@\w+)/g;
    const parts = text.split(mentionRegex);

    return parts.map((part, index) => {
      if (part.startsWith('@')) {
        const mentionUsername = part.substring(1);
        const isCurrentUser = mentionUsername === username;
        const isEveryone = mentionUsername === 'everyone';

        return (
          <span
            key={index}
            className={`message-mention ${isCurrentUser ? 'mention-current-user' : ''} ${isEveryone ? 'mention-everyone' : ''} ${!isEveryone ? 'mention-clickable' : ''}`}
            title={isEveryone ? 'Все участники' : `@${mentionUsername}`}
            onClick={(e) => handleMentionClick(mentionUsername, e)}
            style={{ cursor: isEveryone ? 'default' : 'pointer' }}
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  // Функция для проверки, упомянут ли текущий пользователь в сообщении
  const isUserMentioned = (message) => {
    if (!message.mentions || !username) return false;

    // Проверяем только упоминания текущего пользователя или @everyone
    return message.mentions.some(mention => {
      // Если это @everyone - всегда подсвечиваем
      if (mention.type === 'everyone') {
        return true;
      }
      // Если это обычное упоминание - проверяем имя пользователя
      if (mention.type === 'user' && mention.username) {
        return mention.username.toLowerCase() === username.toLowerCase();
      }
      return false;
    });
  };

  // Функция для группировки сообщений
  const groupMessages = (messages) => {
    if (!messages || messages.length === 0) return [];

    const grouped = [];
    let currentGroup = null;

    messages.forEach((message, index) => {
      const messageTime = new Date(message.timestamp);
      const messageMinute = messageTime.getMinutes();
      const messageHour = messageTime.getHours();

      // Проверяем, нужно ли начать новую группу
      const shouldStartNewGroup = !currentGroup ||
        currentGroup.username !== message.username ||
        currentGroup.hour !== messageHour ||
        currentGroup.minute !== messageMinute;

      if (shouldStartNewGroup) {
        // Создаем новую группу
        currentGroup = {
          username: message.username,
          userId: message.userId,
          hour: messageHour,
          minute: messageMinute,
          messages: [message],
          timestamp: message.timestamp,
          isOwn: message.username === username
        };
        grouped.push(currentGroup);
      } else {
        // Добавляем сообщение в существующую группу
        currentGroup.messages.push(message);
      }
    });

    return grouped;
  };

  if (!channel) {
    // Показываем welcome-экран только если есть выбранный сервер
    if (hasServer) {
      return (
        <div className="chat">
          <div className="no-channel">
            {serverLoading ? (
              <>
                <h2>Загрузка...</h2>
                <p>Загружаем каналы сервера</p>
              </>
            ) : hasTextChannels ? (
              <>
                <h2>Добро пожаловать во Флудилку! 👋</h2>
                <p>Выберите канал слева, чтобы начать общение</p>
              </>
            ) : (
              <>
                <h2>НЕТ ТЕКСТОВЫХ КАНАЛОВ</h2>
                <p>Вы оказались в странном месте. У вас нет доступа к текстовым каналам, или на этом сервере их нет.</p>
              </>
            )}
          </div>
        </div>
      );
    }
    // Если сервер не выбран, показываем пустой экран
    return <div className="chat" />;
  }

  const resolvedReplyTarget = replyingTo
    ? messages.find(msg => msg.id === replyingTo.id) || replyingTo
    : null;

  return (
    <div className="chat">
      <div className="chat-header">
        <span className="channel-icon">#</span>
        <h3>{channel.name}</h3>
      </div>

      <div
        className="messages-container"
        ref={messagesContainerRef}
      >
        {isLoadingMessages ? (
          <div className="chat-skeleton">
            <div className="skeleton-welcome">
              <div className="skeleton-icon"></div>
              <div className="skeleton-title"></div>
              <div className="skeleton-subtitle"></div>
            </div>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="skeleton-message">
                <div className="skeleton-avatar"></div>
                <div className="skeleton-content">
                  <div className="skeleton-header"></div>
                  <div className="skeleton-text"></div>
                  <div className="skeleton-text short"></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="messages-welcome" style={{ opacity: showMessages ? 1 : 0, transition: 'opacity 0.15s ease' }}>
              <div className="welcome-icon">#</div>
              <h2>Добро пожаловать в #{channel.name}!</h2>
              <p>Это начало канала #{channel.name}</p>
            </div>

            <div style={{ opacity: showMessages ? 1 : 0, transition: 'opacity 0.15s ease' }}>
            {groupMessages(messages).map((group, groupIndex) =>
          group.messages.map((message, messageIndex) => (
            <div
              key={message.id}
              data-message-id={message.id}
              className={`message ${message.isSystem ? 'system-message' : ''} ${message.username === username ? 'own-message' : ''} ${isUserMentioned(message) ? 'message-mentioned' : ''} ${editingMessage?.id === message.id ? 'message-edit-mode' : ''} ${contextMenu?.message.id === message.id ? 'show-actions' : ''} ${messageIndex > 0 ? 'message-grouped' : ''} ${messageIndex === 0 && group.messages.length > 1 ? 'message-group-first' : ''} ${messageIndex === group.messages.length - 1 ? 'message-group-last' : ''} ${deletingMessageId === message.id ? 'message-deleting' : ''} ${highlightedMessageId === message.id ? 'message-highlighted' : ''}`}
            >
              {messageIndex === 0 ? (
                <div
                  className="message-avatar"
                  onClick={(e) => !message.isSystem && handleUserClick(message, e)}
                  style={{ cursor: message.isSystem ? 'default' : 'pointer' }}
                >
                  {message.isSystem ? (
                    '🤖'
                  ) : message.avatar ? (
                    <>
                      <img
                        src={`${BACKEND_URL}${message.avatar}`}
                        alt={message.username}
                        loading="lazy"
                        onError={(e) => {
                          // Если изображение не загрузилось, показываем букву
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                      <div className="message-avatar-fallback" style={{ display: 'none' }}>
                        {(message.displayName || message.username)[0].toUpperCase()}
                      </div>
                    </>
                  ) : (
                    <div className="message-avatar-fallback">
                      {(message.displayName || message.username)[0].toUpperCase()}
                    </div>
                  )}
                </div>
              ) : (
                <div className="message-avatar-spacer"></div>
              )}
              <div className="message-content">
                {messageIndex === 0 && (
                  <div className="message-header">
                    <span
                      className="message-username"
                      onClick={(e) => !message.isSystem && handleUserClick(message, e)}
                      style={{ cursor: message.isSystem ? 'default' : 'pointer' }}
                    >
                      {message.displayName || message.username}
                    </span>
                    {message.badge && message.badge !== 'User' && (
                      <span
                        className="message-badge"
                        title={message.badgeTooltip || message.badge}
                      >
                        {message.badge}
                      </span>
                    )}
                    <span className="message-time">{formatTime(message.timestamp)}</span>
                  </div>
                )}

                {editingMessage?.id === message.id ? (
                  <div>
                    <textarea
                      className="message-edit-input"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSaveEdit();
                        } else if (e.key === 'Escape') {
                          handleCancelEdit();
                        }
                      }}
                      autoFocus
                    />
                    <div className="message-edit-buttons">
                      <button
                        className="message-edit-button save"
                        onClick={handleSaveEdit}
                        disabled={!editValue.trim()}
                      >
                        Сохранить
                      </button>
                      <button
                        className="message-edit-button cancel"
                        onClick={handleCancelEdit}
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="message-content-wrapper">
                    {message.replyTo && (
                      <button
                        type="button"
                        className="message-reply-preview"
                        onClick={() => handleReplyNavigation(message.replyTo?.messageId)}
                      >
                        <span className="message-reply-accent" aria-hidden="true"></span>
                        <div className="message-reply-content">
                          <div className="message-reply-title">
                            {message.replyTo.displayName || message.replyTo.username || 'Неизвестный пользователь'}
                          </div>
                          <div className="message-reply-text">
                            {getReplySnippetFromMeta(message.replyTo)}
                          </div>
                        </div>
                      </button>
                    )}
                    {message.content && (
                      <div className="message-text">{highlightMentions(message.content)}</div>
                    )}
                    {message.attachments && message.attachments.length > 0 && (
                      <div className="message-attachments">
                        {message.attachments.map((attachment, index) => (
                          <div key={index} className="message-attachment">
                            {attachment.mimetype.startsWith('image/') ? (
                              <div
                                className="message-attachment-image-wrapper"
                                onClick={() => window.open(`${BACKEND_URL}${attachment.path}`, '_blank')}
                              >
                                <img
                                  src={`${BACKEND_URL}${attachment.path}`}
                                  alt={attachment.originalName}
                                  className="message-attachment-image"
                                  loading="lazy"
                                  onLoad={(e) => {
                                    // Убираем shimmer когда изображение загрузилось
                                    const wrapper = e.target.parentElement;
                                    if (wrapper) {
                                      wrapper.setAttribute('data-loaded', 'true');
                                    }
                                  }}
                                />
                              </div>
                            ) : (
                              <div className="message-attachment-file">
                                <span className="attachment-icon">📎</span>
                                <span className="attachment-name">{attachment.originalName}</span>
                                <span className="attachment-size">{(attachment.size / 1024 / 1024).toFixed(2)} MB</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Реакции на сообщение */}
                {!message.isSystem && !editingMessage && (
                  <MessageReactions
                    reactions={message.reactions}
                    onReactionClick={(emoji, userReacted) => handleReactionClick(message.id, emoji, userReacted)}
                    currentUserId={user?.id}
                  />
                )}
              </div>

              {/* Меню действий - показываем для всех не системных сообщений */}
              {!message.isSystem && (
                <div className="message-actions">
                  <button
                    className="message-actions-button"
                    onClick={() => handleReplySelect(message)}
                    title="Ответить"
                  >
                    <img src="/icons/reply.png" alt="Ответить" className="message-actions-icon reply-icon" />
                  </button>
                  <button
                    className="message-actions-button"
                    onClick={(e) => handleAddReaction(message.id, e)}
                    title="Добавить реакцию"
                  >
                    <img src="/icons/emoji.png" alt="Добавить реакцию" className="message-actions-icon" />
                  </button>
                  {canEditMessage(message) && (
                    <button
                      className="message-actions-button"
                      onClick={() => handleEditMessage(message)}
                      title="Редактировать"
                    >
                      <img src="/icons/edit.png" alt="Редактировать" className="message-actions-icon" />
                    </button>
                  )}
                  {canDeleteMessage(message) && (
                    <button
                      className="message-actions-button"
                      onClick={(e) => handleMoreActions(message, e)}
                      title="Больше действий"
                    >
                      ⋯
                    </button>
                  )}
                </div>
              )}
            </div>
          ))
        ).flat()}
            </div>
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="message-input-container">
        {/* Превью выбранных файлов */}
        {selectedFiles.length > 0 && (
          <div className="file-preview-container">
            {selectedFiles.map((file, index) => (
              <div key={index} className="file-preview">
                <img
                  src={URL.createObjectURL(file)}
                  alt={file.name}
                  className="file-preview-image"
                />
                <div className="file-preview-info">
                  <span className="file-preview-name">{file.name}</span>
                  <span className="file-preview-size">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                </div>
                <button
                  type="button"
                  className="file-preview-remove"
                  onClick={() => removeFile(index)}
                  title="Удалить файл"
                >
                  <img src="/icons/trash.png" alt="Удалить" />
                </button>
              </div>
            ))}
          </div>
        )}

        {resolvedReplyTarget && (
          <div className="message-reply-banner">
            <div
              className="message-reply-banner-info"
              onClick={() => handleReplyNavigation(resolvedReplyTarget.id)}
            >
              <div className="message-reply-banner-title">
                Ответ на сообщение <span className="message-reply-banner-author">@{resolvedReplyTarget.displayName || resolvedReplyTarget.username}</span>
              </div>
              <div className="message-reply-banner-text">
                {getReplySnippetFromMessage(resolvedReplyTarget)}
              </div>
            </div>
            <button
              type="button"
              className="message-reply-banner-close"
              onClick={cancelReply}
              title="Отменить ответ"
            >
              ×
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="message-input-wrapper">
            <input
              id="file-input"
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            <div className="message-input-field" ref={messageInputFieldRef}>
              <button
                type="button"
                className="file-attach-button"
                onClick={openFileDialog}
                title="Прикрепить файл"
              >
                <img src="/icons/plus.png" alt="+" />
              </button>
              <div className="input-divider"></div>
              <input
                ref={inputRef}
                type="text"
                placeholder={`Написать в #${channel.name}`}
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleInputKeyDown}
                maxLength={2000}
              />
              <div className="input-divider"></div>
              <button
                type="submit"
                className={`file-send-button ${(!inputValue.trim() && selectedFiles.length === 0) ? 'disabled' : 'active'}`}
                disabled={!inputValue.trim() && selectedFiles.length === 0}
                title="Отправить"
              >
                <img src="/icons/send.png" alt="Отправить" />
              </button>
            </div>
          </div>
        </form>
      </div>

      {selectedUser && (
        <>
          <div className="user-profile-overlay" onClick={handleCloseProfile} />
          <div
            className="user-profile-card-chat"
            style={{
              top: `${profilePosition.top}px`,
              left: `${profilePosition.left}px`
            }}
          >
            <div className="user-profile-banner" />
            <div className="user-profile-content">
              <div className="user-profile-avatar-wrapper">
                {selectedUser.avatar ? (
                  <img
                    src={`${BACKEND_URL}${selectedUser.avatar}`}
                    alt="Avatar"
                    className="user-profile-avatar-large"
                  />
                ) : (
                  <div className="user-profile-avatar-large user-profile-avatar-fallback">
                    {(selectedUser.displayName || selectedUser.username)[0].toUpperCase()}
                  </div>
                )}
              </div>
              {selectedUser.displayName ? (
                <>
                  <div className="user-profile-display-name">
                    {selectedUser.displayName}
                  </div>
                  <div className="user-profile-username-row">
                    <div className="user-profile-username">
                      {selectedUser.username}
                    </div>
                    {selectedUser.badge && selectedUser.badge !== 'User' && (
                      <span className="user-profile-badge">
                        {selectedUser.badge}
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <div className="user-profile-username-row">
                  <div className="user-profile-display-name">
                    {selectedUser.username}
                  </div>
                  {selectedUser.badge && selectedUser.badge !== 'User' && (
                    <span className={`user-profile-badge badge-${selectedUser.badge.toLowerCase()}`}>
                      {selectedUser.badge}
                    </span>
                  )}
                </div>
              )}
            </div>

            <FriendActionButton
              targetUser={selectedUser}
              currentUserId={user?.id}
            />

            {/* Поле для отправки личного сообщения - только если не свой профиль */}
            {selectedUser && (selectedUser.userId !== username && selectedUser.username !== username) && (
              <div className="user-profile-message-input">
                <div className="message-input-container">
                  <input
                    type="text"
                    placeholder={`Сообщение для @${selectedUser.username}`}
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={sendingMessage}
                    className="message-input-field"
                  />
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {contextMenu && (
        <>
          <div className="message-context-overlay" onClick={handleCloseContextMenu} />
          <div
            className="message-context-menu"
            style={{
              top: `${contextMenu.position.top}px`,
              left: `${contextMenu.position.left}px`
            }}
          >
            {canDeleteMessage(contextMenu.message) && (
              <button
                className="message-context-menu-item danger"
                onClick={() => handleDeleteMessage(contextMenu.message)}
              >
                <img src="/icons/trash.png" alt="Удалить" className="context-menu-icon" />
                Удалить сообщение
              </button>
            )}
          </div>
        </>
      )}

      {/* Модальное окно ошибки размера файла */}
      {showFileSizeError && (
        <>
          <div className="file-error-overlay" onClick={() => setShowFileSizeError(false)} />
          <div className="file-error-modal">
            <button className="file-error-close" onClick={() => setShowFileSizeError(false)}>
              ×
            </button>
            <div className="file-error-icon">⚡</div>
            <h2 className="file-error-title">Ой-ой! Файл оказался слишком пухлым</h2>
            <p className="file-error-text">
              Максимальный размер для загрузки — 5 МБ.<br />
              Сейчас мы не умеем загружать такие тяжелые файлы, но когда-нибудь мы победим эту проблему
            </p>
          </div>
        </>
      )}

      {/* Emoji Picker для реакций */}
      {showEmojiPicker && (
        <EmojiPicker
          onEmojiSelect={handleEmojiSelect}
          onClose={() => {
            setShowEmojiPicker(false);
            setSelectedMessageForReaction(null);
          }}
          position={emojiPickerPosition}
        />
      )}

      {/* Автокомплит для упоминаний */}
      {showMentionAutocomplete && (
        <MentionAutocomplete
          users={serverMembers}
          filter={mentionFilter}
          onSelect={handleMentionSelect}
          position={mentionPosition}
          selectedIndex={mentionSelectedIndex}
        />
      )}
    </div>
  );
}

export default Chat;
