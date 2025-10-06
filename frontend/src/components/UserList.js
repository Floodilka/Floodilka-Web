import React from 'react';
import './UserList.css';

function UserList({ users }) {
  return (
    <div className="user-list">
      <div className="user-list-header">
        <span>ОНЛАЙН — {users.length}</span>
      </div>
      <div className="users">
        {users.map((user, index) => (
          <div key={index} className="user-item">
            <div className="user-avatar">
              {user[0].toUpperCase()}
            </div>
            <div className="user-info">
              <div className="user-name">{user}</div>
              <div className="user-status">
                <span className="status-indicator online"></span>
                <span className="status-text">В сети</span>
              </div>
            </div>
          </div>
        ))}
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

