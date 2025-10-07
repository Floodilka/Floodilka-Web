import React, { useState, useEffect } from 'react';
import './ChannelList.css';
import UserProfile from './UserProfile';
import ChannelSettingsModal from './ChannelSettingsModal';

const BACKEND_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : `${window.location.protocol}//${window.location.hostname}`;

function ChannelList({ channels, currentTextChannel, currentVoiceChannel, voiceChannelUsers, speakingUsers, user, isMuted, isDeafened, isInVoice, serverName, currentServer, onToggleMute, onToggleDeafen, onDisconnect, onLogout, onAvatarUpdate, onSelectChannel, onCreateChannel, onUpdateChannel, onDeleteChannel, onMessageSent }) {
  const [showTextForm, setShowTextForm] = useState(false);
  const [showVoiceForm, setShowVoiceForm] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [showServerMenu, setShowServerMenu] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [profilePosition, setProfilePosition] = useState({ top: 0, left: 0 });
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  // Состояния для управления каналами
  const [showChannelSettings, setShowChannelSettings] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState(null);

  const handleVoiceUserClick = async (voiceUser, event) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    setProfilePosition({
      top: rect.top,
      left: rect.right + 8
    });

    // Если есть userId, загрузить актуальные данные пользователя
    if (voiceUser.userId) {
      try {
        const response = await fetch(`${BACKEND_URL}/api/auth/user/${voiceUser.userId}`);
        if (response.ok) {
          const userData = await response.json();
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

  const handleSendDirectMessage = async () => {
    if (!messageText.trim() || !selectedUser || sendingMessage) return;

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


  const [menuClosing, setMenuClosing] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Сбрасываем инвайт при смене сервера
  useEffect(() => {
    setInviteLink('');
    setShowServerMenu(false);
    setMenuClosing(false);
  }, [currentServer?._id]);

  const loadOrCreateInvite = async () => {
    if (!currentServer) return;

    setInviteLoading(true);
    try {
      const token = localStorage.getItem('token');

      // Сначала попробуем загрузить существующие инвайты
      const getResponse = await fetch(`${BACKEND_URL}/api/servers/${currentServer._id}/invites`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
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
          setInviteLoading(false);
          return;
        }
      }

      // Если нет валидных инвайтов, создаём новый
      console.log('➕ Создаём новый инвайт');
      const createResponse = await fetch(`${BACKEND_URL}/api/servers/${currentServer._id}/invites`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });

      const data = await createResponse.json();
      if (createResponse.ok) {
        console.log('✅ Создан новый инвайт:', data.code);
        setInviteLink(data.code);
      }
    } catch (err) {
      console.error('❌ Ошибка загрузки инвайта:', err);
    } finally {
      setInviteLoading(false);
    }
  };

  const handleCopyInvite = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const toggleServerMenu = () => {
    if (showServerMenu) {
      // Закрытие с анимацией - убираем класс open сразу
      setMenuClosing(true);
      // Но меню остается в DOM до конца анимации
      setTimeout(() => {
        setShowServerMenu(false);
        setMenuClosing(false);
      }, 200); // Длительность анимации
    } else {
      // Открытие - загружаем или создаём инвайт
      if (!inviteLink) {
        loadOrCreateInvite();
      }
      setShowServerMenu(true);
      setMenuClosing(false);
    }
  };

  const closeServerMenu = () => {
    setMenuClosing(true);
    setTimeout(() => {
      setShowServerMenu(false);
      setMenuClosing(false);
    }, 200);
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
          <button
            className={`server-menu-btn ${showServerMenu && !menuClosing ? 'open' : ''}`}
            onClick={toggleServerMenu}
            title="Меню сервера"
          >
            <img
              src="/icons/arrow_down.png"
              alt="Меню"
              className="arrow-icon"
            />
          </button>
        )}
      </div>

      {showServerMenu && (
        <>
          <div
            className="server-menu-overlay"
            onClick={closeServerMenu}
          />
          <div className={`server-dropdown-menu ${menuClosing ? 'closing' : ''}`}>
            <div className="invite-section">
              <div className="invite-label">Пригласить людей</div>
              {inviteLoading ? (
                <div className="invite-loading">Создание ссылки...</div>
              ) : inviteLink ? (
                <div className="invite-code-box">
                  <input
                    type="text"
                    value={inviteLink}
                    readOnly
                    className="invite-input"
                    onClick={(e) => e.target.select()}
                  />
                  <button
                    className={`copy-invite-btn ${copied ? 'copied' : ''}`}
                    onClick={handleCopyInvite}
                    title={copied ? "Скопировано!" : "Копировать"}
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
              ) : null}
            </div>
          </div>
        </>
      )}

      <div className="channels-container">
        <div className="channels-section">
        <div className="section-header">
          <span>ТЕКСТОВЫЕ КАНАЛЫ</span>
          {currentServer?.canManageChannels === true && (
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
          {currentServer?.canManageChannels === true && (
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
                      return (
                        <div
                          key={user.id}
                          className="voice-user-sidebar"
                          onClick={(e) => handleVoiceUserClick(user, e)}
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
        onToggleMute={onToggleMute}
        onToggleDeafen={onToggleDeafen}
        onDisconnect={onDisconnect}
        onLogout={onLogout}
        onAvatarUpdate={onAvatarUpdate}
      />

      {selectedUser && (
        <>
          <div className="user-profile-overlay" onClick={handleCloseProfile} />
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
    </div>
  );
}

export default ChannelList;

