import React, { useState } from 'react';
import './UsernameModal.css';

function UsernameModal({ onSubmit }) {
  const [name, setName] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (trimmedName) {
      onSubmit(trimmedName);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h1>👋 Добро пожаловать в Болтушку!</h1>
        <p>Введите ваше имя, чтобы начать общение</p>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Ваше имя..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            autoFocus
          />
          <button type="submit" disabled={!name.trim()}>
            Войти в чат
          </button>
        </form>
      </div>
    </div>
  );
}

export default UsernameModal;

