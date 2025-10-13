import React, { useState, useRef, useEffect, memo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import './ServerSidebar.css';
import CreateServerModal from './CreateServerModal';

const BACKEND_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : `${window.location.protocol}//${window.location.hostname}`;

const ServerSidebar = memo(function ServerSidebar({ servers, currentServer, onSelectServer, onCreateServer, user, onSelectDirectMessages, showDirectMessages, hasUnreadDMs, activeVoiceChannel }) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [joinError, setJoinError] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 84 });
  const [indicatorPosition, setIndicatorPosition] = useState(0);
  const [showIndicator, setShowIndicator] = useState(false);
  const [hoveredServer, setHoveredServer] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const addButtonRef = useRef(null);
  const serverRefs = useRef({});

  const handleMenuToggle = useCallback(() => {
    if (!showActionMenu && addButtonRef.current) {
      const rect = addButtonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.top,
        left: rect.right + 8
      });
    }
    setShowActionMenu(!showActionMenu);
  }, [showActionMenu]);

  const handleServerHover = useCallback((server, event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltipPosition({
      top: rect.top + rect.height / 2,
      left: rect.right + 8
    });
    setHoveredServer(server);
  }, []);

  const handleServerLeave = useCallback(() => {
    setHoveredServer(null);
  }, []);

  // Обновление позиции индикатора при смене сервера или DM
  useEffect(() => {
    // Используем requestAnimationFrame для плавной анимации
    requestAnimationFrame(() => {
      if (showDirectMessages && serverRefs.current['dm-icon']) {
        // Показываем индикатор для DM
        const element = serverRefs.current['dm-icon'];
        const rect = element.getBoundingClientRect();
        const sidebar = element.closest('.server-list');
        if (sidebar) {
          const sidebarRect = sidebar.getBoundingClientRect();
          const relativeTop = rect.top - sidebarRect.top + rect.height / 2;
          setIndicatorPosition(relativeTop);
          setShowIndicator(true);
        }
      } else if (currentServer && serverRefs.current[currentServer._id]) {
        // Показываем индикатор для сервера
        const element = serverRefs.current[currentServer._id];
        const rect = element.getBoundingClientRect();
        const sidebar = element.closest('.server-list');
        if (sidebar) {
          const sidebarRect = sidebar.getBoundingClientRect();
          const relativeTop = rect.top - sidebarRect.top + rect.height / 2;
          setIndicatorPosition(relativeTop);
          setShowIndicator(true);
        }
      }
    });
  }, [currentServer, servers, showDirectMessages]);

  const handleCreateServer = (serverData) => {
    onCreateServer(serverData);
    setShowCreateModal(false);
    setShowActionMenu(false);
  };

  const extractInviteCode = (input) => {
    const match = input.match(/(?:invite\/)?([a-f0-9]+)$/i);
    return match ? match[1] : input.trim();
  };

  const handleJoinByLink = async () => {
    if (!inviteLink.trim()) return;

    setJoinLoading(true);
    setJoinError('');

    try {
      const code = extractInviteCode(inviteLink);
      const token = localStorage.getItem('token');

      const response = await fetch(`${BACKEND_URL}/api/servers/join/${code}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (response.ok) {
        window.location.reload();
      } else {
        setJoinError(data.error || 'Не удалось присоединиться к серверу');
      }
    } catch (err) {
      console.error('Ошибка присоединения:', err);
      setJoinError('Ошибка подключения к серверу');
    } finally {
      setJoinLoading(false);
    }
  };

  return (
    <div className="server-sidebar">
      <div className="server-list">
        {showIndicator && (
          <div
            className="server-indicator"
            style={{ top: `${indicatorPosition}px` }}
          />
        )}

        {/* Иконка личных сообщений */}
        <div
          ref={(el) => { if (el) serverRefs.current['dm-icon'] = el; }}
          className={`server-icon dm-icon ${showDirectMessages ? 'active' : ''}`}
          onClick={onSelectDirectMessages}
          title="Личные сообщения"
        >
          <img src="/icons/chat.png" alt="Личные сообщения" className="dm-icon-image" />
          {hasUnreadDMs && <div className="dm-notification-dot" title="У вас есть непрочитанные сообщения или заявки в друзья"></div>}
        </div>

        {servers && Array.isArray(servers) && servers.map(server => {
          // Проверяем, что сервер существует и имеет необходимые поля
          if (!server || !server._id) {
            return null;
          }

          const isBase64Image = server.icon && server.icon.startsWith('data:image');
          const serverName = server.name || 'Без названия';

          return (
            <div
              key={server._id}
              ref={el => serverRefs.current[server._id] = el}
              className={`server-icon ${currentServer?._id === server._id ? 'active' : ''}`}
              onClick={() => onSelectServer(server)}
              onMouseEnter={(e) => handleServerHover(server, e)}
              onMouseLeave={handleServerLeave}
            >
              {isBase64Image ? (
                <img
                  src={server.icon}
                  alt={serverName}
                  className="server-icon-image"
                />
              ) : server.icon ? (
                <span className="server-icon-emoji">{server.icon}</span>
              ) : (
                <span className="server-icon-text">
                  {serverName.substring(0, 2).toUpperCase()}
                </span>
              )}

              {/* Зеленый индикатор с иконкой канала для сервера с активным голосовым каналом */}
              {(() => {
                const shouldShow = activeVoiceChannel &&
                  activeVoiceChannel.serverId &&
                  server._id &&
                  activeVoiceChannel.serverId.toString() === server._id.toString();
                return shouldShow && (
                  <div className="server-active-indicator">
                    <img src="/icons/channel.png" alt="В голосовом канале" className="server-indicator-icon" />
                  </div>
                );
              })()}
            </div>
          );
        })}

        <div
          ref={addButtonRef}
          className="server-icon add-server"
          onClick={handleMenuToggle}
          title="Добавить сервер"
        >
          +
        </div>
      </div>

      {showActionMenu && createPortal(
        <>
          <div
            className="menu-overlay"
            onClick={() => setShowActionMenu(false)}
          />
          <div
            className="server-action-menu"
            style={{
              top: `${menuPosition.top}px`,
              left: `${menuPosition.left}px`
            }}
          >
            <button
              className="action-menu-item"
              onClick={() => {
                setShowCreateModal(true);
                setShowActionMenu(false);
              }}
            >
              <span className="action-menu-icon">
                <img src="/icons/plus.png" alt="Создать" width="16" height="16" />
              </span>
              <span className="action-menu-text">Создать сервер</span>
            </button>
            <button
              className="action-menu-item"
              onClick={() => {
                setShowJoinModal(true);
                setShowActionMenu(false);
              }}
            >
              <span className="action-menu-icon">
                <img src="/icons/link.png" alt="Присоединиться" width="16" height="16" />
              </span>
              <span className="action-menu-text">Присоединиться</span>
            </button>
          </div>
        </>,
        document.body
      )}

      {showCreateModal && createPortal(
        <CreateServerModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateServer}
        />,
        document.body
      )}

      {showJoinModal && createPortal(
        <div className="join-server-overlay" onClick={() => setShowJoinModal(false)}>
          <div className="join-server-modal" onClick={(e) => e.stopPropagation()}>
            <button className="join-server-close" onClick={() => setShowJoinModal(false)}>×</button>

            <h2>Присоединиться к серверу</h2>
            <p className="modal-subtitle">
              Введите ссылку-приглашение для присоединения к существующему серверу
            </p>

            <div className="form-group">
              <label>Ссылка-приглашение</label>
              <input
                type="text"
                placeholder="https://floodilka.com/invite/abc123 или abc123"
                value={inviteLink}
                onChange={(e) => {
                  setInviteLink(e.target.value);
                  setJoinError('');
                }}
                onKeyPress={(e) => e.key === 'Enter' && !joinLoading && handleJoinByLink()}
                autoFocus
                disabled={joinLoading}
              />
              {joinError && <div className="error-message">{joinError}</div>}
            </div>

            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => {
                  setShowJoinModal(false);
                  setInviteLink('');
                  setJoinError('');
                }}
                disabled={joinLoading}
              >
                Отмена
              </button>
              <button
                className="btn-primary"
                onClick={handleJoinByLink}
                disabled={!inviteLink.trim() || joinLoading}
              >
                {joinLoading ? 'Подключение...' : 'Присоединиться'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {hoveredServer && (
        <div
          className="server-tooltip"
          style={{
            top: `${tooltipPosition.top}px`,
            left: `${tooltipPosition.left}px`
          }}
        >
          {hoveredServer.name || 'Без названия'}
        </div>
      )}

    </div>
  );
});

export default ServerSidebar;

