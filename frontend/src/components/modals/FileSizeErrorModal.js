import React from 'react';

/**
 * Модальное окно ошибки размера файла
 */
const FileSizeErrorModal = ({ isOpen, onClose }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <>
      <div className="file-error-overlay" onClick={onClose} />
      <div className="file-error-modal">
        <button className="file-error-close" onClick={onClose}>
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
  );
};

export default FileSizeErrorModal;
