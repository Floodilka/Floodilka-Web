import React from 'react';
import FileUpload from './FileUpload';
import ReplyBanner from './ReplyBanner';

const BACKEND_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : `${window.location.protocol}//${window.location.hostname}`;

/**
 * Компонент поля ввода сообщений
 */
const MessageInput = ({
  channel,
  inputValue,
  setInputValue,
  selectedFiles,
  setSelectedFiles,
  replyingTo,
  setReplyingTo,
  onSendMessage,
  onReplyNavigation,
  onInputChange,
  onInputKeyDown,
  onFileSelect,
  removeFile,
  openFileDialog,
  messageInputFieldRef,
  inputRef,
  sendingMessage
}) => {
  const resolvedReplyTarget = replyingTo;

  const handleSubmit = (e) => {
    e.preventDefault();

    const trimmedValue = inputValue.trim();
    if (trimmedValue || selectedFiles.length > 0) {
      onSendMessage(trimmedValue, selectedFiles, replyingTo);
      setInputValue('');
      setSelectedFiles([]);
      setReplyingTo(null);

      if (inputRef.current) {
        inputRef.current.focus({ preventScroll: true });
      }
    }
  };

  const cancelReply = () => setReplyingTo(null);

  return (
    <div className="message-input-container">
      {/* Превью выбранных файлов */}
      {selectedFiles.length > 0 && (
        <FileUpload
          selectedFiles={selectedFiles}
          onRemoveFile={removeFile}
        />
      )}

      {/* Баннер ответа */}
      {resolvedReplyTarget && (
        <ReplyBanner
          replyTarget={resolvedReplyTarget}
          onNavigate={onReplyNavigation}
          onCancel={cancelReply}
        />
      )}

      <form onSubmit={handleSubmit}>
        <div className="message-input-wrapper">
          <input
            id="file-input"
            type="file"
            accept="image/*"
            multiple
            onChange={onFileSelect}
            style={{ display: 'none' }}
          />
          <div className="message-input-field" ref={messageInputFieldRef}>
            <button
              type="button"
              className="file-attach-button"
              onClick={openFileDialog}
              title="Прикрепить файл"
            >
              <img src="/icons/plus.png" alt="+" />
            </button>
            <div className="input-divider"></div>
            <input
              ref={inputRef}
              type="text"
              placeholder={`Написать в #${channel.name}`}
              value={inputValue}
              onChange={(e) => onInputChange(e, messageInputFieldRef)}
              onKeyDown={(e) => onInputKeyDown(e, inputValue, setInputValue)}
              maxLength={2000}
            />
            <div className="input-divider"></div>
            <button
              type="submit"
              className={`file-send-button ${(!inputValue.trim() && selectedFiles.length === 0) ? 'disabled' : 'active'}`}
              disabled={!inputValue.trim() && selectedFiles.length === 0}
              title="Отправить"
            >
              <img src="/icons/send.png" alt="Отправить" />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default MessageInput;
