import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './Chat.css';

// Компоненты
import MessagesList from './messages/MessagesList';
import MessageInput from './input/MessageInput';
import UserProfile from './profile/UserProfile';
import FileSizeErrorModal from './modals/FileSizeErrorModal';
import UnknownChannelModal from './modals/UnknownChannelModal';
import EmojiPicker from './EmojiPicker';
import MentionAutocomplete from './MentionAutocomplete';
import ChannelAutocomplete from './ChannelAutocomplete';
import ImageLightbox from './ImageLightbox';

// Хуки
import { useChatLoading } from '../hooks/useChatLoading';
import { useSimpleScroll } from '../hooks/useSimpleScroll';
import { useMentions } from '../hooks/useMentions';
import { useReactions } from '../hooks/useReactions';
import { useImageLightbox } from '../hooks/useImageLightbox';

// Утилиты
import {
  buildReplySnapshot,
  canEditMessage,
  canDeleteMessage
} from '../utils/messageUtils';

// Контексты и сервисы
import { useGlobalUsers } from '../context/GlobalUsersContext';
import { mergeMessagesWithLiveUsers } from '../utils/userDataMerger';
import api from '../services/api';

const BACKEND_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : `${window.location.protocol}//${window.location.hostname}`;

/**
 * Основной компонент чата
 */
