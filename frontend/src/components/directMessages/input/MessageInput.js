import React from 'react';
import FileUpload from './FileUpload';
import ReplyBanner from './ReplyBanner';

/**
 * Компонент поля ввода сообщений в DirectMessages
 */
const MessageInput = ({
  inputValue,
  setInputValue,
  selectedFiles,
  setSelectedFiles,
  replyingTo,
  setReplyingTo,
  onSendMessage,
  onReplyNavigation,
  onFileSelect,
  removeFile,
  openFileDialog,
  inputRef,
  sendingMessage,
  isConversationBlocked,
  messagePlaceholder,
  BACKEND_URL
}) => {
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

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const cancelReply = () => {
    setReplyingTo(null);
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus({ preventScroll: true });
      }
    }, 50);
  };

  const resolvedReplyTarget = replyingTo;

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
        <input
          id="dm-file-input"
          type="file"
          accept="image/*"
          multiple
          onChange={onFileSelect}
          style={{ display: 'none' }}
        />
        <div className="message-input-wrapper">
          <div className="message-input-field">
            <button
              type="button"
              className="file-attach-button"
              onClick={openFileDialog}
              disabled={isConversationBlocked}
              title="Прикрепить файл"
            >
              <img src="/icons/plus.png" alt="+" />
            </button>
            <div className="input-divider"></div>
            <input
              ref={inputRef}
              type="text"
              placeholder={messagePlaceholder}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              maxLength={2000}
              disabled={sendingMessage || isConversationBlocked}
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
