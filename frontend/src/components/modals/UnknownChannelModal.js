import React from 'react';

/**
 * Модальное окно для недоступного канала
 */
const UnknownChannelModal = ({ isOpen, onClose }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="join-server-overlay" onClick={onClose}>
      <div className="join-server-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Канал недоступен</h2>
        <p className="modal-subtitle">
          Этот канал удален или у вас нет к нему доступа
        </p>
        <div className="modal-footer">
          <button className="btn-primary" onClick={onClose}>
            Понятно
          </button>
        </div>
      </div>
    </div>
  );
};

export default UnknownChannelModal;
