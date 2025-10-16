import React from 'react';

/**
 * Компонент превью загружаемых файлов
 */
const FileUpload = ({ selectedFiles, onRemoveFile }) => {
  return (
    <div className="file-preview-container">
      {selectedFiles.map((file, index) => (
        <div key={index} className="file-preview">
          <img
            src={URL.createObjectURL(file)}
            alt={file.name}
            className="file-preview-image"
          />
          <div className="file-preview-info">
            <span className="file-preview-name">{file.name}</span>
            <span className="file-preview-size">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
          </div>
          <button
            type="button"
            className="file-preview-remove"
            onClick={() => onRemoveFile(index)}
            title="Удалить файл"
          >
            <img src="/icons/trash.png" alt="Удалить" />
          </button>
        </div>
      ))}
    </div>
  );
};

export default FileUpload;
