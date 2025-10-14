import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './ChannelList.css';
import FriendActionButton from './FriendActionButton';
import UserProfile from './UserProfile';
import ChannelSettingsModal from './ChannelSettingsModal';
import ServerSettingsModal from './ServerSettingsModal';
import { useVoice } from '../context/VoiceContext';
import api from '../services/api';

const BACKEND_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : `${window.location.protocol}//${window.location.hostname}`;

function ChannelList({ channels, currentTextChannel, currentVoiceChannel, voiceChannelUsers, speakingUsers, user, isMuted, isDeafened, isInVoice, isScreenSharing, screenSharingUsers, serverName, currentServer, serverMembers, onToggleMute, onToggleDeafen, onToggleScreenShare, onDisconnect, onLogout, onAvatarUpdate, onSelectChannel, onCreateChannel, onUpdateChannel, onDeleteChannel, onMessageSent, onRefreshMembers }) {
  const { connectToStream } = useVoice();
  const [showTextForm, setShowTextForm] = useState(false);
  const [showVoiceForm, setShowVoiceForm] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [serverMenuOpen, setServerMenuOpen] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [isServerSettingsOpen, setIsServerSettingsOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [profilePosition, setProfilePosition] = useState({ top: 0, left: 0 });
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [hoveredScreenSharingUser, setHoveredScreenSharingUser] = useState(null);
  const [voiceVolumeMenu, setVoiceVolumeMenu] = useState(null);
  const [userVolumeOverrides, setUserVolumeOverrides] = useState(() => {
    try {
      const saved = localStorage.getItem('voiceUserVolumes');
      return saved ? JSON.parse(saved) : {};
    } catch (err) {
      console.warn('Не удалось загрузить индивидуальные громкости пользователей:', err);
      return {};
    }
  });
  const volumeMenuRef = useRef(null);
  const serverMenuRef = useRef(null);

  // Состояния для управления каналами
  const [showChannelSettings, setShowChannelSettings] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState(null);

  const handleVoiceUserClick = async (voiceUser, event) => {
    event.stopPropagation();
    setVoiceVolumeMenu(null);
    const rect = event.currentTarget.getBoundingClientRect();
    setProfilePosition({
      top: rect.top,
      left: rect.right + 8
    });

    // Если есть userId, загрузить актуальные данные пользователя
    if (voiceUser.userId) {
      try {
        const userData = await api.getUserById(voiceUser.userId);
        if (userData) {
          setSelectedUser(userData);
          return;
        }
      } catch (err) {
        console.error('Ошибка загрузки данных пользователя:', err);
      }
    }

    // Fallback: использовать данные из голосового канала
    setSelectedUser(voiceUser);
  };

  const handleCloseProfile = () => {
    setSelectedUser(null);
    setMessageText('');
  };

  const getUserVolumeValue = (accountId) => {
    if (!accountId) return 100;
    const raw = userVolumeOverrides?.[accountId];
    if (typeof raw !== 'number' || Number.isNaN(raw)) {
      return 100;
    }
    return Math.min(200, Math.max(0, raw));
  };

  const handleVoiceUserContextMenu = (voiceUser, event, channel) => {
    event.preventDefault();
    event.stopPropagation();

    if (!voiceUser || voiceUser.id === 'me') return;
    // Убрали проверку на нахождение в том же голосовом канале - меню должно открываться всегда

    const accountId = voiceUser.userId || voiceUser.id;
    if (!accountId) return;

    setSelectedUser(null);
    setHoveredScreenSharingUser(null);

    const menuWidth = 220;
    const menuHeight = 150;
    const padding = 12;

    const rawX = event.clientX;
    const rawY = event.clientY;

    const clampedX = Math.min(
      Math.max(padding, rawX),
      window.innerWidth - menuWidth - padding
    );
    const clampedY = Math.min(
      Math.max(padding, rawY),
      window.innerHeight - menuHeight - padding
    );

    setVoiceVolumeMenu({
      accountId,
      username: voiceUser.displayName || voiceUser.username,
      position: { x: clampedX, y: clampedY },
      channelId: channel.id,
      volume: getUserVolumeValue(accountId)
    });
  };

  const closeVoiceVolumeMenu = () => {
    setVoiceVolumeMenu(null);
  };

  const updateVoiceUserVolume = (accountId, nextVolume) => {
    const numericValue = Math.min(200, Math.max(0, Number(nextVolume)));

    setUserVolumeOverrides(prev => {
      const updated = { ...prev };
      if (numericValue === 100) {
        delete updated[accountId];
      } else {
        updated[accountId] = numericValue;
      }
      try {
        localStorage.setItem('voiceUserVolumes', JSON.stringify(updated));
      } catch (err) {
        console.warn('Не удалось сохранить индивидуальную громкость:', err);
      }
      return updated;
    });

    setVoiceVolumeMenu(prev => {
      if (!prev || prev.accountId !== accountId) {
        return prev;
      }
      return { ...prev, volume: numericValue };
    });

    window.dispatchEvent(new CustomEvent('voiceUserVolumeChanged', {
      detail: { userId: accountId, volume: numericValue }
    }));
  };

  const handleResetVoiceVolume = (accountId) => {
    updateVoiceUserVolume(accountId, 100);
  };

  const handleOpenStream = (screenSharingUser) => {
    // Закрыть профиль пользователя если он открыт
    setSelectedUser(null);
    setHoveredScreenSharingUser(null);

    // Получаем информацию о пользователе из screenSharingUsers
    const channelScreenSharing = screenSharingUsers[currentVoiceChannel?.id] || new Map();
    let socketId = null;

    // Ищем socketId по userId (теперь ключом является userId)
    const targetUserId = screenSharingUser.userId || screenSharingUser.id;
    const userInfo = channelScreenSharing.get(targetUserId);
    if (userInfo && userInfo.socketId) {
      socketId = userInfo.socketId;
    }

    if (socketId) {
      console.log('Открываем стрим пользователя:', screenSharingUser.username, 'socketId:', socketId);
      connectToStream(socketId);
    } else {
      console.log('❌ Не удалось найти socketId для пользователя:', screenSharingUser.username);
    }
  };

  const handleSendDirectMessage = async () => {
    if (!messageText.trim() || !selectedUser || sendingMessage) return;

    setSendingMessage(true);
    try {
      await api.sendDirectMessage(selectedUser.userId || selectedUser.id, messageText.trim());

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


  const [inviteLink, setInviteLink] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [serverMembersList, setServerMembersList] = useState(serverMembers || []);
  const [banLoadingId, setBanLoadingId] = useState(null);
  const [banError, setBanError] = useState('');

  // Сбрасываем инвайт при смене сервера
  useEffect(() => {
    setServerMembersList(Array.isArray(serverMembers) ? serverMembers : []);
  }, [serverMembers]);

  useEffect(() => {
    setInviteLink('');
    setServerMenuOpen(false);
    setShowInviteModal(false);
    setBanError('');
    setBanLoadingId(null);
  }, [currentServer?._id]);

  useEffect(() => {
    if (!serverMenuOpen) {
      return;
    }

    const handleOutsideClick = (event) => {
      if (serverMenuRef.current && !serverMenuRef.current.contains(event.target)) {
        setServerMenuOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setServerMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [serverMenuOpen]);

  useEffect(() => {
    if (!isServerSettingsOpen) {
      setBanError('');
      setBanLoadingId(null);
    }
  }, [isServerSettingsOpen]);

  useEffect(() => {
    if (!voiceVolumeMenu) return;

    const handleGlobalClick = (event) => {
      if (volumeMenuRef.current && volumeMenuRef.current.contains(event.target)) {
        return;
      }
      setVoiceVolumeMenu(null);
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setVoiceVolumeMenu(null);
      }
    };

    window.addEventListener('mousedown', handleGlobalClick);
    window.addEventListener('contextmenu', handleGlobalClick);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('mousedown', handleGlobalClick);
      window.removeEventListener('contextmenu', handleGlobalClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [voiceVolumeMenu]);

  useEffect(() => {
    if (!voiceVolumeMenu) return;
    const raw = userVolumeOverrides?.[voiceVolumeMenu.accountId];
    const normalized = typeof raw === 'number' && !Number.isNaN(raw)
      ? Math.min(200, Math.max(0, raw))
      : 100;
    if (normalized !== voiceVolumeMenu.volume) {
      setVoiceVolumeMenu(prev => prev ? { ...prev, volume: normalized } : prev);
    }
  }, [userVolumeOverrides, voiceVolumeMenu]);

  // Убрали проверки, которые закрывали меню при выходе из голосового канала
  // Меню должно оставаться открытым, даже если пользователь не в том же канале

  const loadOrCreateInvite = async () => {
    if (!currentServer) return '';

    setInviteLoading(true);
    setCopied(false);
    let generatedCode = '';
    try {
      const token = localStorage.getItem('token');
      const authHeaders = token ? { 'Authorization': `Bearer ${token}` } : {};

      // Сначала попробуем загрузить существующие инвайты
      const getResponse = await fetch(`${BACKEND_URL}/api/servers/${currentServer._id}/invites`, {
        headers: authHeaders,
        credentials: 'include'
      });

      if (getResponse.ok) {
        const invites = await getResponse.json();
        console.log('📩 Загружены инвайты:', invites);

        // Ищем первый валидный инвайт
        const validInvite = invites.find(invite => {
          // Проверяем что инвайт не истёк
          if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
            return false;
          }
          // Проверяем лимит использований
          if (invite.maxUses !== null && invite.uses >= invite.maxUses) {
            return false;
          }
          return true;
        });

        if (validInvite) {
          // Используем существующий инвайт
          console.log('✅ Используем существующий инвайт:', validInvite.code);
          setInviteLink(validInvite.code);
          generatedCode = validInvite.code;
          setInviteLoading(false);
          return validInvite.code;
        }
      }

      // Если нет валидных инвайтов, создаём новый
      console.log('➕ Создаём новый инвайт');
      const createResponse = await fetch(`${BACKEND_URL}/api/servers/${currentServer._id}/invites`, {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({})
      });

      const data = await createResponse.json();
      if (createResponse.ok) {
        console.log('✅ Создан новый инвайт:', data.code);
        setInviteLink(data.code);
        generatedCode = data.code;
      }
    } catch (err) {
      console.error('❌ Ошибка загрузки инвайта:', err);
    } finally {
      setInviteLoading(false);
    }
    return generatedCode;
  };

  const handleCopyInvite = () => {
    if (!inviteLink) return;

    const fullLink = `${window.location.origin}/invite/${inviteLink}`;
    navigator.clipboard.writeText(fullLink)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(err => {
        console.error('Не удалось скопировать ссылку:', err);
      });
  };

  const toggleServerMenu = () => {
    if (serverMenuOpen) {
      setServerMenuOpen(false);
    } else {
      setShowInviteModal(false);
      setServerMenuOpen(true);
    }
  };

  const handleInviteMenu = async () => {
    await loadOrCreateInvite();
    setServerMenuOpen(false);
    setShowInviteModal(true);
  };

  const closeInviteModal = () => {
    setShowInviteModal(false);
    setCopied(false);
  };

  const handleServerSettingsOpen = () => {
    setServerMenuOpen(false);
    setShowInviteModal(false);
    setIsServerSettingsOpen(true);
  };

  const handleServerSettingsClose = () => {
    console.log('[🔍 SETTINGS DEBUG] Закрываем настройки сервера');
    setIsServerSettingsOpen(false);
    setBanError('');
    setBanLoadingId(null);
  };

  const handleBanMember = async (member) => {
    if (!currentServer || !member?.id) {
      return;
    }

    setBanLoadingId(member.id);
    setBanError('');

    try {
      await api.banServerMember(currentServer._id, {
        userId: member.id
      });

      if (typeof onRefreshMembers === 'function') {
        const updatedMembers = await onRefreshMembers(currentServer._id);
        if (Array.isArray(updatedMembers)) {
          setServerMembersList(updatedMembers);
        } else {
          setServerMembersList(prev => prev.filter(item => item.id !== member.id));
        }
      } else {
        setServerMembersList(prev => prev.filter(item => item.id !== member.id));
      }

      setBanLoadingId(null);
    } catch (err) {
      console.error('Ошибка бана пользователя:', err);
      const message = err?.message || 'Не удалось забанить пользователя';
      setBanError(message);
      setBanLoadingId(null);
      throw err;
    }
  };

  const handleCreateText = (e) => {
    e.preventDefault();
    const trimmedName = newChannelName.trim();
    if (trimmedName) {
      onCreateChannel(trimmedName, 'text');
      setNewChannelName('');
      setShowTextForm(false);
    }
  };

  const handleCreateVoice = (e) => {
    e.preventDefault();
    const trimmedName = newChannelName.trim();
    if (trimmedName) {
      onCreateChannel(trimmedName, 'voice');
      setNewChannelName('');
      setShowVoiceForm(false);
    }
  };

  // Функции для управления каналами
  const openChannelSettings = (channel, event) => {
    event.stopPropagation();
    setSelectedChannel(channel);
    setShowChannelSettings(true);
  };

  const closeChannelSettings = () => {
    setShowChannelSettings(false);
    setSelectedChannel(null);
  };

  const textChannels = channels && Array.isArray(channels) ? channels.filter(ch => ch.type === 'text') : [];
  const voiceChannels = channels && Array.isArray(channels) ? channels.filter(ch => ch.type === 'voice') : [];

  return (
    <div className="channel-list">
      <div className="channel-list-header">
        <h2>{serverName || 'Выберите сервер'}</h2>
        {currentServer && (
          <div className="server-menu-wrapper" ref={serverMenuRef}>
            <button
              className={`server-menu-btn ${serverMenuOpen ? 'open' : ''}`}
              onClick={toggleServerMenu}
              title="Меню сервера"
            >
              <img
                src="/icons/arrow_down.png"
                alt="Меню"
                className="arrow-icon"
              />
            </button>
            {serverMenuOpen && (
              <div className="server-menu-dropdown">
                <button
                  type="button"
                  className="server-menu-item"
                  onClick={handleInviteMenu}
                >
                  Пригласить на сервер
                </button>
                {(currentServer?.canManageServer === true || currentServer?.canManageMembers === true || currentServer?.canBanMembers === true) && (
                  <button
                    type="button"
                    className="server-menu-item"
                    onClick={handleServerSettingsOpen}
                  >
                    Настройки сервера
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="channels-container">
        <div className="channels-section">
        <div className="section-header">
          <span>ТЕКСТОВЫЕ КАНАЛЫ</span>
          {currentServer?.canManageChannels === true ? (
            <button
              className="add-channel-btn"
              onClick={() => {
                setShowTextForm(!showTextForm);
                setShowVoiceForm(false);
                setNewChannelName('');
              }}
              title="Создать текстовый канал"
            >
              +
            </button>
          ) : (
            <div className="add-channel-btn-placeholder"></div>
          )}
        </div>

        {showTextForm && (
          <form className="create-channel-form" onSubmit={handleCreateText}>
            <input
              type="text"
              placeholder="Название текстового канала"
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              maxLength={30}
              autoFocus
            />
            <div className="form-buttons">
              <button type="submit" disabled={!newChannelName.trim()}>
                Создать
              </button>
              <button type="button" onClick={() => {
                setShowTextForm(false);
                setNewChannelName('');
              }}>
                Отмена
              </button>
            </div>
          </form>
        )}

        <div className="channels">
          {textChannels.map(channel => (
            <div key={channel.id} className="channel-item-wrapper">
              <div
                className={`channel-item ${currentTextChannel?.id === channel.id ? 'active' : ''}`}
                onClick={() => onSelectChannel(channel)}
              >
                <div className="channel-item-content">
                  <span className="channel-icon">#</span>
                  <span className="channel-name">{channel.name}</span>
                </div>
                {currentServer?.canManageChannels === true && (
                  <button
                    className="channel-settings-btn"
                    onClick={(e) => openChannelSettings(channel, e)}
                    title="Настройки канала"
                  >
                    <img
                      src="/icons/setting.png"
                      alt="Настройки"
                      className="channel-settings-icon"
                    />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="channels-section voice-section">
        <div className="section-header">
          <span>ГОЛОСОВЫЕ КАНАЛЫ</span>
          {currentServer?.canManageChannels === true ? (
            <button
              className="add-channel-btn"
              onClick={() => {
                setShowVoiceForm(!showVoiceForm);
                setShowTextForm(false);
                setNewChannelName('');
              }}
              title="Создать голосовой канал"
            >
              +
            </button>
          ) : (
            <div className="add-channel-btn-placeholder"></div>
          )}
        </div>

        {showVoiceForm && (
          <form className="create-channel-form" onSubmit={handleCreateVoice}>
            <input
              type="text"
              placeholder="Название голосового канала"
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              maxLength={30}
              autoFocus
            />
            <div className="form-buttons">
              <button type="submit" disabled={!newChannelName.trim()}>
                Создать
              </button>
              <button type="button" onClick={() => {
                setShowVoiceForm(false);
                setNewChannelName('');
              }}>
                Отмена
              </button>
            </div>
          </form>
        )}

        <div className="channels">
          {voiceChannels.map(channel => {
            const usersInChannel = voiceChannelUsers[channel.id] || [];
            const channelSpeaking = speakingUsers[channel.id] || new Set();
            const isCurrentInChannel = currentVoiceChannel?.id === channel.id;

            // Объединяем текущего пользователя с другими если он в этом канале
            const allUsers = isCurrentInChannel
              ? [{ id: 'me', username: user?.username, displayName: user?.displayName, avatar: user?.avatar, badge: user?.badge, badgeTooltip: user?.badgeTooltip, userId: user?.id, isMuted, isDeafened }, ...usersInChannel]
              : usersInChannel;

            return (
              <div key={channel.id} className="voice-channel-wrapper">
                <div className="channel-item-wrapper">
                  <div
                    className="channel-item"
                    onClick={() => onSelectChannel(channel)}
                  >
                    <div className="channel-item-content">
                      <img src="/icons/channel.png" alt="Голосовой канал" className="channel-icon-img" />
                      <span className="channel-name">{channel.name}</span>
                    </div>
                    {currentServer?.canManageChannels === true && (
                      <button
                        className="channel-settings-btn"
                        onClick={(e) => openChannelSettings(channel, e)}
                        title="Настройки канала"
                      >
                        <img
                          src="/icons/setting.png"
                          alt="Настройки"
                          className="channel-settings-icon"
                        />
                      </button>
                    )}
                  </div>
                </div>

                {allUsers.length > 0 && (
                  <div className="voice-users-in-sidebar">
                    {allUsers.map(user => {
                      const isSpeaking = user.id === 'me'
                        ? channelSpeaking.has('me')
                        : channelSpeaking.has(user.id);

                      // Проверяем, демонстрирует ли пользователь экран
                      const channelScreenSharing = screenSharingUsers[channel.id] || new Map();
                      const isUserScreenSharing = user.id === 'me'
                        ? isScreenSharing
                        : channelScreenSharing.has(user.userId || user.id);

                      return (
                        <div
                          key={user.id}
                          className="voice-user-sidebar"
                          onClick={(e) => handleVoiceUserClick(user, e)}
                          onContextMenu={(e) => handleVoiceUserContextMenu(user, e, channel)}
                          onMouseEnter={() => isInVoice && currentVoiceChannel?.id === channel.id && user.id !== 'me' && isUserScreenSharing && setHoveredScreenSharingUser(user)}
                          onMouseLeave={() => setHoveredScreenSharingUser(null)}
                        >
                          {user.avatar ? (
                            <img
                              src={`${BACKEND_URL}${user.avatar}`}
                              alt="Avatar"
                              className={`voice-user-avatar-tiny-img ${isSpeaking ? 'speaking' : ''}`}
                            />
                          ) : (
                            <div className={`voice-user-avatar-tiny ${isSpeaking ? 'speaking' : ''}`}>
                              {(user.displayName || user.username)[0].toUpperCase()}
                            </div>
                          )}
                          <div className="voice-user-info-tiny">
                            <div className="voice-user-name-row">
                              <span className="voice-user-name-tiny">{user.displayName || user.username}</span>
                              {isUserScreenSharing && (
                                <span className="voice-user-screen-sharing-indicator" title="Демонстрирует экран">
                                  В ЭФИРЕ
                                </span>
                              )}
                              {user.badge && user.badge !== 'User' && (
                                <span
                                  className="voice-user-badge"
                                  title={user.badgeTooltip || user.badge}
                                >
                                  {user.badge}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="voice-user-status-icons">
                            {user.isDeafened && (
                              <img src="/icons/headset_off.png" alt="Не слышит" className="status-icon" />
                            )}
                            {user.isMuted && (
                              <img src="/icons/microphone_off.png" alt="Микрофон выкл" className="status-icon mic-icon" />
                            )}
                          </div>
                          {/* Контекстное меню для стримящих пользователей - только если мы в том же канале что и стример, и это не мы сами */}
                          {isInVoice && currentVoiceChannel?.id === channel.id && user.id !== 'me' && hoveredScreenSharingUser && hoveredScreenSharingUser.id === user.id && (
                            <div className="voice-user-context-menu">
                              <button
                                className="context-menu-button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenStream({
                                    username: user.displayName || user.username,
                                    userId: user.userId || user.id,
                                    id: user.id
                                  });
                                }}
                              >
                                <img src="/cast_watch.png" alt="Стрим" className="context-menu-icon" />
                                Открыть стрим
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      </div>

      <UserProfile
        user={user}
        isMuted={isMuted}
        isDeafened={isDeafened}
        isInVoice={isInVoice}
        isSpeaking={currentVoiceChannel && speakingUsers[currentVoiceChannel.id]?.has('me')}
        isScreenSharing={isScreenSharing}
        onToggleMute={onToggleMute}
        onToggleDeafen={onToggleDeafen}
        onToggleScreenShare={onToggleScreenShare}
        onDisconnect={onDisconnect}
        onLogout={onLogout}
        onAvatarUpdate={onAvatarUpdate}
      />

      {selectedUser && (
        <>
          <div className="user-profile-overlay-voice" onClick={handleCloseProfile} />
          <div
            className="user-profile-card-voice"
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
            {selectedUser && (selectedUser.userId !== user.id && selectedUser.username !== user.username) && (
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

      {/* Модальное окно настроек канала */}
      <ChannelSettingsModal
        channel={selectedChannel}
        currentServer={currentServer}
        isOpen={showChannelSettings}
        onClose={closeChannelSettings}
        onUpdateChannel={onUpdateChannel}
        onDeleteChannel={onDeleteChannel}
      />

      {voiceVolumeMenu && (
        <div
          ref={volumeMenuRef}
          className="voice-volume-menu"
          style={{ top: `${voiceVolumeMenu.position.y}px`, left: `${voiceVolumeMenu.position.x}px` }}
          onMouseDown={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div className="voice-volume-header">
            <span className="voice-volume-title">
              {voiceVolumeMenu.username}
            </span>
            <button
              className="voice-volume-close"
              onClick={closeVoiceVolumeMenu}
              type="button"
              aria-label="Закрыть"
            >
              ×
            </button>
          </div>
          <div className="voice-volume-body">
            <div className="voice-volume-label">Громкость пользователя</div>
            <div className="voice-volume-slider-row">
              <input
                type="range"
                min="0"
                max="150"
                step="5"
                value={voiceVolumeMenu.volume}
                onChange={(e) => updateVoiceUserVolume(voiceVolumeMenu.accountId, e.target.value)}
                className="voice-volume-slider"
                style={{ '--volume-progress': voiceVolumeMenu.volume }}
              />
              <span className="voice-volume-value">{voiceVolumeMenu.volume}%</span>
            </div>
            <div className="voice-volume-hint">Настройка слышимости только для вас</div>
          </div>
      <button
        type="button"
        className="voice-volume-reset"
        onClick={() => handleResetVoiceVolume(voiceVolumeMenu.accountId)}
      >
        Сбросить до 100%
      </button>
    </div>
  )}

      {isServerSettingsOpen && currentServer && (
        <ServerSettingsModal
          server={currentServer}
          members={serverMembersList}
          currentUserId={user?.id}
          canBanMembers={Boolean(currentServer?.canBanMembers)}
          onBanMember={handleBanMember}
          banLoadingId={banLoadingId}
          banError={banError}
          onClose={handleServerSettingsClose}
        />
      )}

      {showInviteModal && createPortal(
        <div className="join-server-overlay" onClick={closeInviteModal}>
          <div className="join-server-modal" onClick={(e) => e.stopPropagation()}>
            <button className="join-server-close" onClick={closeInviteModal}>×</button>

            <h2>Пригласить на сервер</h2>
            <p className="modal-subtitle">
              Поделитесь ссылкой-приглашением, чтобы другие пользователи могли присоединиться к серверу
            </p>

            <div className="form-group">
              <label>Ссылка-приглашение</label>
              {inviteLoading ? (
                <div className="invite-loading-state">Создание ссылки...</div>
              ) : inviteLink ? (
                <>
                  <div className="invite-link-container">
                    <input
                      type="text"
                      value={`${window.location.origin}/invite/${inviteLink}`}
                      readOnly
                      className="invite-link-input"
                      onClick={(e) => e.target.select()}
                    />
                    <button
                      className={`copy-invite-btn ${copied ? 'copied' : ''}`}
                      onClick={handleCopyInvite}
                      title={copied ? 'Скопировано!' : 'Копировать'}
                      type="button"
                    >
                      {copied ? (
                        <span className="check-icon">✓</span>
                      ) : (
                        <img
                          src="/icons/copy.png"
                          alt="Копировать"
                          className="copy-icon"
                        />
                      )}
                    </button>
                  </div>
                  {copied && <div className="success-message">Ссылка скопирована в буфер обмена!</div>}
                </>
              ) : (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={loadOrCreateInvite}
                >
                  Создать ссылку-приглашение
                </button>
              )}
            </div>

            <div className="modal-footer invite-modal-footer">
              <button
                className="btn-secondary-gray"
                onClick={closeInviteModal}
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default ChannelList;
