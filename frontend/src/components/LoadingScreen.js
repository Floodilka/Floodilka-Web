import React, { useState, useEffect } from 'react';
import './LoadingScreen.css';

const loadingMessages = [
  'Загрузка...',
  'Подключение к серверам...',
  'Синхронизация данных...',
  'Почти готово...'
];

const LoadingScreen = () => {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % loadingMessages.length);
    }, 1500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="loading-screen">
      <div className="loading-content">
        <div className="loading-spinner-container">
          <div className="loading-spinner">
            <div className="spinner"></div>
            <div className="spinner-logo">
              <img src="/icons/logo_nobg.png" alt="Floodilka" />
            </div>
          </div>
        </div>
        <div className="loading-text" key={messageIndex}>
          {loadingMessages[messageIndex]}
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;

