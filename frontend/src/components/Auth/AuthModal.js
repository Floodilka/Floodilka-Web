import React, { useState } from 'react';
import './AuthModal.css';
import Login from './Login';
import Register from './Register';

function AuthModal() {
  const [mode, setMode] = useState('login'); // 'login' или 'register'

  return (
    <div className="auth-modal-overlay">
      <div className="auth-modal-content">
        <div className="auth-header">
          <h1>Добро пожаловать в Болтушку!</h1>
          <p>Войдите или создайте аккаунт для продолжения</p>
        </div>

        <div className="auth-form-container">
          {mode === 'login' ? (
            <Login onSwitchToRegister={() => setMode('register')} />
          ) : (
            <Register onSwitchToLogin={() => setMode('login')} />
          )}
        </div>
      </div>
    </div>
  );
}

export default AuthModal;

