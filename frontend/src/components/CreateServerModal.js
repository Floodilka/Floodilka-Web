import React, { useState, useRef } from 'react';
import './CreateServerModal.css';

function CreateServerModal({ onClose, onCreate }) {
  const [serverName, setServerName] = useState('');
  const [serverIcon, setServerIcon] = useState('');
  const [uploadedImage, setUploadedImage] = useState(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const emojis = ['🎮', '🎵', '🎨', '💬', '🚀', '⚡', '🔥', '💎', '🌟', '🎯'];

  const resizeImage = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_SIZE = 256; // Максимальный размер иконки

          let width = img.width;
          let height = img.height;

          // Масштабируем, сохраняя пропорции
          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Конвертируем в base64 с качеством 0.8
          const resizedImage = canvas.toDataURL('image/jpeg', 0.8);
          resolve(resizedImage);
        };
        img.onerror = reject;
        img.src = event.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      // Проверка типа файла
      if (!file.type.startsWith('image/')) {
        setError('Пожалуйста, выберите изображение');
        return;
      }

      // Проверка размера (10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError('Изображение слишком большое (макс. 10MB)');
        return;
      }

      try {
        const resizedImage = await resizeImage(file);
        setUploadedImage(resizedImage);
        setServerIcon(''); // Очистить выбранный эмодзи
        setError('');
      } catch (err) {
        setError('Ошибка обработки изображения');
        console.error('Resize error:', err);
      }
    }
  };

  const handlePlaceholderClick = () => {
    fileInputRef.current?.click();
  };

  const handleCreate = () => {
    if (!serverName.trim()) {
      setError('Введите название сервера');
      return;
    }

    if (serverName.length > 50) {
      setError('Название слишком длинное (макс. 50 символов)');
      return;
    }

    onCreate({
      name: serverName.trim(),
      icon: uploadedImage || serverIcon
    });
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleCreate();
    }
  };

  return (
    <div className="create-server-overlay" onClick={onClose}>
      <div className="create-server-modal" onClick={(e) => e.stopPropagation()}>
        <button className="create-server-close" onClick={onClose}>×</button>

        <h2>Персонализируйте свой сервер</h2>
        <p className="modal-subtitle">
          Персонализируйте свой новый сервер, выбрав ему название и значок.
          Их можно будет изменить в любой момент.
        </p>

        <div className="server-icon-upload">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            style={{ display: 'none' }}
          />
          {uploadedImage ? (
            <div className="server-icon-preview uploaded" onClick={handlePlaceholderClick}>
              <img src={uploadedImage} alt="Server icon" />
            </div>
          ) : serverIcon ? (
            <div className="server-icon-preview" onClick={handlePlaceholderClick}>
              {serverIcon}
            </div>
          ) : (
            <div className="server-icon-placeholder" onClick={handlePlaceholderClick}>
              <img src="/icons/photo.png" alt="Upload" className="upload-icon" />
            </div>
          )}
        </div>

        <div className="server-emoji-picker">
          {emojis.map((emoji, index) => (
            <button
              key={index}
              className={`server-emoji-button ${serverIcon === emoji ? 'selected' : ''}`}
              onClick={() => {
                setServerIcon(emoji);
                setUploadedImage(null); // Очистить загруженное изображение
              }}
            >
              {emoji}
            </button>
          ))}
        </div>

        <div className="form-group">
          <label>
            Название сервера <span className="required">*</span>
          </label>
          <input
            type="text"
            placeholder="Введите название сервера"
            value={serverName}
            onChange={(e) => {
              setServerName(e.target.value);
              setError('');
            }}
            onKeyPress={handleKeyPress}
            maxLength={50}
            autoFocus
          />
          {error && <div className="error-message">{error}</div>}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Назад
          </button>
          <button className="btn-primary" onClick={handleCreate}>
            Создать
          </button>
        </div>
      </div>
    </div>
  );
}

export default CreateServerModal;

