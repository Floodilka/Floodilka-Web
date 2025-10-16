import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import api from '../services/api';

// Компоненты
import MessagesList from './directMessages/messages/MessagesList';
import MessageInput from './directMessages/input/MessageInput';
import DMMessageSkeleton from './directMessages/skeleton/DMMessageSkeleton';
import ImageLightbox from './ImageLightbox';

// Хуки
import { useDMLoading } from '../hooks/useDMLoading';
import { useSimpleDMScroll } from '../hooks/useSimpleDMScroll';
import { useBlockStatus } from './directMessages/hooks/useBlockStatus';
import { useReactions } from './directMessages/hooks/useReactions';
import { useImageLightbox } from '../hooks/useImageLightbox';

// Утилиты
import { groupMessages, canDeleteMessage, buildReplySnapshot } from './directMessages/utils/messageUtils';
import { getTargetUserId } from './directMessages/utils/blockUtils';

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

/**
 * Основной компонент DirectMessages
 */
function DirectMessages({
  user,
  socket,
  onLogout,
  onAvatarUpdate,
  autoSelectUser,
  onAutoSelectComplete,
  onUnreadDMsUpdate,
  isMuted,
  isDeafened,
  isInVoice,
  isSpeaking,
  onToggleMute,
  onToggleDeafen,
  onDisconnect,
  onDMUserSelect,
  showOnlyList,
  showOnlyChat
}) {
  const navigate = useNavigate();
  const { globalOnlineUsers } = useGlobalUsers();
  const { incomingRequests, sendFriendRequest, respondToRequest, removeFriend } = useFriends();

  // Основные состояния
  const [directMessages, setDirectMessages] = useState([]);
  const [selectedDM, setSelectedDM] = useState(null);
  const [selectedMessages, setSelectedMessages] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [showFriendsPanel, setShowFriendsPanel] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [error, setError] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [showFileSizeError, setShowFileSizeError] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const [addingFriend, setAddingFriend] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [profilePosition, setProfilePosition] = useState({ top: 0, left: 0 });
  const [errorModal, setErrorModal] = useState(null);

  // Лайтбокс изображений
  const { isOpen: isLightboxOpen, images: lightboxImages, initialIndex: lightboxInitialIndex, openLightbox, closeLightbox } = useImageLightbox();

  // Рефы
  const lastProcessedUserIdRef = useRef(null);
  const inputRef = useRef(null);

  // prefersReducedMotion для анимаций
  const prefersReducedMotion = useMemo(() => {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // Хуки для управления загрузкой
  const {
    showSkeleton,
    showMessages: showDMMessages,
    skeletonMessages,
    isReady
  } = useDMLoading(selectedDM, selectedMessages, messagesLoading, false);

  // Layout-shift guard для предотвращения скачков при загрузке изображений
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || !showDMMessages) return;

    // берём все IMG вложений в видимом чате
    const imgs = Array.from(
      container.querySelectorAll('img.message-attachment-image:not([data-ls-watch])')
    );

    const cleaners = [];

    imgs.forEach((img) => {
      img.dataset.lsWatch = '1';
      const wrapper = img.closest('.message-attachment-image-wrapper') || img;

      // высота до загрузки
      const before = wrapper.offsetHeight;

      const fixScroll = () => {
        // если DOM уже отрисовал окончательную высоту
        const after = wrapper.offsetHeight;
        const delta = after - before;
        if (!delta) return;

        const contRect = container.getBoundingClientRect();
        const wrapRect = wrapper.getBoundingClientRect();

        const isAboveViewportBottom = wrapRect.bottom <= contRect.bottom;
        const isPinnedToBottom = Math.abs(
          container.scrollHeight - container.scrollTop - container.clientHeight
        ) < 2;

        // Если пользователь у низа — просто держим низ.
        if (isPinnedToBottom) {
          container.scrollTop = container.scrollHeight;
        } else if (isAboveViewportBottom) {
          // Если картинка выше текущего низа вьюпорта — компенсируем дельту.
          container.scrollTop += delta;
        }
      };

      const onLoad = () => {
        // если уже закешировано — дельта появится сразу
        Promise.resolve(img.decode?.()).finally(fixScroll);
        img.removeEventListener('load', onLoad);
      };

      if (img.complete) {
        onLoad();
      } else {
        img.addEventListener('load', onLoad);
        cleaners.push(() => img.removeEventListener('load', onLoad));
      }
    });

    return () => cleaners.forEach((fn) => fn());
  }, [selectedMessages, showDMMessages, isReady]);

  // Блокировка скролла во время показа скелетона
  useEffect(() => {
    if (!messagesContainerRef.current) return;

    const container = messagesContainerRef.current;

    if (showSkeleton) {
      // Блокируем скролл
      container.style.overflow = 'hidden';
      container.style.pointerEvents = 'none';
      container.style.userSelect = 'none';

      // Предотвращаем скролл через wheel и touch события
      const preventScroll = (e) => {
        e.preventDefault();
        e.stopPropagation();
        return false;
      };

      container.addEventListener('wheel', preventScroll, { passive: false });
      container.addEventListener('touchmove', preventScroll, { passive: false });
      container.addEventListener('scroll', preventScroll, { passive: false });

      return () => {
        container.removeEventListener('wheel', preventScroll);
        container.removeEventListener('touchmove', preventScroll);
        container.removeEventListener('scroll', preventScroll);
      };
    } else {
      // Восстанавливаем скролл
      container.style.overflow = 'auto';
      container.style.pointerEvents = 'auto';
      container.style.userSelect = 'auto';
    }
  }, [showSkeleton]);

  const {
    messagesContainerRef,
    messagesEndRef,
    dmWelcomeRef,
    dmWelcomeH,
    newDmMessageIds,
    scrollToBottom,
    scrollToMessageById
  } = useSimpleDMScroll(selectedMessages, selectedDM, isReady, prefersReducedMotion);

  const {
    blockStatus,
    setBlockStatus,
    blockActionLoading,
    showBlockDialog,
    setShowBlockDialog,
    blockReason,
    setBlockReason,
    refreshBlockStatus,
    handleOpenBlockDialog,
    handleUnblock
  } = useBlockStatus();

  const {
    showEmojiPicker,
    emojiPickerPosition,
    handleAddReaction,
    handleEmojiSelect,
    handleReactionClick,
    closeEmojiPicker
  } = useReactions(socket, user);

  // Функция для проверки онлайн статуса пользователя
  const isUserOnline = useCallback((userId) => {
    return globalOnlineUsers.some(onlineUser => onlineUser.userId === userId);
  }, [globalOnlineUsers]);

  // Обработчик клика на пользователя для показа карточки профиля
  const handleUserClick = useCallback(async (sender, event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const cardWidth = 300;
    const cardHeight = 200;
    const padding = 10;

    let top = rect.top;
    let left = rect.right + 8;

    if (left + cardWidth > window.innerWidth - padding) {
      left = rect.left - cardWidth - 8;
    }

    if (top + cardHeight > window.innerHeight - padding) {
      top = rect.top - cardHeight - 8;
      if (top < padding) {
        top = Math.max(padding, (window.innerHeight - cardHeight) / 2);
      }
    }

    if (top < padding) {
      top = padding;
    }

    if (left < padding) {
      left = padding;
    }

    setProfilePosition({
      top: Math.max(padding, top),
      left: Math.max(padding, left)
    });

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
  };

  // Функции для работы с файлами
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

    const hasOversizedFile = files.some(file => file.size > maxSize);
    if (hasOversizedFile) {
      setShowFileSizeError(true);
      e.target.value = '';
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
    e.target.value = '';

    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus({ preventScroll: true });
      }
    }, 50);
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));

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
  const handleSendMessage = async (content, files, replyTo) => {
    const currentDM = selectedDM || autoSelectUser;
    if ((!content && files.length === 0) || !currentDM || sendingMessage) {
      return;
    }

    if (blockStatus?.isBlockedByMe || blockStatus?.hasBlockedMe) {
      return;
    }

    setSendingMessage(true);

    try {
      let attachments = [];

      if (files.length > 0) {
        const formData = new FormData();
        files.forEach(file => {
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
          content: content,
          attachments: attachments,
          replyToMessageId: replyTo ? replyTo.id : undefined
        })
      });

      if (!response.ok) {
        throw new Error('Ошибка отправки сообщения');
      }

      const newMessage = await response.json();
      console.log('✅ Сообщение отправлено:', newMessage);

      setSelectedMessages(prev => [...prev, newMessage]);

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

        const updatedDM = updatedDMs.find(dm => dm._id === currentDM._id);
        const otherDMs = updatedDMs.filter(dm => dm._id !== currentDM._id);
        return [updatedDM, ...otherDMs];
      });

      setInputValue('');
      setSelectedFiles([]);
      setReplyingTo(null);

      setTimeout(() => scrollToBottom(), 100);

      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus({ preventScroll: true });
        }
      }, 150);

  } catch (err) {
    console.error('❌ Ошибка отправки сообщения:', err);
    setError('Ошибка отправки сообщения');
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus({ preventScroll: true });
      }
    }, 100);
  } finally {
    setSendingMessage(false);
  }
};

  // Обработчики контекстного меню
  const handleMoreActions = (message, action, event) => {
    if (action === 'edit') {
      setEditingMessage(message);
      setEditValue(message.content || '');
      setContextMenu(null);
    } else if (action === 'more') {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();

      const menuHeight = 120;
      const menuWidth = 210;
      const padding = 10;

      let top = rect.top + rect.height / 2 - 18;
    let left = rect.left - menuWidth;

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    if (spaceBelow < menuHeight && spaceAbove > spaceBelow) {
        top = rect.top - menuHeight - 5;
    }

    if (left < padding) {
        left = rect.right + 5;
    }

    if (left + menuWidth > window.innerWidth - padding) {
      left = window.innerWidth - menuWidth - padding;
    }

    setContextMenu({
      message,
      position: {
          top: Math.max(padding, top),
          left: Math.max(padding, left)
      }
    });
    }
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  const handleReplySelect = (message) => {
    if (!message) return;
    setReplyingTo(buildReplySnapshot(message));
    setContextMenu(null);
    requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true });
    });
  };

  const handleReplyNavigation = (messageId) => {
    if (!messageId) return;
    scrollToMessageById(messageId);
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

  // Группировка сообщений с useMemo
  const groupedDMs = useMemo(
    () => groupMessages(selectedMessages, { thresholdMs: 60_000, userId: user?.id }),
    [selectedMessages, user?.id]
  );

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
    setSelectedMessages([]);
    setBlockStatus(null);
    setShowBlockDialog(false);
    setBlockReason('');
    try {
      console.log('📥 Загружаем сообщения с пользователем:', userId);

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
      setMessagesLoading(false);
    }
  }, [socket, user, refreshBlockStatus]);

  const handleSelectDM = useCallback(async (dm) => {
    setShowFriendsPanel(false);
    setSelectedDM(dm);
    setBlockStatus(dm?.blockStatus || null);
    setShowBlockDialog(false);
    setBlockReason('');

    if (onDMUserSelect) {
      onDMUserSelect(dm);
      return;
    }

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
    if (replyingTo && !selectedMessages.find(msg => msg._id === replyingTo.id)) {
      setReplyingTo(null);
    }
  }, [selectedMessages, replyingTo]);

  useEffect(() => {
    if (!highlightedMessageId) return;

    const timeout = setTimeout(() => setHighlightedMessageId(null), 1800);
    return () => clearTimeout(timeout);
  }, [highlightedMessageId]);

  useEffect(() => {
    if (user) {
      loadDirectMessages();
    }
  }, [user, loadDirectMessages]);

  // Автоматический выбор разговора
  useEffect(() => {
    if (!autoSelectUser) {
      lastProcessedUserIdRef.current = null;
      return;
    }

    if (directMessages.length > 0 && (autoSelectUser.userId || autoSelectUser.user?._id)) {
      const targetUserId = autoSelectUser.userId || autoSelectUser.user?._id;

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

    if (autoSelectUser._id) {
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

      if (message.receiver._id === user?.id) {
        if (selectedDM && (message.sender._id === selectedDM._id || message.sender._id === selectedDM?.user?._id)) {
          setSelectedMessages(prev => [...prev, message]);
          setTimeout(() => scrollToBottom(), 100);
        }

        setDirectMessages(prev => {
          const existingDM = prev.find(dm =>
            dm?.user?._id === message.sender._id || dm?._id === message.sender._id
          );

          if (existingDM) {
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

            const updatedDM = updatedDMs.find(dm => dm?.user?._id === message.sender._id || dm?._id === message.sender._id);
            const otherDMs = updatedDMs.filter(dm => dm?.user?._id !== message.sender._id && dm?._id !== message.sender._id);
            return [updatedDM, ...otherDMs];
          }

          return prev;
        });
      }
    };

    const handleReactionUpdate = (data) => {
      const { messageId, reactions } = data;

      setSelectedMessages(prev =>
        prev.map(msg =>
          msg._id === messageId ? { ...msg, reactions } : msg
        )
      );

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

        setDirectMessages(prev =>
          prev.map(dm => {
            if (dm.lastMessage && dm.lastMessage._id === data.messageId) {
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

              {/* Область сообщений */}
              <div
                className={`dm-messages ${showSkeleton ? 'skeleton-loading' : ''}`}
                ref={messagesContainerRef}
                style={{
                  position: 'relative',
                  paddingTop: dmWelcomeH ? `${dmWelcomeH}px` : undefined,
                  visibility: showSkeleton ? 'visible' : (showDMMessages ? 'visible' : 'hidden'),
                  overflow: showSkeleton ? 'hidden' : 'auto',
                  pointerEvents: showSkeleton ? 'none' : 'auto'
                }}
              >
                {/* welcome фиксированный сверху */}
                <div
                  className="dm-messages-welcome"
                  ref={dmWelcomeRef}
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, pointerEvents: 'none' }}
                >
                  {showSkeleton ? (
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
                          onClick={() => handleUnblock(getTargetUserId(selectedDM, autoSelectUser))}
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

              {/* Скелетон сообщений */}
                {showSkeleton && (
                  <div
                    className="dm-skeleton-overlay"
                    style={{ position: 'absolute', top: dmWelcomeH, left: 0, right: 0 }}
                  >
                    {skeletonMessages.length > 0 ? (
                      skeletonMessages.map((messageData, index) => (
                        <DMMessageSkeleton key={messageData.id || index} messageData={messageData} />
                      ))
                    ) : (
                      <>
                        <DMMessageSkeleton />
                        <DMMessageSkeleton messageData={{ hasImages: true, imageCount: 2 }} />
                        <DMMessageSkeleton />
                        <DMMessageSkeleton messageData={{ hasImages: true, imageCount: 1 }} />
                        <DMMessageSkeleton />
                      </>
                    )}
                  </div>
                )}

              {/* Поток сообщений */}
                {showDMMessages && (
                  <div
                    className="dm-thread"
                    style={{
                      opacity: 1,
                      pointerEvents: 'auto',
                    }}
                  >
                    {selectedMessages.length > 0 && (
                      <MessagesList
                        groupedMessages={groupedDMs}
                        user={user}
                        editingMessage={editingMessage}
                        editValue={editValue}
                        onEditChange={setEditValue}
                        onEditSave={handleSaveEdit}
                        onEditCancel={() => {
                          setEditingMessage(null);
                          setEditValue('');
                        }}
                        highlightedMessageId={highlightedMessageId}
                        newDmMessageIds={newDmMessageIds}
                        onUserClick={handleUserClick}
                        onReplySelect={handleReplySelect}
                        onAddReaction={handleAddReaction}
                        onReactionClick={handleReactionClick}
                        onMoreActions={handleMoreActions}
                        onReplyNavigation={handleReplyNavigation}
                        BACKEND_URL={BACKEND_URL}
                        messagesContainerRef={messagesContainerRef}
                        scrollToBottom={scrollToBottom}
                        onImageClick={openLightbox}
                      />
                    )}
                    <div ref={messagesEndRef} className="scroll-anchor" />
                  </div>
                )}
            </div>

            {/* Поле ввода */}
            <MessageInput
              inputValue={inputValue}
              setInputValue={setInputValue}
              selectedFiles={selectedFiles}
              setSelectedFiles={setSelectedFiles}
              replyingTo={replyingTo}
              setReplyingTo={setReplyingTo}
              onSendMessage={handleSendMessage}
              onReplyNavigation={handleReplyNavigation}
              onFileSelect={handleFileSelect}
              removeFile={removeFile}
              openFileDialog={openFileDialog}
              inputRef={inputRef}
              sendingMessage={sendingMessage}
              isConversationBlocked={isConversationBlocked}
              messagePlaceholder={messagePlaceholder}
              BACKEND_URL={BACKEND_URL}
            />
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

      {/* Правая панель - чат */}
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

              {/* Область сообщений */}
              <div
                className={`dm-messages ${showSkeleton ? 'skeleton-loading' : ''}`}
                ref={messagesContainerRef}
                style={{
                  position: 'relative',
                  paddingTop: dmWelcomeH ? `${dmWelcomeH}px` : undefined,
                  visibility: showSkeleton ? 'visible' : (showDMMessages ? 'visible' : 'hidden'),
                  overflow: showSkeleton ? 'hidden' : 'auto',
                  pointerEvents: showSkeleton ? 'none' : 'auto'
                }}
              >
                {/* welcome фиксированный сверху */}
                <div
                  className="dm-messages-welcome"
                  ref={dmWelcomeRef}
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, pointerEvents: 'none' }}
                >
                  {showSkeleton ? (
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
                            onClick={() => handleUnblock(getTargetUserId(selectedDM, autoSelectUser))}
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

                {/* Скелетон сообщений */}
                {showSkeleton && (
                  <div
                    className="dm-skeleton-overlay"
                    style={{ position: 'absolute', top: dmWelcomeH, left: 0, right: 0 }}
                  >
                    {skeletonMessages.length > 0 ? (
                      skeletonMessages.map((messageData, index) => (
                        <DMMessageSkeleton key={messageData.id || index} messageData={messageData} />
                      ))
                    ) : (
                      <>
                        <DMMessageSkeleton />
                        <DMMessageSkeleton messageData={{ hasImages: true, imageCount: 2 }} />
                        <DMMessageSkeleton />
                        <DMMessageSkeleton messageData={{ hasImages: true, imageCount: 1 }} />
                        <DMMessageSkeleton />
                      </>
                    )}
                  </div>
                )}

                {/* Поток сообщений */}
                {showDMMessages && (
                  <div
                    className="dm-thread"
                    style={{
                      opacity: 1,
                      pointerEvents: 'auto',
                    }}
                  >
                    {selectedMessages.length > 0 && (
                      <MessagesList
                        groupedMessages={groupedDMs}
                        user={user}
                        editingMessage={editingMessage}
                        editValue={editValue}
                        onEditChange={setEditValue}
                        onEditSave={handleSaveEdit}
                        onEditCancel={() => {
                          setEditingMessage(null);
                          setEditValue('');
                        }}
                        highlightedMessageId={highlightedMessageId}
                        newDmMessageIds={newDmMessageIds}
                        onUserClick={handleUserClick}
                        onReplySelect={handleReplySelect}
                        onAddReaction={handleAddReaction}
                        onReactionClick={handleReactionClick}
                        onMoreActions={handleMoreActions}
                        onReplyNavigation={handleReplyNavigation}
                        BACKEND_URL={BACKEND_URL}
                        messagesContainerRef={messagesContainerRef}
                        scrollToBottom={scrollToBottom}
                        onImageClick={openLightbox}
                      />
                    )}
                    <div ref={messagesEndRef} className="scroll-anchor" />
                  </div>
                )}
              </div>

              {/* Поле ввода */}
              <MessageInput
                inputValue={inputValue}
                setInputValue={setInputValue}
                selectedFiles={selectedFiles}
                setSelectedFiles={setSelectedFiles}
                replyingTo={replyingTo}
                setReplyingTo={setReplyingTo}
                onSendMessage={handleSendMessage}
                onReplyNavigation={handleReplyNavigation}
                onFileSelect={handleFileSelect}
                removeFile={removeFile}
                openFileDialog={openFileDialog}
                inputRef={inputRef}
                sendingMessage={sendingMessage}
                isConversationBlocked={isConversationBlocked}
                messagePlaceholder={messagePlaceholder}
                BACKEND_URL={BACKEND_URL}
              />
            </div>
          ) : (
            <div className="dm-chat-empty">
              <FriendsPanel onSelectFriend={handleFriendOpen} />
            </div>
          )}
        </div>
      )}

      {/* Emoji Picker для реакций */}
      {showEmojiPicker && (
        <EmojiPicker
          onEmojiSelect={handleEmojiSelect}
          onClose={closeEmojiPicker}
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
            {canDeleteMessage(contextMenu.message, user?.id) && (
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

            <FriendActionButton
              targetUser={selectedUser}
              currentUserId={user?.id}
            />
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

      {/* Лайтбокс изображений */}
      {isLightboxOpen && (
        <ImageLightbox
          images={lightboxImages}
          initialIndex={lightboxInitialIndex}
          onClose={closeLightbox}
        />
      )}
    </div>
  );
}

export default React.memo(DirectMessages);
