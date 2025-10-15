import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import './Chat.css';
import FriendActionButton from './FriendActionButton';
import { useChat } from '../context/ChatContext';
import { useGlobalUsers } from '../context/GlobalUsersContext';
import { SOCKET_EVENTS } from '../constants/events';
import EmojiPicker from './EmojiPicker';
import MessageReactions from './MessageReactions';
import MentionAutocomplete from './MentionAutocomplete';
import MarkdownMessage from './MarkdownMessage';
import MessageEmbeds from './MessageEmbeds';
import ChannelAutocomplete from './ChannelAutocomplete';
import api from '../services/api';
import { mergeMessagesWithLiveUsers } from '../utils/userDataMerger';

const BACKEND_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : `${window.location.protocol}//${window.location.hostname}`;

function Chat({ channel, messages, username, user, currentServer, channels = [], onSendMessage, hasServer, hasTextChannels, serverLoading, socket, onMessageSent, preloadedMessages, isLoadingMessages }) {
  const { setIsLoadingMessages } = useChat();
  const { globalOnlineUsers } = useGlobalUsers();
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
  const [showMessages, setShowMessages] = useState(true); // Изменено: всегда true по умолчанию
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [showFileSizeError, setShowFileSizeError] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiPickerPosition, setEmojiPickerPosition] = useState(null);
  const [selectedMessageForReaction, setSelectedMessageForReaction] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const [mentionTooltip, setMentionTooltip] = useState(null);
  const [serverMembers, setServerMembers] = useState([]);
  const [showMentionAutocomplete, setShowMentionAutocomplete] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0, width: 0 });
  const [mentionSelectedIndex, setMentionSelectedIndex] = useState(0);
  const [showChannelAutocomplete, setShowChannelAutocomplete] = useState(false);
  const [channelFilter, setChannelFilter] = useState('');
  const [channelPosition, setChannelPosition] = useState({ top: 0, left: 0, width: 0 });
  const [channelSelectedIndex, setChannelSelectedIndex] = useState(0);
  const inputRef = useRef(null);

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
  const messageInputFieldRef = useRef(null);
  const hideMentionTooltip = useCallback(() => setMentionTooltip(null), []);
  const [showUnknownChannelModal, setShowUnknownChannelModal] = useState(false);
  const closeUnknownChannelModal = useCallback(() => setShowUnknownChannelModal(false), []);
  const navigate = useNavigate();

  const textChannels = useMemo(() => {
    if (!Array.isArray(channels)) {
      return [];
    }
    return channels.filter(channel => (channel?.type || 'text') === 'text');
  }, [channels]);

  const channelReplaceMap = useMemo(() => {
    const map = new Map();
    textChannels.forEach((channel) => {
      const name = channel?.name || channel?.channelName || channel?.displayName;
      const id = channel?.id || channel?._id || channel?.channelId;
      if (!name || !id) return;
      map.set(name.toLowerCase(), String(id));
    });
    return map;
  }, [textChannels]);

  const replaceChannelTokens = useCallback((text) => {
    if (!text || channelReplaceMap.size === 0) {
      return text;
    }

    return text.replace(/#([\p{L}\p{N}_-]+)/gu, (match, name) => {
      const id = channelReplaceMap.get(name.toLowerCase());
      if (!id) {
        return match;
      }
      return `<#${id}>`;
    });
  }, [channelReplaceMap]);

  // Объединяем сообщения с актуальными данными пользователей
  const liveMessages = useMemo(() => {
    return mergeMessagesWithLiveUsers(messages, globalOnlineUsers);
  }, [messages, globalOnlineUsers]);


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
        const userData = await api.getUserById(message.userId);
        if (userData) {
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

    const basePosition = { top, left };
    const type = mentionMeta.type || 'user';

    if (type === 'role') {
      const roleId = mentionMeta.roleId || mentionMeta.id;
      const role = roleMetadata.byId.get(String(roleId));
      if (!role) {
        hideMentionTooltip();
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
        hideMentionTooltip();
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

    if (!mentionMeta.username) {
      return;
    }

    const normalized = mentionMeta.username.toLowerCase();
    if (normalized === 'everyone') {
      hideMentionTooltip();
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
  }, [channelMetadata, hideMentionTooltip, roleMetadata, serverMembers]);

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
        const token = localStorage.getItem('token');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const response = await fetch(
          `${BACKEND_URL}/api/roles/servers/${currentServer._id}/users/${user.id}/roles`,
          {
            headers,
            credentials: 'include'
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
        const members = await api.getServerMembers(currentServer._id);
        setServerMembers(members);
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

  const handleSendDirectMessage = async () => {
    if (!messageText.trim() || !selectedUser || sendingMessage) return;

    // Не отправляем сообщение самому себе
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

    // Измеряем высоту элемента для анимации
    const element = document.querySelector(`[data-message-id="${message.id}"]`);
    if (element) {
      element.style.height = `${element.offsetHeight}px`;
    }

    // Запускаем анимацию удаления
    setDeletingMessageId(message.id);
    setContextMenu(null);

    // Через 160мс отправляем запрос на удаление (как в Discord)
    setTimeout(() => {
      socket.emit('message:delete', {
        messageId: message.id,
        userId: user?.id
      });

      // Сбрасываем состояние после удаления
      setTimeout(() => {
        setDeletingMessageId(null);
        // Очищаем инлайновую высоту на всякий случай
        if (element) {
          element.style.height = '';
        }
      }, 100);
    }, 160);
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

  // Проверяем настройки пользователя для анимаций
  const prefersReducedMotion = useMemo(() => {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // Логика скролла как в Discord
  const scrollToBottom = useCallback((smooth = false) => {
    const c = messagesContainerRef.current;
    if (!c || messages.length === 0) return;

    const target = c.scrollHeight - c.clientHeight;
    console.log(`[CHAT] scrollToBottom called:`, {
      channelId: channel?.id,
      channelName: channel?.name,
      smooth,
      messagesCount: messages.length,
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
        console.log(`[CHAT] scrollToBottom fallback applied:`, {
          channelId: channel?.id,
          finalScrollTop: c.scrollTop
        });
      }, 10);
    }
  }, [messages.length, prefersReducedMotion, channel?.id, channel?.name]);

  const scrollToMessageById = useCallback((messageId) => {
    if (!messageId || !messagesContainerRef.current) return;

    const target = messagesContainerRef.current.querySelector(`[data-message-id="${messageId}"]`);
    if (target) {
      target.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
        block: 'center'
      });
      setHighlightedMessageId(messageId);
    }
  }, [prefersReducedMotion]);

  // Показываем сообщения (скролл теперь делает useLayoutEffect)
  useEffect(() => {
    if (channel?.id && !isLoadingMessages && messages.length > 0) {
      setShowMessages(true);
    }
  }, [channel?.id, isLoadingMessages, messages.length]);

  // Простой скролл при отправке сообщения
  const handleSendMessage = async (messageText, files = []) => {
    if (!messageText.trim() && files.length === 0) return;

    setSendingMessage(true);
    try {
      await onSendMessage(messageText, files);
      // Плавный скролл вниз после отправки
      setTimeout(() => {
        scrollToBottom(true);
      }, 100);
    } catch (error) {
      console.error('Ошибка отправки сообщения:', error);
    } finally {
      setSendingMessage(false);
    }
  };

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


  // Простые refs для скролла
  const prevMessagesLengthRef = useRef(0);
  const resizeObserverRef = useRef(null);
  const [newMessageIds, setNewMessageIds] = useState(new Set());

  // Флаги для синхронного скролла
  const [bootstrapping, setBootstrapping] = useState(true);
  const initialScrollDoneRef = useRef(false);
  const prevLoadingRef = useRef(false);
  const prevChannelIdRef = useRef(null);
  const startedEmptyRef = useRef(false);

  // Вспомогательный id канала
  const channelId = channel?.id ?? null;

  // Следим за СТАБИЛЬНОЙ сменой канала (игнорим undefined)
  useEffect(() => {
    if (!channelId) return; // <-- важно: игнорим промежуточный undefined
    if (prevChannelIdRef.current !== channelId) {
      console.log(`[CHAT] Channel changed, resetting scroll flags:`, {
        channelId,
        channelName: channel?.name,
        previousChannelId: prevChannelIdRef.current || 'none'
      });
      // это реальная смена канала
      prevChannelIdRef.current = channelId;
      setBootstrapping(true);
      initialScrollDoneRef.current = false;
      startedEmptyRef.current = false;
    }
  }, [channelId, channel?.name]);

  // Первый скролл — строго синхронно до показа
  useLayoutEffect(() => {
    console.log(`[CHAT] useLayoutEffect for initial scroll:`, {
      channelId: channel?.id,
      channelName: channel?.name,
      isLoadingMessages,
      messagesCount: messages.length,
      hasContainer: !!messagesContainerRef.current,
      initialScrollDone: initialScrollDoneRef.current
    });

    if (!messagesContainerRef.current) return;
    if (!channelId) return; // <-- защита от undefined

    // Пока идёт загрузка — ничего не делаем
    if (isLoadingMessages) return;
    // Если сообщений пока 0 — тоже ждём (не считаем скролл сделанным)
    if (messages.length === 0) return;

    if (!initialScrollDoneRef.current) {
      const c = messagesContainerRef.current;
      const target = c.scrollHeight - c.clientHeight;
      console.log(`[CHAT] Initial scroll to bottom:`, {
        channelId: channel?.id,
        channelName: channel?.name,
        scrollHeight: c.scrollHeight,
        clientHeight: c.clientHeight,
        target,
        currentScrollTop: c.scrollTop
      });
      // мгновенно в самый низ без анимации
      c.scrollTop = target;
      initialScrollDoneRef.current = true;
      // откроем контент на следующий кадр — без мерцания
      requestAnimationFrame(() => {
        console.log(`[CHAT] Setting bootstrapping to false for channel:`, channel?.id);
        setBootstrapping(false);
      });
      // Дополнительный скролл для надёжности
      setTimeout(() => {
        c.scrollTop = c.scrollHeight - c.clientHeight;
      }, 0);
    }
  }, [channelId, isLoadingMessages, messages.length]);

  // Доскролл после первой реальной загрузки (переход true → false)
  useEffect(() => {
    const wasLoading = prevLoadingRef.current;
    prevLoadingRef.current = isLoadingMessages;

    // 1) Нормальный кейс: загрузка завершилась, сообщения есть — докрутим вниз
    if (wasLoading && !isLoadingMessages && !initialScrollDoneRef.current && messages.length > 0 && channelId) {
      const c = messagesContainerRef.current;
      if (c) {
        console.log(`[CHAT] First load completed, scrolling to bottom:`, {
          channelId,
          messagesCount: messages.length
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
    if (wasLoading && !isLoadingMessages && messages.length === 0 && channelId) {
      console.log(`[CHAT] First load completed with empty channel, showing welcome:`, {
        channelId
      });
      initialScrollDoneRef.current = true; // инициализацию считаем завершённой для пустого канала
      setBootstrapping(false);             // чтобы visibility стало 'visible'
      startedEmptyRef.current = true;      // помечаем, что старт был пустым
    }
  }, [isLoadingMessages, messages.length, channelId]);

  // Мостик: пустой старт → появились сообщения
  useEffect(() => {
    if (!channelId) return;
    if (startedEmptyRef.current && messages.length > 0 && messagesContainerRef.current) {
      console.log(`[CHAT] Messages appeared after empty start, scrolling to bottom:`, {
        channelId,
        messagesCount: messages.length
      });
      const c = messagesContainerRef.current;
      c.scrollTop = c.scrollHeight - c.clientHeight;
      // страховка
      setTimeout(() => {
        c.scrollTop = c.scrollHeight - c.clientHeight;
      }, 0);
      startedEmptyRef.current = false;
      initialScrollDoneRef.current = true;
      setBootstrapping(false);
    }
  }, [messages.length, channelId]);

  // Автоскролл при добавлении новых сообщений (только если пользователь внизу)
  useLayoutEffect(() => {
    if (!messagesContainerRef.current || !channelId) {
      return;
    }

    const container = messagesContainerRef.current;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    const hasNewMessages = messages.length > prevMessagesLengthRef.current;

    if (hasNewMessages) {
      // 👉 не анимируем на первом заходе
      const isFirstPaint = prevMessagesLengthRef.current === 0;

      if (!isFirstPaint && isNearBottom && !bootstrapping) {
        const newIds = new Set();
        const start = prevMessagesLengthRef.current;
        for (let i = start; i < messages.length; i++) {
          if (messages[i]?.id) newIds.add(messages[i].id);
        }
        setNewMessageIds(newIds);
        scrollToBottom(true);
        setTimeout(() => setNewMessageIds(new Set()), 200);
      }
    }

    prevMessagesLengthRef.current = messages.length;
  }, [messages.length, scrollToBottom, channelId, bootstrapping]);

  // Простой ResizeObserver для автоскролла при загрузке изображений
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || !channelId) return;

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
  }, [channelId, scrollToBottom, bootstrapping]);



  // Обработка изменения в поле ввода для автокомплита упоминаний
  const handleInputChange = (e) => {
    const value = e.target.value;
    setInputValue(value);

    // Проверяем, есть ли @ в тексте
    const cursorPosition = e.target.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    let mentionTriggered = false;

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      if (!textAfterAt.includes(' ')) {
        const normalizedFilter = textAfterAt.toLowerCase();
        const filteredUsers = serverMembers.filter(user =>
          user.username.toLowerCase().startsWith(normalizedFilter)
        );

        const matchesEveryone = 'everyone'.startsWith(normalizedFilter);
        const hasSuggestions = matchesEveryone || filteredUsers.length > 0;

        if (hasSuggestions) {
          const fieldRect = messageInputFieldRef.current?.getBoundingClientRect();
          if (fieldRect) {
            setMentionPosition({
              top: fieldRect.top - 8,
              left: fieldRect.left,
              width: fieldRect.width
            });
            setMentionFilter(textAfterAt);
            setShowMentionAutocomplete(true);
            setMentionSelectedIndex(0);
            mentionTriggered = true;
          }
        } else {
          setShowMentionAutocomplete(false);
        }
      } else {
        setShowMentionAutocomplete(false);
      }
    } else {
      setShowMentionAutocomplete(false);
    }

    if (mentionTriggered) {
      setShowChannelAutocomplete(false);
      return;
    }

    const lastHashIndex = textBeforeCursor.lastIndexOf('#');
    if (lastHashIndex !== -1) {
      const charBeforeHash = lastHashIndex === 0 ? ' ' : textBeforeCursor[lastHashIndex - 1];
      const textAfterHash = textBeforeCursor.substring(lastHashIndex + 1);
      const isValidPrefix = lastHashIndex === 0 || /\s/.test(charBeforeHash);

      if (isValidPrefix && !textAfterHash.includes(' ') && !textAfterHash.includes('#')) {
        const normalizedFilter = textAfterHash.toLowerCase();
        const filteredChannels = textChannels.filter(channel => {
          const name = channel?.name || channel?.channelName || channel?.displayName;
          if (!name) return false;
          return name.toLowerCase().startsWith(normalizedFilter);
        });

        if (filteredChannels.length > 0) {
          const fieldRect = messageInputFieldRef.current?.getBoundingClientRect();
          if (fieldRect) {
            setChannelPosition({
              top: fieldRect.top - 8,
              left: fieldRect.left,
              width: fieldRect.width
            });
            setChannelFilter(textAfterHash);
            setShowChannelAutocomplete(true);
            setChannelSelectedIndex(0);
            return;
          }
        }
      }

      setShowChannelAutocomplete(false);
    } else {
      setShowChannelAutocomplete(false);
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
    setShowChannelAutocomplete(false);
  };

const handleChannelSelect = (channel) => {
    if (!channel) {
      setShowChannelAutocomplete(false);
      return;
    }

    const channelName = channel.name || channel.channelName || channel.displayName;
    if (!channelName) {
      setShowChannelAutocomplete(false);
      return;
    }

    const cursorPosition = inputRef.current.selectionStart;
    const textBeforeCursor = inputValue.substring(0, cursorPosition);
    const textAfterCursor = inputValue.substring(cursorPosition);
    const lastHashIndex = textBeforeCursor.lastIndexOf('#');

    if (lastHashIndex !== -1) {
      const insertion = `#${channelName} `;
      const newValue =
        inputValue.substring(0, lastHashIndex) +
        insertion +
        textAfterCursor;
      setInputValue(newValue);

      setTimeout(() => {
        const newCursorPos = lastHashIndex + insertion.length;
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
        inputRef.current.focus({ preventScroll: true });
      }, 0);
    }

    setShowChannelAutocomplete(false);
    setChannelFilter('');
};

  // Обработка клавиш в поле ввода
  const handleInputKeyDown = (e) => {
    if (showChannelAutocomplete) {
      const normalizedFilter = channelFilter.toLowerCase();
      const filteredChannels = textChannels.filter(channel => {
        const name = channel?.name || channel?.channelName || channel?.displayName;
        if (!name) return false;
        return name.toLowerCase().startsWith(normalizedFilter);
      });

      if (filteredChannels.length === 0) {
        setShowChannelAutocomplete(false);
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setChannelSelectedIndex(prev =>
          prev < filteredChannels.length - 1 ? prev + 1 : prev
        );
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setChannelSelectedIndex(prev => prev > 0 ? prev - 1 : 0);
        return;
      }

      if (e.key === 'Enter') {
        if (filteredChannels[channelSelectedIndex]) {
          e.preventDefault();
          handleChannelSelect(filteredChannels[channelSelectedIndex]);
        } else {
          setShowChannelAutocomplete(false);
        }
        return;
      }

      if (e.key === 'Escape') {
        setShowChannelAutocomplete(false);
        return;
      }
    }

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
        if (suggestions.length > 0) {
          e.preventDefault();
          if (suggestions[mentionSelectedIndex]) {
            handleMentionSelect(suggestions[mentionSelectedIndex]);
          }
          return;
        }
        setShowMentionAutocomplete(false);
      } else if (e.key === 'Escape') {
        setShowMentionAutocomplete(false);
      }

      return;
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Закрываем автокомплит если он открыт
    if (showMentionAutocomplete) {
      setShowMentionAutocomplete(false);
    }
    if (showChannelAutocomplete) {
      setShowChannelAutocomplete(false);
    }

    const trimmedValue = inputValue.trim();
    if (trimmedValue || selectedFiles.length > 0) {
      const convertedValue = replaceChannelTokens(trimmedValue);
      const replyTarget = replyingTo
        ? messages.find(msg => msg.id === replyingTo.id) || replyingTo
        : null;

      onSendMessage(convertedValue, selectedFiles, replyTarget);
      setInputValue('');
      setSelectedFiles([]);
      setReplyingTo(null);

      if (inputRef.current) {
        inputRef.current.focus({ preventScroll: true });
      }

      // Автоматически прокручиваем вниз после отправки сообщения
      setTimeout(() => {
        scrollToBottom(true);
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
  const handleMentionClick = async (mentionData, event) => {
    hideMentionTooltip();

    if (!mentionData) {
      return;
    }

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

    if (!mentionUsername) {
      return;
    }

    // Не показываем профиль для @everyone
    if (mentionUsername.toLowerCase() === 'everyone') return;

    // Ищем пользователя среди участников сервера
    const mentionedUser = serverMembers.find(member =>
      member.username.toLowerCase() === mentionUsername.toLowerCase()
    );

    if (!mentionedUser) return;

    const triggerElement =
      (mentionData && mentionData.element) ||
      event?.target?.closest('[data-mention]') ||
      event?.currentTarget;

    if (!triggerElement) {
      return;
    }

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
        currentGroup.username !== msg.username ||
        currentGroup.dayKey !== dayKey ||
        // строгое окно по времени между соседними сообщениями в группе
        (t - new Date(currentGroup.lastTimestamp)) > thresholdMs ||
        // системные сообщения всегда в отдельном блоке
        msg.isSystem;

      if (needNewGroup) {
        currentGroup = {
          username: msg.username,
          userId: msg.userId,
          dayKey,
          // для разделителя дат
          date: new Date(t.getFullYear(), t.getMonth(), t.getDate()).toDateString(),
          messages: [msg],
          firstTimestamp: msg.timestamp,
          lastTimestamp: msg.timestamp,
          isOwn: msg.username === username,
        };
        grouped.push(currentGroup);
      } else {
        currentGroup.messages.push(msg);
        currentGroup.lastTimestamp = msg.timestamp;
      }
    }

    return grouped;
  };

  // Оптимизированная группировка сообщений
  const groupedMessages = useMemo(
    () => groupMessages(liveMessages, { thresholdMs: 60_000 }),
    [liveMessages]
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
          style={{ visibility: isLoadingMessages ? 'visible' : (bootstrapping ? 'hidden' : 'visible') }}
          aria-busy={isLoadingMessages}
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
            {/* Показываем welcome только если реально пусто */}
            {messages.length === 0 && (
              <div className="messages-welcome">
                <div className="welcome-icon">#</div>
                <h2>Добро пожаловать в #{channel.name}!</h2>
                <p>Это начало канала #{channel.name}</p>
              </div>
            )}

            {messages.length > 0 && (
              <div>
            {groupedMessages.map((group, groupIndex) => {
              const prevGroup = groupIndex > 0 ? groupedMessages[groupIndex - 1] : null;
              const showDateDivider = !prevGroup || prevGroup.date !== group.date;

              return (
                <React.Fragment key={`group-${groupIndex}`}>
                  {showDateDivider && (
                    <div className="date-divider">
                      <div className="date-divider-line"></div>
                      <span className="date-divider-text">{formatDate(group.date)}</span>
                      <div className="date-divider-line"></div>
                    </div>
                  )}
                  {group.messages.map((message, messageIndex) => (
                    <div
                      key={message.id}
                      data-message-id={message.id}
                      className={`message ${message.isSystem ? 'system-message' : ''} ${message.username === username ? 'own-message' : ''} ${isUserMentioned(message) ? 'message-mentioned' : ''} ${editingMessage?.id === message.id ? 'message-edit-mode' : ''} ${contextMenu?.message.id === message.id ? 'show-actions' : ''} ${messageIndex > 0 ? 'message-grouped' : ''} ${messageIndex === 0 && group.messages.length > 1 ? 'message-group-first' : ''} ${messageIndex === group.messages.length - 1 ? 'message-group-last' : ''} ${deletingMessageId === message.id ? 'message-deleting' : ''} ${highlightedMessageId === message.id ? 'message-highlighted' : ''} ${newMessageIds.has(message.id) ? 'msg--just-in' : ''}`}
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
                      <div className="message-text">
                        <MarkdownMessage
                          content={message.content}
                          mentions={message.mentions}
                          roles={roleMetadata.list}
                          channels={channelMetadata.list}
                          currentUsername={username}
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
            ))}
                </React.Fragment>
              );
            })}
              </div>
            )}
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
                    placeholder={
                      isUserBlocked(selectedUser, user)
                        ? `Вы не можете написать @${selectedUser.username}`
                        : `Сообщение для @${selectedUser.username}`
                    }
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={sendingMessage || isUserBlocked(selectedUser, user)}
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
            className="message-context-menu pop"
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
            onClose={() => {
              setShowEmojiPicker(false);
              setSelectedMessageForReaction(null);
            }}
            position={null}
          />
        </div>
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
      {showChannelAutocomplete && (
        <ChannelAutocomplete
          channels={textChannels}
          filter={channelFilter}
          onSelect={handleChannelSelect}
          position={channelPosition}
          selectedIndex={channelSelectedIndex}
        />
      )}

      {showUnknownChannelModal && (
        <div className="join-server-overlay" onClick={closeUnknownChannelModal}>
          <div className="join-server-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Канал недоступен</h2>
            <p className="modal-subtitle">
              Этот канал удален или у вас нет к нему доступа
            </p>
            <div className="modal-footer">
              <button className="btn-primary" onClick={closeUnknownChannelModal}>
                Понятно
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Chat;
