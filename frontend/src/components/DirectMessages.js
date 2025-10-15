import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import './DirectMessages.css';
import './FriendActionButton.css';
import UserProfile from './UserProfile';
import FriendsPanel from './FriendsPanel';
import FriendActionButton from './FriendActionButton';
import { useGlobalUsers } from '../context/GlobalUsersContext';
import { useFriends } from '../context/FriendsContext';
import { useFriendStatus } from '../hooks/useFriendStatus';
import { SOCKET_EVENTS } from '../constants/events';
import EmojiPicker from './EmojiPicker';
import MessageReactions from './MessageReactions';
import MarkdownMessage from './MarkdownMessage';
import MessageEmbeds from './MessageEmbeds';
import api from '../services/api';

const BACKEND_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : `${window.location.protocol}//${window.location.hostname}`;

const buildAuthHeaders = (extra = {}) => {
  let token = null;
  try {
    token = localStorage.getItem('token');
  } catch (err) {
    // storage может быть недоступным
  }

  return {
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...extra
  };
};

function DirectMessages({ user, socket, onLogout, onAvatarUpdate, autoSelectUser, onAutoSelectComplete, onUnreadDMsUpdate, isMuted, isDeafened, isInVoice, isSpeaking, onToggleMute, onToggleDeafen, onDisconnect, onDMUserSelect, showOnlyList, showOnlyChat }) {
  const navigate = useNavigate();
  const { globalOnlineUsers } = useGlobalUsers();
  const { incomingRequests, sendFriendRequest, respondToRequest, removeFriend } = useFriends();
  const [directMessages, setDirectMessages] = useState([]);
  const [selectedDM, setSelectedDM] = useState(null);
  const [selectedMessages, setSelectedMessages] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [showMessages, setShowMessages] = useState(true);
  const [showFriendsPanel, setShowFriendsPanel] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [error, setError] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [showFileSizeError, setShowFileSizeError] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiPickerPosition, setEmojiPickerPosition] = useState(null);
  const [selectedMessageForReaction, setSelectedMessageForReaction] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const [addingFriend, setAddingFriend] = useState(false);
  const messagesEndRef = useRef(null);
  const lastProcessedUserIdRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const inputRef = useRef(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [profilePosition, setProfilePosition] = useState({ top: 0, left: 0 });
  const [messageText, setMessageText] = useState('');
  const [sendingDirectMessage, setSendingDirectMessage] = useState(false);
  const [mentionTooltip, setMentionTooltip] = useState(null);
  const [blockStatus, setBlockStatus] = useState(null);
  const [blockActionLoading, setBlockActionLoading] = useState(false);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [blockActionError, setBlockActionError] = useState('');
  const [errorModal, setErrorModal] = useState(null);

  // Discord-like scroll mechanics
  const [bootstrapping, setBootstrapping] = useState(true);
  const initialScrollDoneRef = useRef(false);
  const prevLoadingRef = useRef(false);
  const [newDmMessageIds, setNewDmMessageIds] = useState(new Set());
  const prevMessagesLengthRef = useRef(0);
  const dmWelcomeRef = useRef(null);
  const [dmWelcomeH, setDmWelcomeH] = useState(0);
  const resizeObserverRef = useRef(null);

  // prefersReducedMotion для анимаций
  const prefersReducedMotion = useMemo(() => {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // Функция для проверки блокировки пользователя
  const isUserBlocked = (targetUser, currentUser) => {
    if (!targetUser || !currentUser || !currentUser.blockedUsers) {
      return false;
    }

    const targetUserId = targetUser.userId || targetUser.id || targetUser._id;
    if (!targetUserId) return false;

    return currentUser.blockedUsers.some(blockedUser => {
      const blockedUserId = blockedUser.userId?._id || blockedUser.userId;
      return blockedUserId && blockedUserId.toString() === targetUserId.toString();
    });
  };

  // scrollToBottom функция
  const scrollToBottom = useCallback((smooth = false) => {
    const c = messagesContainerRef.current;
    if (!c || selectedMessages.length === 0) return;

    const target = c.scrollHeight - c.clientHeight;
    console.log(`[DM] scrollToBottom called:`, {
      dmId: selectedDM?._id,
      dmUsername: selectedDM?.user?.username || selectedDM?.username,
      smooth,
      messagesCount: selectedMessages.length,
      scrollHeight: c.scrollHeight,
      clientHeight: c.clientHeight,
      target,
      currentScrollTop: c.scrollTop
    });

    if (smooth && !prefersReducedMotion) {
      c.scrollTo({ top: target, behavior: 'smooth' });
    } else {
      c.scrollTop = target;
    }

    // 👉 оставляем страховку только для НЕплавного
    if (!smooth) {
      setTimeout(() => {
        c.scrollTop = c.scrollHeight - c.clientHeight;
        console.log(`[DM] scrollToBottom fallback applied:`, {
          dmId: selectedDM?._id,
          finalScrollTop: c.scrollTop
        });
      }, 10);
    }
  }, [selectedMessages.length, prefersReducedMotion, selectedDM?._id, selectedDM?.user?.username, selectedDM?.username]);

  const mentionableUsers = useMemo(() => {
    const map = new Map();

    const addUser = (candidate) => {
      if (!candidate) return;
      const username = (candidate.username || '').toLowerCase();
      if (!username) return;

      map.set(username, {
        ...candidate,
        userId: candidate.userId || candidate._id || candidate.id,
        _id: candidate._id || candidate.userId || candidate.id
      });
    };

    if (selectedDM?.user) {
      addUser(selectedDM.user);
    }

    if (Array.isArray(selectedDM?.participants)) {
      selectedDM.participants.forEach(addUser);
    }

    if (Array.isArray(selectedDM?.members)) {
      selectedDM.members.forEach(addUser);
    }

    if (user) {
      addUser({
        ...user,
        _id: user.id,
        userId: user.id
      });
    }

    return map;
  }, [selectedDM, user]);

  const hideMentionTooltip = useCallback(() => setMentionTooltip(null), []);

  // Измерение высоты welcome блока
  useLayoutEffect(() => {
    const el = dmWelcomeRef.current;
    if (!el) return;
    const update = () => setDmWelcomeH(el.offsetHeight || 0);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [selectedDM?._id, messagesLoading]);

  // Сброс флагов при смене собеседника
  useEffect(() => {
    console.log(`[DM] DM changed, resetting scroll flags:`, {
      dmId: selectedDM?._id,
      dmUsername: selectedDM?.user?.username || selectedDM?.username,
      previousDMId: initialScrollDoneRef.current ? 'had previous' : 'none'
    });
    setBootstrapping(true);
    initialScrollDoneRef.current = false;
  }, [selectedDM?._id]);

  // Скролл после завершения первой загрузки
  useEffect(() => {
    const wasLoading = prevLoadingRef.current;
    prevLoadingRef.current = messagesLoading;

    if (wasLoading && !messagesLoading && !initialScrollDoneRef.current && selectedMessages.length > 0) {
      console.log(`[DM] First load completed, scrolling to bottom:`, {
        dmId: selectedDM?._id,
        messagesCount: selectedMessages.length
      });
      const c = messagesContainerRef.current;
      if (c) {
        requestAnimationFrame(() => {
          c.scrollTop = c.scrollHeight - c.clientHeight;
          initialScrollDoneRef.current = true;
          setBootstrapping(false);
          console.log(`[DM] Initial scroll completed after load:`, {
            dmId: selectedDM?._id,
            finalScrollTop: c.scrollTop
          });
          // страховка
          setTimeout(() => {
            c.scrollTop = c.scrollHeight - c.clientHeight;
          }, 0);
        });
      }
    }
  }, [messagesLoading, selectedMessages.length, selectedDM?._id]);

  // Компенсация для welcome-блока
  useLayoutEffect(() => {
    const c = messagesContainerRef.current;
    if (!c) return;

    const atBottom = c.scrollHeight - c.scrollTop - c.clientHeight < 2;
    if (atBottom) {
      console.log(`[DM] Welcome block height changed, maintaining bottom position:`, {
        dmId: selectedDM?._id,
        dmWelcomeH,
        atBottom
      });
      c.scrollTop = c.scrollHeight - c.clientHeight;
    }
  }, [dmWelcomeH, selectedDM?._id]);

  // Первый скролл — синхронно
  useLayoutEffect(() => {
    console.log(`[DM] useLayoutEffect for initial scroll:`, {
      dmId: selectedDM?._id,
      dmUsername: selectedDM?.user?.username || selectedDM?.username,
      messagesLoading,
      messagesCount: selectedMessages.length,
      hasContainer: !!messagesContainerRef.current,
      initialScrollDone: initialScrollDoneRef.current,
      dmWelcomeH
    });

    const c = messagesContainerRef.current;
    if (!c) return;
    if (!selectedDM?._id) return;

    // Пока идёт загрузка — ничего не делаем
    if (messagesLoading) return;
    // Если сообщений пока 0 — тоже ждём (не считаем скролл сделанным)
    if (selectedMessages.length === 0) return;

    if (!initialScrollDoneRef.current) {
      const target = c.scrollHeight - c.clientHeight;
      console.log(`[DM] Initial scroll to bottom:`, {
        dmId: selectedDM?._id,
        dmUsername: selectedDM?.user?.username || selectedDM?.username,
        scrollHeight: c.scrollHeight,
        clientHeight: c.clientHeight,
        target,
        currentScrollTop: c.scrollTop
      });
      // ждём, пока welcome измерится и поток смонтирован
      requestAnimationFrame(() => {
        c.scrollTop = c.scrollHeight - c.clientHeight;
        initialScrollDoneRef.current = true;
        setBootstrapping(false);
        console.log(`[DM] Setting bootstrapping to false for DM:`, selectedDM?._id);
        // ещё одна страховка, если что-то дорисуется следом
        setTimeout(() => {
          c.scrollTop = c.scrollHeight - c.clientHeight;
          console.log(`[DM] Initial scroll fallback applied:`, {
            dmId: selectedDM?._id,
            finalScrollTop: c.scrollTop
          });
        }, 0);
      });
    }
  }, [selectedDM?._id, messagesLoading, selectedMessages.length, dmWelcomeH]);

  // Доскролл после первой реальной загрузки (переход true → false)
  useEffect(() => {
    const wasLoading = prevLoadingRef.current;
    prevLoadingRef.current = messagesLoading;

    // 1) Нормальный кейс: загрузка завершилась, сообщения есть — докрутим вниз
    if (wasLoading && !messagesLoading && !initialScrollDoneRef.current && selectedMessages.length > 0) {
      const c = messagesContainerRef.current;
      if (c) {
        console.log(`[DM] First load completed, scrolling to bottom:`, {
          dmId: selectedDM?._id,
          messagesCount: selectedMessages.length
        });
        requestAnimationFrame(() => {
          c.scrollTop = c.scrollHeight - c.clientHeight;
          initialScrollDoneRef.current = true;
          setBootstrapping(false);
          setTimeout(() => {
            c.scrollTop = c.scrollHeight - c.clientHeight;
          }, 0);
        });
      }
    }

    // 2) Новый кейс: загрузка завершилась, а сообщений НЕТ — просто показываем welcome
    if (wasLoading && !messagesLoading && selectedMessages.length === 0) {
      console.log(`[DM] First load completed with empty DM, showing welcome:`, {
        dmId: selectedDM?._id
      });
      initialScrollDoneRef.current = true; // инициализацию считаем завершённой для пустого DM
      setBootstrapping(false);             // чтобы visibility стало 'visible'
    }
  }, [messagesLoading, selectedMessages.length, selectedDM?._id]);

  // Анимация новых сообщений
  useLayoutEffect(() => {
    if (!messagesContainerRef.current || !selectedDM?._id) return;

    const container = messagesContainerRef.current;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    const hasNewMessages = selectedMessages.length > prevMessagesLengthRef.current;

    if (hasNewMessages) {
      // 👉 не анимируем на первом заходе
      const isFirstPaint = prevMessagesLengthRef.current === 0;

      if (!isFirstPaint && isNearBottom && !bootstrapping) {
        const newIds = new Set();
        const start = prevMessagesLengthRef.current;
        for (let i = start; i < selectedMessages.length; i++) {
          if (selectedMessages[i]?._id) newIds.add(selectedMessages[i]._id);
        }
        setNewDmMessageIds(newIds);
        scrollToBottom(true);
        setTimeout(() => setNewDmMessageIds(new Set()), 200);
      }
    }

    prevMessagesLengthRef.current = selectedMessages.length;
  }, [selectedMessages.length, scrollToBottom, selectedDM?._id, bootstrapping]);

  // ResizeObserver для автоскролла при догрузке медиа
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || !selectedDM?._id) return;

    const isUserNearBottom = () =>
      container.scrollHeight - container.scrollTop - container.clientHeight < 100;

    let lastHeight = container.scrollHeight;
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newHeight = entry.target.scrollHeight;
        if (newHeight > lastHeight) {
          if (!bootstrapping && isUserNearBottom()) {
            scrollToBottom(true);
          }
          lastHeight = newHeight;
        }
      }
    });

    resizeObserver.observe(container);
    resizeObserverRef.current = resizeObserver;

    return () => {
      resizeObserver.disconnect();
      resizeObserverRef.current = null;
    };
  }, [selectedDM?._id, scrollToBottom, bootstrapping]);

  // Функция для проверки онлайн статуса пользователя
  const isUserOnline = useCallback((userId) => {
    return globalOnlineUsers.some(onlineUser => onlineUser.userId === userId);
  }, [globalOnlineUsers]);

  // Обработчик клика на пользователя для показа карточки профиля
  const handleUserClick = useCallback(async (sender, event) => {
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
    if (sender._id) {
      try {
        const userData = await api.getUserById(sender._id);
        if (userData) {
          setSelectedUser({
            ...userData,
            userId: userData._id || userData.id || userData.userId
          });
          return;
        }
      } catch (err) {
        console.error('Ошибка загрузки данных пользователя:', err);
      }
    }

    // Fallback: использовать данные из сообщения
    setSelectedUser({
      username: sender.username,
      displayName: sender.displayName,
      avatar: sender.avatar,
      badge: sender.badge,
      badgeTooltip: sender.badgeTooltip,
      userId: sender._id,
      _id: sender._id
    });
  }, []);

  const handleCloseProfile = () => {
    setSelectedUser(null);
    setMessageText('');
  };

  const handleMentionClick = useCallback((mentionData, event) => {
    const mentionUsername = typeof mentionData === 'string'
      ? mentionData
      : mentionData?.username;

    if (!mentionUsername) {
      return;
    }

    if (mentionData && typeof mentionData === 'object' && mentionData.type && mentionData.type !== 'user') {
      return;
    }

    hideMentionTooltip();

    const normalized = mentionUsername.toLowerCase();

    if (normalized === 'everyone') {
      return;
    }

    const mentionElement = mentionData?.element || event?.target?.closest('[data-mention]');

    if (!mentionElement) {
      return;
    }

    const mentionedUser = mentionableUsers.get(normalized);

    if (!mentionedUser) {
      return;
    }

    handleUserClick(mentionedUser, { currentTarget: mentionElement });
  }, [handleUserClick, hideMentionTooltip, mentionableUsers]);

  const handleMentionHover = useCallback((mentionMeta, sourceMessage) => {
    if (!mentionMeta) {
      return;
    }

    const { rect, clientX, clientY } = mentionMeta;
    const tooltipWidth = 220;
    const padding = 12;
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 0;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 0;

    let left = rect ? rect.left + rect.width / 2 : clientX ?? 0;
    if (viewportWidth) {
      left = Math.max(
        padding + tooltipWidth / 2,
        Math.min(left, viewportWidth - padding - tooltipWidth / 2)
      );
    }

    if (!Number.isFinite(left)) {
      left = padding + tooltipWidth / 2;
    }

    let top = rect ? rect.bottom + 8 : (clientY ?? 0) + 12;
    if (viewportHeight) {
      if (top > viewportHeight - padding) {
        top = rect ? rect.top - 8 : (clientY ?? 0) - 12;
      }
      top = Math.max(top, padding);
    }

    if (!Number.isFinite(top)) {
      top = padding;
    }

    const position = { top, left };
    const type = mentionMeta.type || 'user';

    if (type === 'role') {
      const displayName = mentionMeta.username?.startsWith('@')
        ? mentionMeta.username
        : `@${mentionMeta.username || 'роль'}`;
      setMentionTooltip({
        displayName,
        subtitle: 'Роль сервера',
        role: null,
        position,
        username: mentionMeta.username || displayName
      });
      return;
    }

    if (type === 'channel') {
      setMentionTooltip({
        displayName: mentionMeta.username || '#канал',
        subtitle: 'Канал сервера',
        role: null,
        position,
        username: mentionMeta.username || '#канал'
      });
      return;
    }

    if (!mentionMeta.username) {
      return;
    }

    const normalized = mentionMeta.username.toLowerCase();

    if (normalized === 'everyone') {
      hideMentionTooltip();
      return;
    }
    const mentionEntry = mentionableUsers.get(normalized) ||
      (Array.isArray(sourceMessage?.mentions)
        ? sourceMessage.mentions.find(item => item.username?.toLowerCase() === normalized)
        : null);

    const displayName = mentionEntry?.displayName
      || mentionEntry?.nickname
      || mentionMeta.username;

    const subtitleUsername = mentionEntry?.username || mentionMeta.username;
    const subtitle = `@${subtitleUsername}`;

    let roleName;
    if (mentionEntry?.primaryRole?.name) {
      roleName = mentionEntry.primaryRole.name;
    } else if (Array.isArray(mentionEntry?.roles) && mentionEntry.roles.length > 0) {
      const primaryRole = mentionEntry.roles.find(role => role.isPrimary || role.primary);
      roleName = primaryRole?.name || mentionEntry.roles[0]?.name;
    } else if (mentionEntry?.roleName) {
      roleName = mentionEntry.roleName;
    }

    setMentionTooltip({
      displayName,
      subtitle,
      role: roleName,
      position,
      username: mentionMeta.username
    });
  }, [hideMentionTooltip, mentionableUsers]);

  // Обработчик отправки личного сообщения из карточки профиля
  const handleSendDirectMessageFromProfile = async () => {
    if (!messageText.trim() || !selectedUser || sendingDirectMessage) return;

    // Определяем ID получателя
    const receiverId = selectedUser.userId || selectedUser._id || selectedUser.id;

    console.log('📤 Отправка сообщения:', {
      receiverId,
      currentUserId: user?.id,
      selectedUser
    });

    // Не отправляем сообщение самому себе
    if (!receiverId || receiverId === user?.id) {
      console.warn('⚠️ Попытка отправить сообщение самому себе');
      return;
    }

    setSendingDirectMessage(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/direct-messages/send`, {
        method: 'POST',
        headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({
          receiverId: receiverId,
          content: messageText.trim()
        })
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('❌ Ошибка отправки сообщения:', response.status, error);
        throw new Error(error.error || 'Ошибка отправки сообщения');
      }

      const newMessage = await response.json();
      console.log('✅ Сообщение отправлено успешно:', newMessage);

      // Очищаем поле ввода и закрываем карточку
      setMessageText('');
      handleCloseProfile();

      // Проверяем, открыт ли уже диалог с этим пользователем
      const isCurrentlySelected = selectedDM && (selectedDM._id === receiverId || selectedDM.user?._id === receiverId);

      if (isCurrentlySelected) {
        // Если диалог уже открыт, добавляем сообщение в список
        setSelectedMessages(prev => [...prev, newMessage]);
        setTimeout(() => scrollToBottom(), 100);
      } else {
        // Если диалог не открыт, находим или создаем conversation и открываем его
        const conversation = directMessages.find(dm =>
          dm._id === receiverId || dm.user?._id === receiverId
        );

        if (conversation) {
          // Открываем существующий диалог
          setSelectedDM(conversation);
          setShowFriendsPanel(false);
          loadMessagesWithUser(receiverId);
        } else {
          // Создаем новый conversation объект
          const newConversation = {
            _id: receiverId,
            user: {
              _id: receiverId,
              username: selectedUser.username,
              displayName: selectedUser.displayName,
              avatar: selectedUser.avatar
            },
            lastMessage: {
              _id: newMessage._id,
              content: newMessage.content,
              timestamp: newMessage.timestamp,
              sender: {
                _id: user.id,
                username: user.username,
                displayName: user.displayName,
                avatar: user.avatar
              }
            },
            unreadCount: 0
          };

          // Добавляем в список разговоров
          setDirectMessages(prev => [newConversation, ...prev]);

          // Открываем новый диалог
          setSelectedDM(newConversation);
          setShowFriendsPanel(false);
          setSelectedMessages([newMessage]);

          // Присоединяемся к комнате DM
          if (socket && user) {
            socket.emit('dm:join', {
              userId: user.id,
              otherUserId: receiverId,
              username: user.username,
              avatar: user.avatar,
              displayName: user.displayName
            });
          }

          setTimeout(() => scrollToBottom(), 100);
        }
      }

      // Обновляем список разговоров в любом случае
      loadDirectMessages();
    } catch (error) {
      console.error('❌ Ошибка отправки сообщения:', error);
    } finally {
      setSendingDirectMessage(false);
    }
  };

  const handleKeyPressProfile = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendDirectMessageFromProfile();
    }
  };





  // Функции для работы с файлами
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

    // Возвращаем фокус в поле ввода после выбора файла
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus({ preventScroll: true });
      }
    }, 50);
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));

    // Возвращаем фокус в поле ввода после удаления файла
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus({ preventScroll: true });
      }
    }, 50);
  };

  const openFileDialog = () => {
    if (blockStatus?.isBlockedByMe || blockStatus?.hasBlockedMe) {
      return;
    }
    document.getElementById('dm-file-input').click();
  };

  // Функция для отправки сообщения
  const handleSendMessage = async (e) => {
    e.preventDefault();

    const currentDM = selectedDM || autoSelectUser;
    if ((!inputValue.trim() && selectedFiles.length === 0) || !currentDM || sendingMessage) {
      return;
    }

    if (blockStatus?.isBlockedByMe || blockStatus?.hasBlockedMe) {
      return;
    }

    setSendingMessage(true);

    try {
      let attachments = [];

      // Если есть файлы, сначала загружаем их
      if (selectedFiles.length > 0) {
        const formData = new FormData();
        selectedFiles.forEach(file => {
          formData.append('files', file);
        });

        const uploadResponse = await fetch(`${BACKEND_URL}/api/messages/upload`, {
          method: 'POST',
          headers: buildAuthHeaders(),
          credentials: 'include',
          body: formData
        });

        if (!uploadResponse.ok) {
          throw new Error('Ошибка загрузки файлов');
        }

        const uploadResult = await uploadResponse.json();
        attachments = uploadResult.files;
      }

      const response = await fetch(`${BACKEND_URL}/api/direct-messages/send`, {
        method: 'POST',
        headers: buildAuthHeaders({
          'Content-Type': 'application/json'
        }),
        credentials: 'include',
        body: JSON.stringify({
          receiverId: currentDM._id,
          content: inputValue.trim(),
          attachments: attachments,
          replyToMessageId: replyingTo ? replyingTo.id : undefined
        })
      });

      if (!response.ok) {
        throw new Error('Ошибка отправки сообщения');
      }

      const newMessage = await response.json();
      console.log('✅ Сообщение отправлено:', newMessage);

      // Добавляем новое сообщение в список
      setSelectedMessages(prev => [...prev, newMessage]);

      // Обновляем список разговоров с новым последним сообщением
      setDirectMessages(prev => {
        const updatedDMs = prev.map(dm => {
          if (dm._id === currentDM._id) {
            return {
              ...dm,
              lastMessage: {
                _id: newMessage._id,
                content: newMessage.content,
                timestamp: newMessage.timestamp,
                sender: {
                  _id: newMessage.sender._id,
                  username: newMessage.sender.username,
                  displayName: newMessage.sender.displayName,
                  avatar: newMessage.sender.avatar
                }
              }
            };
          }
          return dm;
        });

        // Перемещаем обновленный разговор в начало списка
        const updatedDM = updatedDMs.find(dm => dm._id === currentDM._id);
        const otherDMs = updatedDMs.filter(dm => dm._id !== currentDM._id);
        return [updatedDM, ...otherDMs];
      });

      // Очищаем поле ввода и файлы
      setInputValue('');
      setSelectedFiles([]);
      setReplyingTo(null);

      // Прокручиваем к последнему сообщению
      setTimeout(() => scrollToBottom(), 100);

      // Возвращаем фокус в поле ввода после небольшой задержки
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus({ preventScroll: true });
        }
      }, 150);

  } catch (err) {
    console.error('❌ Ошибка отправки сообщения:', err);
    setError('Ошибка отправки сообщения');
    // Возвращаем фокус в поле ввода даже при ошибке
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus({ preventScroll: true });
      }
    }, 100);
  } finally {
    setSendingMessage(false);
  }
};

  // Обработка нажатия клавиш
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
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
      isDM: true
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
        isDM: true
      });
    } else {
      // Добавить реакцию
      socket.emit(SOCKET_EVENTS.REACTION_ADD, {
        messageId,
        emoji,
        userId: user.id,
        username: user.username,
        isDM: true
      });
    }
  };

  const scrollToMessageById = useCallback((messageId) => {
    if (!messageId || !messagesContainerRef.current) return;

    const target = messagesContainerRef.current.querySelector(`[data-message-id="${messageId}"]`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMessageId(messageId);
    }
  }, []);

  // Обработчики контекстного меню
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
    id: message._id,
    sender: {
      username: message.sender.username,
      displayName: message.sender.displayName
    },
    username: message.sender.username,
    displayName: message.sender.displayName,
    content: message.content,
    attachments: message.attachments || []
  });

  const handleReplySelect = (message) => {
    if (!message) return;
    setReplyingTo(buildReplySnapshot(message));
    setContextMenu(null);
    requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true });
    });
  };

  const cancelReply = () => {
    setReplyingTo(null);
    // Возвращаем фокус в поле ввода после отмены ответа
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus({ preventScroll: true });
      }
    }, 50);
  };

  const handleReplyNavigation = (messageId) => {
    if (!messageId) return;
    scrollToMessageById(messageId);
  };

  // Получаем статус дружбы для текущего пользователя в чате
  const currentChatUser = useMemo(() => {
    if (selectedDM?.user) return selectedDM.user;
    if (autoSelectUser?.user) return autoSelectUser.user;
    if (autoSelectUser && !autoSelectUser.user) return autoSelectUser;
    return null;
  }, [selectedDM, autoSelectUser]);

  const currentChatUserId = useMemo(() => {
    return currentChatUser?._id || currentChatUser?.id || null;
  }, [currentChatUser]);

  const { isFriend, hasIncomingRequest, hasOutgoingRequest, incomingRequestId } = useFriendStatus(currentChatUserId);

  // Функция для добавления в друзья
  const handleAddFriend = useCallback(async (targetUser) => {
    if (!targetUser || addingFriend) return;

    setAddingFriend(true);
    try {
      if (isFriend) {
        await removeFriend(currentChatUserId);
      } else if (hasIncomingRequest && incomingRequestId) {
        await respondToRequest(incomingRequestId, 'accept');
      } else if (!hasOutgoingRequest) {
        await sendFriendRequest(targetUser.username);
      }
    } catch (err) {
      console.error('Ошибка действия с другом:', err);

      // Показываем модальное окно с ошибкой
      if (err.message) {
        setErrorModal(err.message);
      }
    } finally {
      setAddingFriend(false);
    }
  }, [sendFriendRequest, removeFriend, respondToRequest, isFriend, hasIncomingRequest, hasOutgoingRequest, incomingRequestId, currentChatUserId, addingFriend]);

  // Функция для получения текста кнопки
  const getFriendButtonText = useCallback(() => {
    if (isFriend) return 'Удалить из друзей';
    if (hasIncomingRequest) return 'Принять заявку в друзья';
    if (hasOutgoingRequest) return 'Заявка в друзья отправлена';
    return 'Добавить в друзья';
  }, [isFriend, hasIncomingRequest, hasOutgoingRequest]);

  // Функция для определения, активна ли кнопка
  const isFriendButtonActive = useCallback(() => {
    return !hasOutgoingRequest && !addingFriend;
  }, [hasOutgoingRequest, addingFriend]);

  const canEditMessage = (message) => {
    if (message.sender._id !== user?.id) return false;
    return true;
  };

  const canDeleteMessage = (message) => {
    if (message.sender._id !== user?.id) return false;
    return true;
  };

  const handleEditMessage = (message) => {
    setEditingMessage(message);
    setEditValue(message.content || '');
    setContextMenu(null);
  };

  const handleSaveEdit = () => {
    if (!editingMessage || !editValue.trim()) return;
    if (!socket) return;

    socket.emit(SOCKET_EVENTS.MESSAGE_EDIT, {
      messageId: editingMessage._id,
      content: editValue.trim(),
      isDM: true
    });

    setEditingMessage(null);
    setEditValue('');
  };

  const handleDeleteMessage = (message) => {
    if (!window.confirm('Вы уверены, что хотите удалить это сообщение?')) return;
    if (!socket) return;

    socket.emit(SOCKET_EVENTS.MESSAGE_DELETE, {
      messageId: message._id,
      isDM: true
    });

    setContextMenu(null);
  };

  // Функция для группировки сообщений «как в Discord»
  const groupMessages = (messages, { thresholdMs = 60_000 } = {}) => {
    if (!Array.isArray(messages) || messages.length === 0) return [];

    const grouped = [];
    let currentGroup = null;

    for (const msg of messages) {
      const t = new Date(msg.timestamp);
      const dayKey = t.getFullYear() + '-' + (t.getMonth()+1) + '-' + t.getDate();

      const needNewGroup =
        !currentGroup ||
        currentGroup.senderId !== msg.sender._id ||
        currentGroup.dayKey !== dayKey ||
        // строгое окно по времени между соседними сообщениями в группе
        (t - new Date(currentGroup.lastTimestamp)) > thresholdMs ||
        // системные сообщения всегда в отдельном блоке
        msg.isSystem;

      if (needNewGroup) {
        currentGroup = {
          senderId: msg.sender._id,
          sender: msg.sender,
          dayKey,
          // для разделителя дат
          date: new Date(t.getFullYear(), t.getMonth(), t.getDate()).toDateString(),
          messages: [msg],
          firstTimestamp: msg.timestamp,
          lastTimestamp: msg.timestamp,
          isOwn: msg.sender._id === user?.id,
        };
        grouped.push(currentGroup);
      } else {
        currentGroup.messages.push(msg);
        currentGroup.lastTimestamp = msg.timestamp;
      }
    }

    return grouped;
  };

  // Группировка сообщений с useMemo
  const groupedDMs = useMemo(
    () => groupMessages(selectedMessages, { thresholdMs: 60_000 }),
    [selectedMessages]
  );

  // Функция для форматирования даты в русском формате
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const months = [
      'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
      'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
    ];

    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();

    return `${day} ${month} ${year} г.`;
  };

  // Обработка кликов вне контекстного меню
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (contextMenu) {
        setContextMenu(null);
      }
    };

    if (contextMenu) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (replyingTo && inputRef.current) {
      inputRef.current.focus({ preventScroll: true });
    }
  }, [replyingTo]);

  useEffect(() => {
    setReplyingTo(null);
    setHighlightedMessageId(null);
  }, [selectedDM?._id]);

  useEffect(() => {
    hideMentionTooltip();
  }, [hideMentionTooltip, selectedDM?._id]);

  useEffect(() => {
    if (replyingTo && !selectedMessages.find(msg => msg._id === replyingTo.id)) {
      setReplyingTo(null);
    }
  }, [selectedMessages, replyingTo]);

  useEffect(() => {
    if (!highlightedMessageId) return;

    const timeout = setTimeout(() => setHighlightedMessageId(null), 1800);
    return () => clearTimeout(timeout);
  }, [highlightedMessageId]);

  const updateConversationBlockStatus = useCallback((targetId, status) => {
    if (!targetId) return;

    setDirectMessages(prev => prev.map(dm => {
      if (!dm) {
        return dm;
      }

      const dmUserId = dm._id || dm.user?._id;
      if (dmUserId && dmUserId.toString() === targetId.toString()) {
        return {
          ...dm,
          blockStatus: status || null
        };
      }

      return dm;
    }));
  }, []);

  const refreshBlockStatus = useCallback(async (targetUserId) => {
    if (!targetUserId) {
      setBlockStatus(null);
      return;
    }

    setBlockActionError('');

    try {
      const status = await api.getBlockStatus(targetUserId);
      setBlockStatus(status);
      updateConversationBlockStatus(targetUserId, status);
    } catch (err) {
      console.error('Ошибка загрузки статуса блокировки:', err);
      setBlockStatus(null);
      updateConversationBlockStatus(targetUserId, null);
    }
  }, [updateConversationBlockStatus]);

  // Мемоизируем функцию загрузки разговоров
  const loadDirectMessages = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      console.log('📥 Загружаем список разговоров...');
      const response = await fetch(`${BACKEND_URL}/api/direct-messages/conversations`, {
        headers: buildAuthHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Ошибка загрузки личных сообщений');
      }

      const data = await response.json();
      console.log('📥 Получены разговоры:', data);

      // Фильтруем и валидируем данные
      const validConversations = Array.isArray(data)
        ? data.filter(conv => {
            const isValid = conv && conv.user && conv.user._id && conv.user.username;
            if (!isValid) {
              console.warn('⚠️ Невалидный разговор отфильтрован:', conv);
            }
            return isValid;
          })
        : [];

      if (validConversations.length !== data.length) {
        console.warn(`⚠️ Отфильтровано ${data.length - validConversations.length} невалидных разговоров`);
      }

      setDirectMessages(validConversations);
    } catch (err) {
      console.error('Ошибка загрузки личных сообщений:', err);
      setError('Не удалось загрузить личные сообщения');
      setDirectMessages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Мемоизируем функцию загрузки сообщений
  const loadMessagesWithUser = useCallback(async (userId) => {
    setMessagesLoading(true);
    setSelectedMessages([]);       // очистили старый поток — покажется скелетон
    setBlockStatus(null);
    setShowBlockDialog(false);
    setBlockReason('');
    try {
      console.log('📥 Загружаем сообщения с пользователем:', userId);

      // Присоединяемся к комнате DM для получения обновлений в реальном времени
      if (socket && user) {
        socket.emit('dm:join', {
          userId: user.id,
          otherUserId: userId,
          username: user.username,
          avatar: user.avatar,
          displayName: user.displayName
        });
        console.log('🔗 Присоединились к комнате DM:', `dm-${user.id}-${userId}`);
      }

      const response = await fetch(`${BACKEND_URL}/api/direct-messages/conversation/${userId}`, {
        headers: buildAuthHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Ошибка загрузки сообщений');
      }

      const data = await response.json();
      console.log('📥 Получены сообщения:', data);
      setSelectedMessages(data);
      await refreshBlockStatus(userId);
    } catch (err) {
      console.error('Ошибка загрузки сообщений:', err);
      setSelectedMessages([]);
      setBlockStatus(null);
    } finally {
      setMessagesLoading(false);   // выключаем скелетон строго после запроса
    }
  }, [socket, user, refreshBlockStatus]);


  const handleOpenBlockDialog = useCallback(() => {
    setBlockActionError('');
    setBlockReason('');
    setShowBlockDialog(true);
  }, []);

  const handleCloseBlockDialog = useCallback(() => {
    setShowBlockDialog(false);
    setBlockActionError('');
  }, []);

  const handleBlockConfirm = useCallback(async () => {
    const targetId = selectedDM?.user?._id || selectedDM?._id || autoSelectUser?.user?._id || autoSelectUser?._id;
    if (!targetId || blockActionLoading) return;

    setBlockActionLoading(true);
    setBlockActionError('');

    try {
      const reason = blockReason.trim();
      await api.blockUser(targetId, reason || undefined);
      await refreshBlockStatus(targetId);
      setShowBlockDialog(false);
      setBlockReason('');
    } catch (err) {
      console.error('Ошибка блокировки пользователя:', err);
      setBlockActionError(err?.message || 'Не удалось заблокировать пользователя');
    } finally {
      setBlockActionLoading(false);
    }
  }, [selectedDM, autoSelectUser, blockReason, blockActionLoading, refreshBlockStatus]);

  const handleUnblock = useCallback(async () => {
    const targetId = selectedDM?.user?._id || selectedDM?._id || autoSelectUser?.user?._id || autoSelectUser?._id;
    if (!targetId || blockActionLoading) return;

    setBlockActionLoading(true);
    setBlockActionError('');

    try {
      await api.unblockUser(targetId);
      await refreshBlockStatus(targetId);
    } catch (err) {
      console.error('Ошибка разблокировки пользователя:', err);
      setBlockActionError(err?.message || 'Не удалось разблокировать пользователя');
    } finally {
      setBlockActionLoading(false);
    }
  }, [selectedDM, autoSelectUser, blockActionLoading, refreshBlockStatus]);

  useEffect(() => {
    if (user) {
      loadDirectMessages();
    }
  }, [user, loadDirectMessages]);

  // Автоматический выбор разговора (десктоп: по userId из URL; мобильный: приходит объект разговора)
  useEffect(() => {
    if (!autoSelectUser) {
      lastProcessedUserIdRef.current = null;
      return;
    }

    // Попытка №1: стандартный путь — у нас есть userId в авто-выборе и загружен список разговоров
    if (directMessages.length > 0 && (autoSelectUser.userId || autoSelectUser.user?._id)) {
      const targetUserId = autoSelectUser.userId || autoSelectUser.user?._id;

      // Предотвращаем повторную обработку того же пользователя
      if (lastProcessedUserIdRef.current === targetUserId) {
        return;
      }

      const conversation = directMessages.find(dm => dm?._id === targetUserId || dm?.user?._id === targetUserId);

      if (conversation) {
        console.log('🎯 Автоматически выбираем разговор с:', conversation.user?.username);
        lastProcessedUserIdRef.current = targetUserId;
        setSelectedDM(conversation);
        setBlockStatus(conversation.blockStatus || null);
        setShowBlockDialog(false);
        setBlockReason('');
        setShowFriendsPanel(false);
        setInputValue('');
        loadMessagesWithUser(conversation._id);

        if (conversation.unreadCount > 0) {
          console.log('📖 Отмечаем сообщения как прочитанные для пользователя:', conversation._id);
          fetch(`${BACKEND_URL}/api/direct-messages/read/${conversation._id}`, {
            method: 'PUT',
            headers: buildAuthHeaders(),
            credentials: 'include'
          })
            .then(response => {
              if (response.ok) {
                setDirectMessages(prev => prev.map(directMsg => {
                  if (directMsg._id === conversation._id) {
                    return { ...directMsg, unreadCount: 0 };
                  }
                  return directMsg;
                }));
                console.log('✅ Сообщения отмечены как прочитанные');
              }
            })
            .catch(err => {
              console.error('❌ Ошибка при отметке сообщений как прочитанных:', err);
            });
        }

        if (onAutoSelectComplete) {
          onAutoSelectComplete();
        }
        return;
      }
    }

    // Попытка №2: мобильный путь — нам пришёл целый объект разговора c `_id`
    if (autoSelectUser._id) {
      // Предотвращаем повторную обработку того же пользователя
      if (lastProcessedUserIdRef.current === autoSelectUser._id) {
        return;
      }

      lastProcessedUserIdRef.current = autoSelectUser._id;
      setSelectedDM(prev => prev?._id === autoSelectUser._id ? prev : autoSelectUser);
      setBlockStatus(autoSelectUser.blockStatus || null);
      setShowBlockDialog(false);
      setBlockReason('');
      setShowFriendsPanel(false);
      setInputValue('');
      loadMessagesWithUser(autoSelectUser._id);

      if (autoSelectUser.unreadCount > 0) {
        try {
          const token = localStorage.getItem('token');
          if (token) {
            console.log('📖 Отмечаем сообщения как прочитанные для пользователя:', autoSelectUser._id);
            fetch(`${BACKEND_URL}/api/direct-messages/read/${autoSelectUser._id}`, {
              method: 'PUT',
              headers: buildAuthHeaders(),
              credentials: 'include'
            }).then(response => {
              if (response.ok) {
                setDirectMessages(prev => prev.map(directMsg => {
                  if (directMsg._id === autoSelectUser._id) {
                    return { ...directMsg, unreadCount: 0 };
                  }
                  return directMsg;
                }));
                console.log('✅ Сообщения отмечены как прочитанные');
              }
            }).catch(err => {
              console.error('❌ Ошибка при отметке сообщений как прочитанных:', err);
            });
          }
        } catch (err) {
          console.error('❌ Ошибка при отметке сообщений как прочитанных:', err);
        }
      }

      if (onAutoSelectComplete) {
        onAutoSelectComplete();
      }
      return;
    }

    // Если не нашли разговор — всё равно завершаем авто-выбор
    console.log('⚠️ Разговор для авто-выбора не найден:', autoSelectUser);
    if (onAutoSelectComplete) {
      onAutoSelectComplete();
    }
  }, [autoSelectUser, directMessages, onAutoSelectComplete, loadMessagesWithUser]);


  // WebSocket обработчики для личных сообщений
  useEffect(() => {
    if (!socket) return;

    const handleDirectMessageNew = (message) => {
      console.log('📨 Получено новое личное сообщение:', message);

      // Если это сообщение для нас (мы получатели)
      if (message.receiver._id === user?.id) {
        // Если это разговор, который сейчас открыт
        if (selectedDM && (message.sender._id === selectedDM._id || message.sender._id === selectedDM?.user?._id)) {
          setSelectedMessages(prev => [...prev, message]);
          setTimeout(() => scrollToBottom(), 100);
        }

        // Обновляем список разговоров
        setDirectMessages(prev => {
          const existingDM = prev.find(dm =>
            dm?.user?._id === message.sender._id || dm?._id === message.sender._id
          );

          if (existingDM) {
            // Обновляем существующий разговор
            const updatedDMs = prev.map(dm => {
              if (dm?.user?._id === message.sender._id || dm?._id === message.sender._id) {
                return {
                  ...dm,
                  lastMessage: {
                    _id: message._id,
                    content: message.content,
                    timestamp: message.timestamp,
                    sender: {
                      _id: message.sender._id,
                      username: message.sender.username,
                      displayName: message.sender.displayName,
                      avatar: message.sender.avatar
                    }
                  },
                  unreadCount: (selectedDM && (message.sender._id === selectedDM._id || message.sender._id === selectedDM?.user?._id))
                    ? dm.unreadCount
                    : dm.unreadCount + 1
                };
              }
              return dm;
            });

            // Перемещаем разговор в начало списка
            const updatedDM = updatedDMs.find(dm => dm?.user?._id === message.sender._id || dm?._id === message.sender._id);
            const otherDMs = updatedDMs.filter(dm => dm?.user?._id !== message.sender._id && dm?._id !== message.sender._id);
            return [updatedDM, ...otherDMs];
          }

          return prev;
        });
      }
    };

    // Обработчик обновления реакций
    const handleReactionUpdate = (data) => {
      const { messageId, reactions } = data;

      // Обновляем реакции в текущих сообщениях
      setSelectedMessages(prev =>
        prev.map(msg =>
          msg._id === messageId ? { ...msg, reactions } : msg
        )
      );

      // Также обновляем последнее сообщение в списке DM если нужно
      setDirectMessages(prev =>
        prev.map(dm => {
          if (dm.lastMessage?._id === messageId) {
            return {
              ...dm,
              lastMessage: { ...dm.lastMessage, reactions }
            };
          }
          return dm;
        })
      );
    };

    const handleMessageEdited = (data) => {
      if (data.messageId) {
        setSelectedMessages(prev =>
          prev.map(msg =>
            msg._id === data.messageId
              ? { ...msg, content: data.content, edited: true }
              : msg
          )
        );

        // Обновляем также в списке разговоров
        setDirectMessages(prev =>
          prev.map(dm => {
            if (dm.lastMessage && dm.lastMessage._id === data.messageId) {
              return {
                ...dm,
                lastMessage: { ...dm.lastMessage, content: data.content, edited: true }
              };
            }
            return dm;
          })
        );
      }
    };

    const handleMessageDeleted = (data) => {
      if (data.messageId) {
        setSelectedMessages(prev => prev.filter(msg => msg._id !== data.messageId));

        // Обновляем также в списке разговоров
        setDirectMessages(prev =>
          prev.map(dm => {
            if (dm.lastMessage && dm.lastMessage._id === data.messageId) {
              // Если удаленное сообщение было последним, обновляем lastMessage
              const updatedMessages = selectedMessages.filter(msg => msg._id !== data.messageId);
              if (updatedMessages.length > 0) {
                const newLastMessage = updatedMessages[updatedMessages.length - 1];
                return {
                  ...dm,
                  lastMessage: newLastMessage
                };
              } else {
                return {
                  ...dm,
                  lastMessage: null
                };
              }
            }
            return dm;
          })
        );
      }
    };

    socket.on('direct-message:new', handleDirectMessageNew);
    socket.on(SOCKET_EVENTS.REACTION_ADDED, handleReactionUpdate);
    socket.on(SOCKET_EVENTS.REACTION_REMOVED, handleReactionUpdate);
    socket.on(SOCKET_EVENTS.MESSAGE_EDITED, handleMessageEdited);
    socket.on(SOCKET_EVENTS.MESSAGE_DELETED, handleMessageDeleted);

    return () => {
      socket.off('direct-message:new', handleDirectMessageNew);
      socket.off(SOCKET_EVENTS.REACTION_ADDED, handleReactionUpdate);
      socket.off(SOCKET_EVENTS.REACTION_REMOVED, handleReactionUpdate);
      socket.off(SOCKET_EVENTS.MESSAGE_EDITED, handleMessageEdited);
      socket.off(SOCKET_EVENTS.MESSAGE_DELETED, handleMessageDeleted);
    };
  }, [socket, user, selectedDM]);

  // Отслеживаем непрочитанные сообщения и уведомляем родительский компонент
  useEffect(() => {
    if (onUnreadDMsUpdate) {
      const hasUnread = directMessages.some(dm => dm.unreadCount > 0);
      onUnreadDMsUpdate(hasUnread);
    }
  }, [directMessages, onUnreadDMsUpdate]);

  // Покидаем комнату DM при размонтировании компонента
  useEffect(() => {
    return () => {
      if (socket) {
        socket.emit('dm:leave');
        console.log('🔗 Покинули комнату DM');
      }
    };
  }, [socket]);

  const handleSelectDM = useCallback(async (dm) => {
    setShowFriendsPanel(false);
    setSelectedDM(dm);
    setBlockStatus(dm?.blockStatus || null);
    setShowBlockDialog(false);
    setBlockReason('');

    // Если есть обработчик для мобильного режима, используем его
    if (onDMUserSelect) {
      onDMUserSelect(dm);
      return;
    }

    // Навигация через URL вместо изменения состояния
    navigate(`/channels/@me/${dm._id}`);
  }, [onDMUserSelect, navigate]);

  const handleFriendOpen = useCallback((friend) => {
    if (!friend || !friend._id) return;

    const conversation = {
      _id: friend._id,
      user: friend,
      lastMessage: null,
      unreadCount: 0
    };

    setShowFriendsPanel(false);
    handleSelectDM(conversation);
  }, [handleSelectDM]);

  const filteredDMs = useMemo(() =>
    directMessages.filter(dm =>
      dm?.user?.username?.toLowerCase().includes(searchQuery.toLowerCase())
    ), [directMessages, searchQuery]
  );

  const activeChatUser = selectedDM?.user || autoSelectUser?.user || null;

  const targetUserDisplayName = useMemo(() => {
    if (activeChatUser) {
      return activeChatUser.displayName || activeChatUser.username || '';
    }
    if (autoSelectUser?.username) {
      return autoSelectUser.username;
    }
    return '';
  }, [activeChatUser, autoSelectUser]);

  const isConversationBlocked = Boolean(blockStatus?.isBlockedByMe || blockStatus?.hasBlockedMe);
  const messagePlaceholder = isConversationBlocked
    ? 'Вы не можете отправлять сообщения этому пользователю'
    : targetUserDisplayName
      ? `Написать @${targetUserDisplayName}`
      : 'Написать сообщение';
  const isSendDisabled = (!inputValue.trim() && selectedFiles.length === 0) || sendingMessage || isConversationBlocked;

  const blockDialog = showBlockDialog ? (
    <div className="dm-block-dialog">
      <div className="dm-block-dialog-header">
        Заблокировать {selectedDM?.user?.displayName || selectedDM?.user?.username || autoSelectUser?.user?.displayName || autoSelectUser?.user?.username || targetUserDisplayName}?
      </div>
      <p className="dm-block-dialog-text">
        Заблокированный пользователь не сможет отправлять вам личные сообщения. Вы можете добавить причину (необязательно).
      </p>
      <textarea
        className="dm-block-reason"
        placeholder="Причина (необязательно)"
        value={blockReason}
        maxLength={200}
        onChange={(e) => setBlockReason(e.target.value)}
      />
      {blockActionError && <div className="dm-block-error">{blockActionError}</div>}
      <div className="dm-block-dialog-actions">
        <button
          type="button"
          className="dm-block-cancel"
          onClick={handleCloseBlockDialog}
          disabled={blockActionLoading}
        >
          Отмена
        </button>
        <button
          type="button"
          className="dm-block-confirm"
          onClick={handleBlockConfirm}
          disabled={blockActionLoading}
        >
          {blockActionLoading ? 'Заблокировать...' : 'Заблокировать'}
        </button>
      </div>
    </div>
  ) : null;

  const blockBanners = (
    <>
      {blockStatus?.isBlockedByMe && (
        <div className="dm-block-banner warning">
          Вы заблокировали этого пользователя. Чтобы возобновить переписку, разблокируйте его.
        </div>
      )}
      {blockStatus?.hasBlockedMe && (
        <div className="dm-block-banner danger">
          Пользователь заблокировал вас. Вы можете читать историю, но сообщения отправляться не будут.
        </div>
      )}
      {blockActionError && !showBlockDialog && (
        <div className="dm-block-error">{blockActionError}</div>
      )}
    </>
  );

  const resolvedReplyTarget = replyingTo
    ? selectedMessages.find(msg => msg._id === replyingTo.id) || replyingTo
    : null;

  // Если нужно показать только чат (для мобильной версии)
  if (showOnlyChat && autoSelectUser) {
    return (
      <div className="direct-messages-container">
        <div className="dm-chat">
          <div className="dm-chat-active">
            <div className="dm-mobile-header">
              <div className="dm-mobile-user">
                <div className="dm-chat-avatar">
                  {activeChatUser?.avatar ? (
                    <img src={`${BACKEND_URL}${activeChatUser.avatar}`} alt={activeChatUser.username} />
                  ) : (
                    <span>{(activeChatUser?.username || '?').charAt(0).toUpperCase()}</span>
                  )}
                  <div className={`dm-status-indicator ${isUserOnline(activeChatUser?._id) ? 'online' : 'offline'}`}></div>
                </div>
                <div className="dm-chat-info">
                  <div className="dm-chat-username">{targetUserDisplayName || activeChatUser?.username}</div>
                  <div className="dm-chat-status">{isUserOnline(activeChatUser?._id) ? 'В сети' : 'Не в сети'}</div>
                </div>
              </div>
            </div>
            {blockDialog}
            {blockBanners}

              {/* Область сообщений */}
              <div
                className="dm-messages"
                ref={messagesContainerRef}
                style={{
                  position: 'relative',
                  paddingTop: dmWelcomeH ? `${dmWelcomeH}px` : undefined,
                }}
              >
                {/* welcome фиксированный сверху */}
                <div
                  className="dm-messages-welcome"
                  ref={dmWelcomeRef}
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, pointerEvents: 'none' }}
                >
                  {(messagesLoading || bootstrapping) ? (
                    <div className="dm-welcome-skeleton">
                      <div className="dm-welcome-skeleton-avatar" />
                      <div className="dm-welcome-skeleton-name" />
                      <div className="dm-welcome-skeleton-username" />
                      <div className="dm-welcome-skeleton-description" />
                      <div className="dm-welcome-skeleton-actions">
                        <div className="dm-welcome-skeleton-button" />
                        <div className="dm-welcome-skeleton-button" />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="dm-welcome-avatar">
                        {autoSelectUser.user?.avatar ? (
                          <img src={`${BACKEND_URL}${autoSelectUser.user.avatar}`} alt={autoSelectUser.user.username} />
                        ) : (
                          <span>{autoSelectUser.user?.username?.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="dm-welcome-info">
                        <h2>{autoSelectUser.user?.displayName || autoSelectUser.user?.username || autoSelectUser.username}</h2>
                        <p>{autoSelectUser.user?.username || autoSelectUser.username}</p>
                      </div>
                      <div className="dm-welcome-description">
                        <p>Это начало истории ваших личных сообщений с {autoSelectUser.user?.displayName || autoSelectUser.user?.username || autoSelectUser.username}.</p>
                      </div>
                      <div className="dm-welcome-actions">
                        <button
                          className={`dm-action-btn ${isFriend ? 'danger' : ''} ${!isFriendButtonActive() ? 'disabled' : ''}`}
                          onClick={() => handleAddFriend(currentChatUser)}
                          disabled={!isFriendButtonActive()}
                        >
                          {addingFriend ? 'Загрузка...' : getFriendButtonText()}
                        </button>
                        {blockStatus?.isBlockedByMe ? (
                          <button
                            type="button"
                            className="dm-chat-action-btn unblock"
                            onClick={handleUnblock}
                            disabled={blockActionLoading}
                          >
                            {blockActionLoading ? '...' : 'Разблокировать'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="dm-chat-action-btn block"
                            onClick={handleOpenBlockDialog}
                            disabled={blockActionLoading}
                          >
                            Заблокировать
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Скелетон — ОТДЕЛЬНЫЙ оверлей, виден даже когда поток невидим */}
                {(messagesLoading || bootstrapping) && (
                  <div
                    className="dm-skeleton-overlay"
                    style={{ position: 'absolute', top: dmWelcomeH, left: 0, right: 0 }}
                  >
                    <div className="dm-skel-row" />
                    <div className="dm-skel-row" />
                    <div className="dm-skel-row" />
                  </div>
                )}

                {/* Поток сообщений ВСЕГДА смонтирован */}
                <div
                  className="dm-thread"
                  style={{
                    opacity: bootstrapping ? 0 : 1,
                    pointerEvents: bootstrapping ? 'none' : 'auto',
                  }}
                >
                  {selectedMessages.length > 0 && showMessages && (
                  groupedDMs.map((group, groupIndex) => {
                    const prevGroup = groupIndex > 0 ? groupedDMs[groupIndex - 1] : null;
                  const showDateDivider = !prevGroup || prevGroup.date !== group.date;

                  return (
                    <React.Fragment key={`group-${groupIndex}`}>
                      {showDateDivider && (
                        <div className="dm-date-divider">
                          <div className="dm-date-divider-line"></div>
                          <span className="dm-date-divider-text">{formatDate(group.date)}</span>
                          <div className="dm-date-divider-line"></div>
                        </div>
                      )}
                      {group.messages.map((message, messageIndex) => (
                        <div
                          key={message._id}
                          data-message-id={message._id}
                          className={`dm-message ${message.sender._id === user?.id ? 'dm-message-own' : ''} ${messageIndex > 0 ? 'dm-message-grouped' : ''} ${messageIndex === 0 && group.messages.length > 1 ? 'dm-message-group-first' : ''} ${highlightedMessageId === message._id ? 'dm-message-highlighted' : ''} ${newDmMessageIds.has(message._id) ? 'dm-msg--just-in' : ''}`}
                        >
                      {messageIndex === 0 && (
                        <div
                          className="dm-message-avatar"
                          onClick={(e) => handleUserClick(message.sender, e)}
                          style={{ cursor: 'pointer' }}
                        >
                          {message.sender.avatar ? (
                            <img src={`${BACKEND_URL}${message.sender.avatar}`} alt={message.sender.username} />
                          ) : (
                            <span>{message.sender.username?.charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                      )}
                      {messageIndex > 0 && <div className="dm-message-avatar-spacer"></div>}
                      <div className="dm-message-content">
                        {messageIndex === 0 && (
                          <div className="dm-message-header">
                            <span
                              className="dm-message-username"
                              onClick={(e) => handleUserClick(message.sender, e)}
                              style={{ cursor: 'pointer' }}
                            >
                              {message.sender.displayName || message.sender.username}
                            </span>
                            <span className="dm-message-time">
                              {new Date(message.timestamp).toLocaleTimeString('ru-RU', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                        )}
                        <div className="dm-message-content-wrapper">
                          {message.replyTo && (
                            <button
                              type="button"
                              className="dm-message-reply-preview"
                              onClick={() => handleReplyNavigation(message.replyTo?.messageId)}
                            >
                              <span className="dm-message-reply-accent" aria-hidden="true"></span>
                              <div className="dm-message-reply-content">
                                <div className="dm-message-reply-title">
                                  {message.replyTo.displayName || message.replyTo.username || 'Неизвестный пользователь'}
                                </div>
                                <div className="dm-message-reply-text">
                                  {getReplySnippetFromMeta(message.replyTo)}
                                </div>
                              </div>
                            </button>
                          )}
                              {message.content && (
                                <div className="dm-message-text">
                                  <MarkdownMessage
                                    content={message.content}
                                    mentions={message.mentions}
                                    roles={[]}
                                    channels={[]}
                                    currentUsername={user?.username}
                                    onMentionClick={handleMentionClick}
                                    onMentionHover={(data) => handleMentionHover(data, message)}
                                    onMentionLeave={hideMentionTooltip}
                                  />
                                  <MessageEmbeds content={message.content} />
                                </div>
                              )}
                          {message.attachments && message.attachments.length > 0 && (
                            <div className="message-attachments">
                              {message.attachments.map((attachment, index) => (
                                <div key={index} className="message-attachment">
                                  <img
                                    src={`${BACKEND_URL}${attachment.path}`}
                                    alt={attachment.originalName}
                                    className="message-attachment-image"
                                    loading="lazy"
                                    onClick={() => window.open(`${BACKEND_URL}${attachment.path}`, '_blank')}
                                    onError={(e) => {
                                      console.error('Ошибка загрузки изображения:', e.target.src);
                                      e.target.style.display = 'none';
                                    }}
                                    onLoad={() => {
                                      console.log('Изображение загружено:', `${BACKEND_URL}${attachment.path}`);
                                    }}
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Реакции на сообщение */}
                        <MessageReactions
                          reactions={message.reactions}
                          onReactionClick={(emoji, userReacted) => handleReactionClick(message._id, emoji, userReacted)}
                          currentUserId={user?.id}
                        />
                      </div>

                      <div className="dm-message-actions">
                        <button
                          className="dm-message-actions-button"
                          onClick={() => handleReplySelect(message)}
                          title="Ответить"
                        >
                          <img src="/icons/reply.png" alt="Ответить" className="dm-message-actions-icon reply-icon" />
                        </button>
                        <button
                          className="dm-message-actions-button"
                          onClick={(e) => handleAddReaction(message._id, e)}
                          title="Добавить реакцию"
                        >
                          <img src="/icons/emoji.png" alt="Добавить реакцию" className="dm-message-actions-icon" />
                        </button>
                        {canEditMessage(message) && (
                          <button
                            className="dm-message-actions-button"
                            onClick={() => handleEditMessage(message)}
                            title="Редактировать"
                          >
                            <img src="/icons/edit.png" alt="Редактировать" className="dm-message-actions-icon" />
                          </button>
                        )}
                        {canDeleteMessage(message) && (
                          <button
                            className="dm-message-actions-button"
                            onClick={(e) => handleMoreActions(message, e)}
                            title="Больше действий"
                          >
                            ⋯
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                    </React.Fragment>
                  );
                })
                )}
                  {/* Невидимый элемент для прокрутки к последнему сообщению */}
                  <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Поле ввода */}
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
              <div className="dm-reply-banner">
                <div
                  className="dm-reply-banner-info"
                  onClick={() => handleReplyNavigation(resolvedReplyTarget.id || resolvedReplyTarget._id)}
                >
                  <div className="dm-reply-banner-title">
                    Ответ на сообщение <span className="dm-reply-banner-author">@{resolvedReplyTarget.sender?.displayName || resolvedReplyTarget.sender?.username || resolvedReplyTarget.username}</span>
                  </div>
                  <div className="dm-reply-banner-text">
                    {getReplySnippetFromMessage(resolvedReplyTarget)}
                  </div>
                </div>
                <button
                  type="button"
                  className="dm-reply-banner-close"
                  onClick={cancelReply}
                  title="Отменить ответ"
                >
                  ×
                </button>
              </div>
            )}

            <form onSubmit={handleSendMessage}>
              <input
                id="dm-file-input"
                type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
                <div className="message-input-wrapper">
                  <div className="message-input-field">
                    <button
                      type="button"
                      className="file-attach-button"
                      onClick={openFileDialog}
                      disabled={isConversationBlocked}
                      title="Прикрепить файл"
                    >
                      <img src="/icons/plus.png" alt="+" />
                    </button>
                    <div className="input-divider"></div>
                    <input
                      ref={inputRef}
                      type="text"
                      placeholder={messagePlaceholder}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyPress={handleKeyPress}
                      maxLength={2000}
                      disabled={sendingMessage || isConversationBlocked}
                    />
                    <div className="input-divider"></div>
                    <button
                      type="submit"
                      className={`file-send-button ${isSendDisabled ? 'disabled' : 'active'}`}
                      disabled={isSendDisabled}
                      title="Отправить"
                    >
                      <img src="/icons/send.png" alt="Отправить" />
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="direct-messages-container">
      {/* Левая панель - список личных сообщений */}
      <div className="dm-sidebar">
        <div className="dm-header">
          <input
            type="text"
            placeholder="Кого поищем?"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className={`dm-friends-item ${showFriendsPanel ? 'selected' : ''}`} onClick={() => {
          setShowFriendsPanel(true);
          setSelectedDM(null);
          navigate('/channels/@me');
        }}>
          <div className="dm-friends-icon">
            <img src="/icons/friends.png" alt="Друзья" />
          </div>
          <span className="dm-friends-text">Друзья</span>
          {incomingRequests.length > 0 && (
            <div className="dm-friends-notification-dot" title={`Заявок в друзья: ${incomingRequests.length}`}></div>
          )}
        </div>
        <div className="dm-friends-divider"></div>

        <div className="dm-list">
          {loading ? (
            <div className="dm-loading">Загрузка...</div>
          ) : error ? (
            <div className="dm-error">{error}</div>
          ) : filteredDMs.length === 0 ? (
            <div className="dm-empty">
              <p>У вас пока нет личных сообщений</p>
              <p>Начните общение с друзьями!</p>
            </div>
          ) : (
            filteredDMs.filter(dm => dm?.user).map((dm) => (
              <div
                key={dm._id}
                className={`dm-item ${selectedDM?._id === dm._id ? 'selected' : ''}`}
                onClick={() => handleSelectDM(dm)}
              >
                <div className="dm-avatar">
                  {dm.user.avatar ? (
                    <img src={`${BACKEND_URL}${dm.user.avatar}`} alt={dm.user.username} />
                  ) : (
                    <span>{dm.user.username?.charAt(0).toUpperCase()}</span>
                  )}
                  <div className={`dm-status-indicator ${isUserOnline(dm.user._id) ? 'online' : 'offline'}`}></div>
                </div>
                <div className="dm-info">
                  <div className="dm-username">{dm.user.displayName || dm.user.username}</div>
                  <div className="dm-last-message">
                    {dm.lastMessage ? (
                      dm.lastMessage.sender._id === user?.id ? (
                        <><span className="dm-you-prefix">ВЫ:</span> {
                          dm.lastMessage.attachments && dm.lastMessage.attachments.length > 0
                            ? 'Отправил(а) изображение'
                            : dm.lastMessage.content || 'Нет сообщений'
                        }</>
                      ) : (
                        dm.lastMessage.attachments && dm.lastMessage.attachments.length > 0
                          ? 'Отправил(а) изображение'
                          : dm.lastMessage.content || 'Нет сообщений'
                      )
                    ) : (
                      'Нет сообщений'
                    )}
                  </div>
                </div>
                {dm.unreadCount > 0 && (
                  <div className="dm-unread">{dm.unreadCount}</div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Пользовательский профиль */}
        <UserProfile
          user={user}
          isMuted={isMuted}
          isDeafened={isDeafened}
          isInVoice={isInVoice}
          isSpeaking={isSpeaking}
          onToggleMute={onToggleMute}
          onToggleDeafen={onToggleDeafen}
          onDisconnect={onDisconnect}
          onLogout={onLogout}
          onAvatarUpdate={onAvatarUpdate}
        />
      </div>

      {/* Правая панель - чат - показываем только если не только список */}
      {!showOnlyList && (
        <div className="dm-chat">
          {showFriendsPanel ? (
            <div className="dm-chat-empty">
              <FriendsPanel onSelectFriend={handleFriendOpen} />
            </div>
          ) : selectedDM && selectedDM.user ? (
            <div className="dm-chat-active">
              {/* Заголовок чата */}
              <div className="dm-chat-header">
                <div className="dm-chat-user">
                  <div className="dm-chat-avatar">
                    {selectedDM.user.avatar ? (
                      <img src={`${BACKEND_URL}${selectedDM.user.avatar}`} alt={selectedDM.user.username} />
                    ) : (
                      <span>{selectedDM.user.username?.charAt(0).toUpperCase()}</span>
                    )}
                    <div className={`dm-status-indicator ${isUserOnline(selectedDM.user._id) ? 'online' : 'offline'}`}></div>
                  </div>
                  <div className="dm-chat-info">
                    <div className="dm-chat-username">{selectedDM.user.displayName || selectedDM.user.username}</div>
                    <div className="dm-chat-status">{isUserOnline(selectedDM.user._id) ? 'В сети' : 'Не в сети'}</div>
                  </div>
                </div>
              </div>

              {blockDialog}
              {blockBanners}

              {/* Область сообщений */}
              <div
                className="dm-messages"
                ref={messagesContainerRef}
                style={{
                  position: 'relative',
                  paddingTop: dmWelcomeH ? `${dmWelcomeH}px` : undefined,
                }}
              >
                {/* welcome фиксированный сверху */}
                <div
                  className="dm-messages-welcome"
                  ref={dmWelcomeRef}
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, pointerEvents: 'none' }}
                >
                  {(messagesLoading || bootstrapping) ? (
                    <div className="dm-welcome-skeleton">
                      <div className="dm-welcome-skeleton-avatar" />
                      <div className="dm-welcome-skeleton-name" />
                      <div className="dm-welcome-skeleton-username" />
                      <div className="dm-welcome-skeleton-description" />
                      <div className="dm-welcome-skeleton-actions">
                        <div className="dm-welcome-skeleton-button" />
                        <div className="dm-welcome-skeleton-button" />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="dm-welcome-avatar">
                        {selectedDM.user.avatar ? (
                          <img src={`${BACKEND_URL}${selectedDM.user.avatar}`} alt={selectedDM.user.username} />
                        ) : (
                          <span>{selectedDM.user.username?.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="dm-welcome-info">
                        <h2>{selectedDM.user.displayName || selectedDM.user.username}</h2>
                        <p>{selectedDM.user.username}</p>
                      </div>
                      <div className="dm-welcome-description">
                        <p>Это начало истории ваших личных сообщений с {selectedDM.user.displayName || selectedDM.user.username}.</p>
                      </div>
                      <div className="dm-welcome-actions">
                        <button
                          className={`dm-action-btn ${isFriend ? 'danger' : ''} ${!isFriendButtonActive() ? 'disabled' : ''}`}
                          onClick={() => handleAddFriend(currentChatUser)}
                          disabled={!isFriendButtonActive()}
                        >
                          {addingFriend ? 'Загрузка...' : getFriendButtonText()}
                        </button>
                        {blockStatus?.isBlockedByMe ? (
                          <button
                            type="button"
                            className="dm-chat-action-btn unblock"
                            onClick={handleUnblock}
                            disabled={blockActionLoading}
                          >
                            {blockActionLoading ? '...' : 'Разблокировать'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="dm-chat-action-btn block"
                            onClick={handleOpenBlockDialog}
                            disabled={blockActionLoading}
                          >
                            Заблокировать
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Скелетон — ОТДЕЛЬНЫЙ оверлей, виден даже когда поток невидим */}
                {(messagesLoading || bootstrapping) && (
                  <div
                    className="dm-skeleton-overlay"
                    style={{ position: 'absolute', top: dmWelcomeH, left: 0, right: 0 }}
                  >
                    <div className="dm-skel-row" />
                    <div className="dm-skel-row" />
                    <div className="dm-skel-row" />
                  </div>
                )}

                {/* Поток сообщений ВСЕГДА смонтирован */}
                <div
                  className="dm-thread"
                  style={{
                    opacity: bootstrapping ? 0 : 1,
                    pointerEvents: bootstrapping ? 'none' : 'auto',
                  }}
                >
                  {selectedMessages.length > 0 && showMessages && (
                    groupedDMs.map((group, groupIndex) => {
                      const prevGroup = groupIndex > 0 ? groupedDMs[groupIndex - 1] : null;
                    const showDateDivider = !prevGroup || prevGroup.date !== group.date;

                    return (
                      <React.Fragment key={`group-${groupIndex}`}>
                        {showDateDivider && (
                          <div className="dm-date-divider">
                            <div className="dm-date-divider-line"></div>
                            <span className="dm-date-divider-text">{formatDate(group.date)}</span>
                            <div className="dm-date-divider-line"></div>
                          </div>
                        )}
                        {group.messages.map((message, messageIndex) => (
                          <div
                            key={message._id}
                            data-message-id={message._id}
                            className={`dm-message ${message.sender._id === user?.id ? 'dm-message-own' : ''} ${messageIndex > 0 ? 'dm-message-grouped' : ''} ${messageIndex === 0 && group.messages.length > 1 ? 'dm-message-group-first' : ''} ${messageIndex === group.messages.length - 1 ? 'dm-message-group-last' : ''} ${editingMessage?._id === message._id ? 'dm-message-edit-mode' : ''} ${highlightedMessageId === message._id ? 'dm-message-highlighted' : ''} ${newDmMessageIds.has(message._id) ? 'dm-msg--just-in' : ''}`}
                          >
                        {messageIndex === 0 && (
                          <div
                            className="dm-message-avatar"
                            onClick={(e) => handleUserClick(message.sender, e)}
                            style={{ cursor: 'pointer' }}
                          >
                            {message.sender.avatar ? (
                              <img src={`${BACKEND_URL}${message.sender.avatar}`} alt={message.sender.username} />
                            ) : (
                              <span>{message.sender.username?.charAt(0).toUpperCase()}</span>
                            )}
                          </div>
                        )}
                        {messageIndex > 0 && <div className="dm-message-avatar-spacer"></div>}
                        <div className="dm-message-content">
                          {messageIndex === 0 && (
                            <div className="dm-message-header">
                              <span
                                className="dm-message-username"
                                onClick={(e) => handleUserClick(message.sender, e)}
                                style={{ cursor: 'pointer' }}
                              >
                                {message.sender.displayName || message.sender.username}
                              </span>
                              <span className="dm-message-time">
                                {new Date(message.timestamp).toLocaleTimeString('ru-RU', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>
                          )}
                          {editingMessage?._id === message._id ? (
                            <div className="dm-message-edit">
                              <textarea
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSaveEdit();
                                  }
                                  if (e.key === 'Escape') {
                                    setEditingMessage(null);
                                    setEditValue('');
                                  }
                                }}
                                className="dm-edit-textarea"
                                autoFocus
                              />
                              <div className="dm-edit-actions">
                                <button
                                  className="dm-edit-save"
                                  onClick={handleSaveEdit}
                                >
                                  Сохранить
                                </button>
                                <button
                                  className="dm-edit-cancel"
                                  onClick={() => {
                                    setEditingMessage(null);
                                    setEditValue('');
                                  }}
                                >
                                  Отмена
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="dm-message-content-wrapper">
                              {message.replyTo && (
                                <button
                                  type="button"
                                  className="dm-message-reply-preview"
                                  onClick={() => handleReplyNavigation(message.replyTo?.messageId)}
                                >
                                  <span className="dm-message-reply-accent" aria-hidden="true"></span>
                                  <div className="dm-message-reply-content">
                                    <div className="dm-message-reply-title">
                                      {message.replyTo.displayName || message.replyTo.username || 'Неизвестный пользователь'}
                                    </div>
                                    <div className="dm-message-reply-text">
                                      {getReplySnippetFromMeta(message.replyTo)}
                                    </div>
                                  </div>
                                </button>
                              )}
                              {message.content && (
                                <div className="dm-message-text">
                                  <MarkdownMessage
                                    content={message.content}
                                    mentions={message.mentions}
                                    roles={[]}
                                    channels={[]}
                                    currentUsername={user?.username}
                                    onMentionClick={handleMentionClick}
                                    onMentionHover={(data) => handleMentionHover(data, message)}
                                    onMentionLeave={hideMentionTooltip}
                                  />
                                  <MessageEmbeds content={message.content} />
                                </div>
                              )}
                              {message.attachments && message.attachments.length > 0 && (
                                <div className="message-attachments">
                                  {message.attachments.map((attachment, index) => (
                                    <div key={index} className="message-attachment">
                                      <img
                                        src={`${BACKEND_URL}${attachment.path}`}
                                        alt={attachment.originalName}
                                        className="message-attachment-image"
                                        loading="lazy"
                                        onClick={() => window.open(`${BACKEND_URL}${attachment.path}`, '_blank')}
                                        onError={(e) => {
                                          console.error('Ошибка загрузки изображения:', e.target.src);
                                          e.target.style.display = 'none';
                                        }}
                                        onLoad={() => {
                                          console.log('Изображение загружено:', `${BACKEND_URL}${attachment.path}`);
                                        }}
                                      />
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Реакции на сообщение */}
                          <MessageReactions
                            reactions={message.reactions}
                            onReactionClick={(emoji, userReacted) => handleReactionClick(message._id, emoji, userReacted)}
                            currentUserId={user?.id}
                          />
                        </div>

                        <div className="dm-message-actions">
                          <button
                            className="dm-message-actions-button"
                            onClick={() => handleReplySelect(message)}
                            title="Ответить"
                          >
                            <img src="/icons/reply.png" alt="Ответить" className="dm-message-actions-icon reply-icon" />
                          </button>
                          <button
                            className="dm-message-actions-button"
                            onClick={(e) => handleAddReaction(message._id, e)}
                            title="Добавить реакцию"
                          >
                            <img src="/icons/emoji.png" alt="Добавить реакцию" className="dm-message-actions-icon" />
                          </button>
                          {canEditMessage(message) && (
                            <button
                              className="dm-message-actions-button"
                              onClick={() => handleEditMessage(message)}
                              title="Редактировать"
                            >
                              <img src="/icons/edit.png" alt="Редактировать" className="dm-message-actions-icon" />
                            </button>
                          )}
                          {canDeleteMessage(message) && (
                            <button
                              className="dm-message-actions-button"
                              onClick={(e) => handleMoreActions(message, e)}
                              title="Больше действий"
                            >
                              ⋯
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                      </React.Fragment>
                    );
                  })
                  )}
                    {/* Невидимый элемент для прокрутки к последнему сообщению */}
                    <div ref={messagesEndRef} />
                  </div>
              </div>

              {/* Поле ввода */}
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
                  <div className="dm-reply-banner">
                    <div
                      className="dm-reply-banner-info"
                      onClick={() => handleReplyNavigation(resolvedReplyTarget.id || resolvedReplyTarget._id)}
                    >
                      <div className="dm-reply-banner-title">
                        Ответ на сообщение <span className="dm-reply-banner-author">@{resolvedReplyTarget.sender?.displayName || resolvedReplyTarget.sender?.username || resolvedReplyTarget.username}</span>
                      </div>
                      <div className="dm-reply-banner-text">
                        {getReplySnippetFromMessage(resolvedReplyTarget)}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="dm-reply-banner-close"
                      onClick={cancelReply}
                      title="Отменить ответ"
                    >
                      ×
                    </button>
                  </div>
                )}

                <form onSubmit={handleSendMessage}>
                  <input
                    id="dm-file-input"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                  />
                  <div className="message-input-wrapper">
                    <div className="message-input-field">
                    <button
                      type="button"
                      className="file-attach-button"
                      onClick={openFileDialog}
                      disabled={isConversationBlocked}
                      title="Прикрепить файл"
                    >
                      <img src="/icons/plus.png" alt="+" />
                    </button>
                    <div className="input-divider"></div>
                    <input
                      ref={inputRef}
                      type="text"
                      placeholder={messagePlaceholder}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyPress={handleKeyPress}
                      maxLength={2000}
                      disabled={sendingMessage || isConversationBlocked}
                    />
                    <div className="input-divider"></div>
                    <button
                      type="submit"
                      className={`file-send-button ${isSendDisabled ? 'disabled' : 'active'}`}
                      disabled={isSendDisabled}
                      title="Отправить"
                    >
                      <img src="/icons/send.png" alt="Отправить" />
                    </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          ) : (
            <div className="dm-chat-empty">
              <FriendsPanel onSelectFriend={handleFriendOpen} />
            </div>
          )}
        </div>
      )}

      {mentionTooltip && (
        <div
          className="mention-tooltip"
          data-visible="true"
          style={{
            top: `${mentionTooltip.position.top}px`,
            left: `${mentionTooltip.position.left}px`
          }}
        >
          <div className="mention-tooltip-title">{mentionTooltip.displayName}</div>
          <div className="mention-tooltip-subtitle">{mentionTooltip.subtitle}</div>
          {mentionTooltip.role && (
            <div className="mention-tooltip-role">{mentionTooltip.role}</div>
          )}
        </div>
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

      {/* Контекстное меню */}
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

      {/* Карточка профиля пользователя */}
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

            {/* FriendActionButton для управления дружбой */}
            <FriendActionButton
              targetUser={selectedUser}
              currentUserId={user?.id}
            />

            {/* Поле для отправки личного сообщения - только если не свой профиль */}
            {selectedUser && (() => {
              const targetUserId = selectedUser.userId || selectedUser._id || selectedUser.id;
              const isOwnProfile = targetUserId === user?.id;
              const isBlocked = isUserBlocked(selectedUser, user);
              return !isOwnProfile && (
                <div className="user-profile-message-input">
                  <div className="message-input-container">
                    <input
                      type="text"
                      placeholder={
                        isBlocked
                          ? `Вы не можете написать @${selectedUser.username}`
                          : `Сообщение для @${selectedUser.username}`
                      }
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      onKeyPress={handleKeyPressProfile}
                      disabled={sendingDirectMessage || isBlocked}
                      className="message-input-field"
                    />
                  </div>
                </div>
              );
            })()}
          </div>
        </>
      )}

      {/* Модальное окно ошибки добавления в друзья */}
      {errorModal && createPortal(
        <div className="join-server-overlay friend-error-overlay" onClick={() => setErrorModal(null)}>
          <div className="join-server-modal friend-error-modal" onClick={(e) => e.stopPropagation()}>
            <button className="join-server-close" onClick={() => setErrorModal(null)}>×</button>

            <h2>Невозможно выполнить действие</h2>
            <p className="modal-subtitle">
              {errorModal}
            </p>

            <div className="modal-footer">
              <button
                className="btn-primary"
                onClick={() => setErrorModal(null)}
              >
                Понятно
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default React.memo(DirectMessages);