function Chat({
  channel,
  messages,
  username,
  user,
  currentServer,
  channels = [],
  onSendMessage,
  hasServer,
  hasTextChannels,
  serverLoading,
  socket,
  onMessageSent,
  preloadedMessages,
  isLoadingMessages
}) {
  const { globalOnlineUsers } = useGlobalUsers();
  const navigate = useNavigate();

  // Основные состояния
  const [inputValue, setInputValue] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [profilePosition, setProfilePosition] = useState({ top: 0, left: 0 });
  const [contextMenu, setContextMenu] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [userPermissions, setUserPermissions] = useState(null);
  const [deletingMessageId, setDeletingMessageId] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  // const [uploadingFiles, setUploadingFiles] = useState(false);
  const [showFileSizeError, setShowFileSizeError] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const [mentionTooltip, setMentionTooltip] = useState(null);
  const [serverMembers, setServerMembers] = useState([]);
  const [showUnknownChannelModal, setShowUnknownChannelModal] = useState(false);

  // Лайтбокс изображений
  const { isOpen: isLightboxOpen, images: lightboxImages, initialIndex: lightboxInitialIndex, openLightbox, closeLightbox } = useImageLightbox();

  // Refs
  const inputRef = useRef(null);
  const messageInputFieldRef = useRef(null);

  // Проверка предпочтений анимации
  const prefersReducedMotion = useMemo(() => {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // Фильтрация текстовых каналов
  const textChannels = useMemo(() => {
    if (!Array.isArray(channels)) return [];
    return channels.filter(channel => (channel?.type || 'text') === 'text');
  }, [channels]);

  // Использование кастомных хуков
  const {
    loadingState,
    showSkeleton,
    showMessages,
    isReady
  } = useChatLoading(channel, messages, isLoadingMessages, preloadedMessages);

  const {
    messagesContainerRef,
    messagesEndRef,
    newMessageIds,
    scrollToBottom,
    scrollToMessage
  } = useSimpleScroll(messages, channel, isReady, prefersReducedMotion);

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
    showMentionAutocomplete,
    mentionFilter,
    mentionPosition,
    mentionSelectedIndex,
    showChannelAutocomplete,
    channelFilter,
    channelPosition,
    channelSelectedIndex,
    handleInputChange: handleMentionInputChange,
    handleMentionSelect,
    handleChannelSelect,
    handleInputKeyDown
  } = useMentions(serverMembers, textChannels);

  // Простой обработчик изменения ввода
  const handleInputChange = useCallback((e, messageInputFieldRef) => {
    const value = e.target.value;
    setInputValue(value);

    // Вызываем обработчик упоминаний
    handleMentionInputChange(e, messageInputFieldRef);
  }, [handleMentionInputChange]);

  const {
    showEmojiPicker,
    emojiPickerPosition,
    handleAddReaction,
    handleEmojiSelect,
    handleReactionClick,
    closeEmojiPicker
  } = useReactions(socket, user);

  // Объединение сообщений с актуальными данными пользователей
  const liveMessages = useMemo(() => {
    return mergeMessagesWithLiveUsers(messages, globalOnlineUsers);
  }, [messages, globalOnlineUsers]);

  // Метаданные ролей
  const roleMetadata = useMemo(() => {
    const map = new Map();

    if (Array.isArray(currentServer?.roles)) {
      currentServer.roles.forEach((role) => {
        const id = role?._id ?? role?.id ?? role?.roleId;
        if (!id) return;
        map.set(String(id), {
          id: String(id),
          name: role?.name || role?.displayName || `Роль ${id}`
        });
      });
    }

    serverMembers.forEach((member) => {
      if (!Array.isArray(member?.roles)) return;
      member.roles.forEach((role) => {
        const id = role?.id ?? role?._id ?? role?.roleId ?? role?.role?.id;
        if (!id) return;
        if (!map.has(String(id))) {
          map.set(String(id), {
            id: String(id),
            name: role?.name || role?.roleName || role?.displayName || role?.label || `Роль ${id}`
          });
        }
      });
    });

    const list = Array.from(map.values());
    return { list, byId: map };
  }, [currentServer?.roles, serverMembers]);

  // Метаданные каналов
  const channelMetadata = useMemo(() => {
    const map = new Map();
    if (Array.isArray(channels)) {
      channels.forEach((ch) => {
        const id = ch?.id ?? ch?._id ?? ch?.channelId;
        if (!id) return;
        map.set(String(id), {
          id: String(id),
          name: ch?.name || ch?.channelName || ch?.displayName || `канал-${id}`,
          type: ch?.type || 'text'
        });
      });
    }

    const list = Array.from(map.values());
    return { list, byId: map };
  }, [channels]);

  // Загрузка прав пользователя
  useEffect(() => {
    const loadUserPermissions = async () => {
      if (!currentServer || !user?.id) {
        setUserPermissions(null);
        return;
      }

      try {
        const token = localStorage.getItem('token');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const response = await fetch(
          `${BACKEND_URL}/api/roles/servers/${currentServer._id}/users/${user.id}/roles`,
          { headers, credentials: 'include' }
        );

        if (response.ok) {
          const userRoles = await response.json();
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

  // Загрузка участников сервера
  useEffect(() => {
    const loadServerMembers = async () => {
      if (!currentServer?._id) {
        setServerMembers([]);
        return;
      }

      try {
        const members = await api.getServerMembers(currentServer._id);
        setServerMembers(members);
      } catch (err) {
        console.error('Ошибка загрузки участников:', err);
        setServerMembers([]);
      }
    };

    loadServerMembers();
  }, [currentServer]);

  // Обработчики событий
  const handleUserClick = async (message, event) => {
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

    if (message.userId) {
      try {
        const userData = await api.getUserById(message.userId);
        if (userData) {
          setSelectedUser(userData);
          return;
        }
      } catch (err) {
        console.error('Ошибка загрузки данных пользователя:', err);
      }
    }

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

  const handleSendDirectMessage = async () => {
    if (!messageText.trim() || !selectedUser || sendingMessage) return;
    if (selectedUser.userId === username || selectedUser.username === username) return;

    setSendingMessage(true);
    try {
      const token = localStorage.getItem('token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      };

      const response = await fetch(`${BACKEND_URL}/api/direct-messages/send`, {
        method: 'POST',
        headers,
        credentials: 'include',
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
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  const handleReplySelect = (message) => {
    if (!message || message.isSystem) return;
    setReplyingTo(buildReplySnapshot(message));
    setContextMenu(null);
    requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true });
    });
  };

  // const cancelReply = () => setReplyingTo(null);

  const handleReplyNavigation = (messageId) => {
    if (!messageId) return;
    scrollToMessage(messageId);
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

    const element = document.querySelector(`[data-message-id="${message.id}"]`);
    if (element) {
      element.style.height = `${element.offsetHeight}px`;
    }

    setDeletingMessageId(message.id);
    setContextMenu(null);

    setTimeout(() => {
      socket.emit('message:delete', {
        messageId: message.id,
        userId: user?.id
      });

      setTimeout(() => {
        setDeletingMessageId(null);
        if (element) {
          element.style.height = '';
        }
      }, 100);
    }, 160);
  };

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
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const openFileDialog = () => {
    document.getElementById('file-input').click();
  };

  const handleMentionHover = useCallback((mentionMeta, sourceMessage) => {
    if (!mentionMeta) return;

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

    const basePosition = { top, left };
    const type = mentionMeta.type || 'user';

    if (type === 'role') {
      const roleId = mentionMeta.roleId || mentionMeta.id;
      const role = roleMetadata.byId.get(String(roleId));
      if (!role) {
        setMentionTooltip(null);
        return;
      }

      setMentionTooltip({
        displayName: `@${role.name}`,
        subtitle: 'Роль сервера',
        role: null,
        position: basePosition,
        username: role.name
      });
      return;
    }

    if (type === 'channel') {
      const channelId = mentionMeta.channelId || mentionMeta.id;
      const channel = channelMetadata.byId.get(String(channelId));
      if (!channel) {
        setMentionTooltip(null);
        return;
      }

      const channelTypeLabel = channel.type === 'voice' ? 'Голосовой канал' : 'Текстовый канал';

      setMentionTooltip({
        displayName: `#${channel.name}`,
        subtitle: channelTypeLabel,
        role: null,
        position: basePosition,
        username: channel.name
      });
      return;
    }

    if (!mentionMeta.username) return;

    const normalized = mentionMeta.username.toLowerCase();
    if (normalized === 'everyone') {
      setMentionTooltip(null);
      return;
    }

    const serverMember = serverMembers.find(member =>
      member.username?.toLowerCase?.() === normalized ||
      member.user?.username?.toLowerCase?.() === normalized
    );

    const messageMention = Array.isArray(sourceMessage?.mentions)
      ? sourceMessage.mentions.find(mention => mention.username?.toLowerCase() === normalized)
      : null;

    const displayName = serverMember?.displayName
      || serverMember?.nickname
      || messageMention?.displayName
      || messageMention?.nickname
      || mentionMeta.username;

    const subtitleUsername = serverMember?.username
      || messageMention?.username
      || mentionMeta.username;

    const subtitle = `@${subtitleUsername}`;

    let roleName;
    if (serverMember?.primaryRole?.name) {
      roleName = serverMember.primaryRole.name;
    } else if (Array.isArray(serverMember?.roles) && serverMember.roles.length > 0) {
      const primaryRole = serverMember.roles.find(role => role.isPrimary || role.primary);
      roleName = primaryRole?.name || serverMember.roles[0]?.name;
    } else if (serverMember?.roleName) {
      roleName = serverMember.roleName;
    } else if (messageMention?.roleName) {
      roleName = messageMention.roleName;
    } else if (Array.isArray(messageMention?.roles) && messageMention.roles.length > 0) {
      const primaryMentionRole = messageMention.roles.find(role => role.isPrimary || role.primary);
      roleName = primaryMentionRole?.name || messageMention.roles[0]?.name;
    }

    setMentionTooltip({
      displayName,
      subtitle,
      role: roleName,
      position: basePosition,
      username: mentionMeta.username
    });
  }, [channelMetadata, roleMetadata, serverMembers]);

  const hideMentionTooltip = useCallback(() => setMentionTooltip(null), []);

  const handleMentionClick = async (mentionData, event) => {
    hideMentionTooltip();

    if (!mentionData) return;

    if (mentionData.type === 'channel') {
      if (event?.preventDefault) {
        event.preventDefault();
      }
      if (event?.stopPropagation) {
        event.stopPropagation();
      }

      const rawChannelId = mentionData.channelId || mentionData.id;
      const channelId = rawChannelId ? String(rawChannelId) : null;

      if (!channelId) {
        setShowUnknownChannelModal(true);
        return;
      }

      const channelExists = channelMetadata.byId.has(channelId);

      if (mentionData.unknownChannel || !channelExists || !currentServer?._id) {
        setShowUnknownChannelModal(true);
        return;
      }

      navigate(`/channels/${currentServer._id}/${channelId}`);
      return;
    }

    const mentionUsername =
      typeof mentionData === 'string'
        ? mentionData
        : mentionData?.username;

    if (!mentionUsername) return;

    if (mentionUsername.toLowerCase() === 'everyone') return;

    const mentionedUser = serverMembers.find(member =>
      member.username.toLowerCase() === mentionUsername.toLowerCase()
    );

    if (!mentionedUser) return;

    const triggerElement =
      (mentionData && mentionData.element) ||
      event?.target?.closest('[data-mention]') ||
      event?.currentTarget;

    if (!triggerElement) return;

    const rect = triggerElement.getBoundingClientRect();
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

    setSelectedUser({
      username: mentionedUser.username,
      displayName: mentionedUser.displayName,
      avatar: mentionedUser.avatar,
      badge: mentionedUser.badge,
      badgeTooltip: mentionedUser.badgeTooltip,
      userId: mentionedUser.id
    });
  };

  const handleSendMessage = async (messageText, files = []) => {
    if (!messageText.trim() && files.length === 0) return;

    setSendingMessage(true);
    try {
      await onSendMessage(messageText, files);
      setTimeout(() => {
        scrollToBottom(true);
      }, 100);
    } catch (error) {
      console.error('Ошибка отправки сообщения:', error);
    } finally {
      setSendingMessage(false);
    }
  };


  // Layout-shift guard для предотвращения скачков при загрузке изображений
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || !showMessages) return;

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
  }, [messages, showMessages, isReady]);

  // Очистка состояний при смене канала
  useEffect(() => {
    setReplyingTo(null);
    setHighlightedMessageId(null);
  }, [channel?.id]);

  useEffect(() => {
    hideMentionTooltip();
  }, [channel?.id, hideMentionTooltip]);

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

  // Рендер welcome экрана
  if (!channel) {
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
    return <div className="chat" />;
  }

  return (
    <div className="chat">
      <div className="chat-header">
        <span className="channel-icon">#</span>
        <h3>{channel.name}</h3>
      </div>

      <div
        className={`messages-container ${showSkeleton ? 'skeleton-loading' : ''}`}
        ref={messagesContainerRef}
        style={{
          visibility: showSkeleton ? 'visible' : (showMessages ? 'visible' : 'hidden'),
          overflow: showSkeleton ? 'hidden' : 'auto',
          pointerEvents: showSkeleton ? 'none' : 'auto'
        }}
        aria-busy={loadingState === 'loading'}
      >
        {showSkeleton ? (
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
        ) : showMessages ? (
          <>
            <div className="messages-welcome">
              <div className="welcome-icon">#</div>
              <h2>Добро пожаловать в #{channel.name}!</h2>
              <p>Это начало канала #{channel.name}</p>
            </div>

            {messages.length > 0 && (
              <MessagesList
                messages={liveMessages}
                username={username}
                user={user}
                userPermissions={userPermissions}
                roleMetadata={roleMetadata}
                channelMetadata={channelMetadata}
                editingMessage={editingMessage}
                editValue={editValue}
                setEditValue={setEditValue}
                contextMenu={contextMenu}
                deletingMessageId={deletingMessageId}
                highlightedMessageId={highlightedMessageId}
                newMessageIds={newMessageIds}
                onUserClick={handleUserClick}
                onMentionClick={handleMentionClick}
                onMentionHover={handleMentionHover}
                onMentionLeave={hideMentionTooltip}
                onReplySelect={handleReplySelect}
                onReplyNavigation={handleReplyNavigation}
                onEditMessage={handleEditMessage}
                onCancelEdit={handleCancelEdit}
                onSaveEdit={handleSaveEdit}
                onMoreActions={handleMoreActions}
                onReactionClick={handleReactionClick}
                onAddReaction={handleAddReaction}
                canEditMessage={(message) => canEditMessage(message, username)}
                canDeleteMessage={(message) => canDeleteMessage(message, username, userPermissions)}
                messagesContainerRef={messagesContainerRef}
                scrollToBottom={scrollToBottom}
                onImageClick={openLightbox}
              />
            )}
            <div ref={messagesEndRef} className="scroll-anchor" />
          </>
        ) : null}
      </div>

      <MessageInput
        channel={channel}
        inputValue={inputValue}
        setInputValue={setInputValue}
        selectedFiles={selectedFiles}
        setSelectedFiles={setSelectedFiles}
        replyingTo={replyingTo}
        setReplyingTo={setReplyingTo}
        onSendMessage={handleSendMessage}
        onReplyNavigation={handleReplyNavigation}
        onInputChange={handleInputChange}
        onInputKeyDown={handleInputKeyDown}
        onFileSelect={handleFileSelect}
        removeFile={removeFile}
        openFileDialog={openFileDialog}
        messageInputFieldRef={messageInputFieldRef}
        inputRef={inputRef}
        sendingMessage={sendingMessage}
      />

      {/* Tooltip для упоминаний */}
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

      {/* Профиль пользователя */}
      <UserProfile
        selectedUser={selectedUser}
        profilePosition={profilePosition}
        user={user}
        messageText={messageText}
        setMessageText={setMessageText}
        sendingMessage={sendingMessage}
        onCloseProfile={handleCloseProfile}
        onSendDirectMessage={handleSendDirectMessage}
        onKeyPress={handleKeyPress}
      />

      {/* Контекстное меню */}
      {contextMenu && (
        <>
          <div className="message-context-overlay" onClick={handleCloseContextMenu} />
          <div
            className="message-context-menu pop"
            style={{
              top: `${contextMenu.position.top}px`,
              left: `${contextMenu.position.left}px`
            }}
          >
            {canDeleteMessage(contextMenu.message, username, userPermissions) && (
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

      {/* Модальные окна */}
      <FileSizeErrorModal
        isOpen={showFileSizeError}
        onClose={() => setShowFileSizeError(false)}
      />

      <UnknownChannelModal
        isOpen={showUnknownChannelModal}
        onClose={() => setShowUnknownChannelModal(false)}
      />

      {/* Emoji Picker */}
      {showEmojiPicker && (
        <div
          className="pop"
          style={{
            position: 'fixed',
            top: emojiPickerPosition?.top,
            left: emojiPickerPosition?.left
          }}
        >
          <EmojiPicker
            onEmojiSelect={handleEmojiSelect}
            onClose={closeEmojiPicker}
            position={null}
          />
        </div>
      )}

      {/* Автокомплиты */}
      {showMentionAutocomplete && (
        <MentionAutocomplete
          users={serverMembers}
          filter={mentionFilter}
          onSelect={(user) => handleMentionSelect(user, inputRef, inputValue, setInputValue)}
          position={mentionPosition}
          selectedIndex={mentionSelectedIndex}
        />
      )}

      {showChannelAutocomplete && (
        <ChannelAutocomplete
          channels={textChannels}
          filter={channelFilter}
          onSelect={(channel) => handleChannelSelect(channel, inputRef, inputValue, setInputValue)}
          position={channelPosition}
          selectedIndex={channelSelectedIndex}
        />
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

export default Chat;
