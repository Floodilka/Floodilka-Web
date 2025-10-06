import React from 'react';
import './UserList.css';

const BACKEND_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : `${window.location.protocol}//${window.location.hostname}`;

function UserList({ users }) {
  return (
    <div className="user-list">
      <div className="user-list-header">
        <span>ОНЛАЙН — {users.length}</span>
      </div>
      <div className="users">
        {users.map((user, index) => {
          const isUserObject = typeof user === 'object' && user !== null;
          const username = isUserObject ? user.username : user;
          const avatar = isUserObject ? user.avatar : null;

          return (
            <div key={index} className="user-item">
              {avatar ? (
                <img
                  src={`${BACKEND_URL}${avatar}`}
                  alt="Avatar"
                  className="user-avatar-img"
                />
              ) : (
                <div className="user-avatar">
                  {username[0].toUpperCase()}
                </div>
              )}
              <div className="user-info">
                <div className="user-name">{username}</div>
                <div className="user-status">
                  <span className="status-indicator online"></span>
                  <span className="status-text">В сети</span>
                </div>
              </div>
            </div>
          );
        })}
        {users.length === 0 && (
          <div className="no-users">
            Пока никого нет
          </div>
        )}
      </div>
    </div>
  );
}

export default UserList;

