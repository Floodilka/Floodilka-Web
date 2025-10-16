import React from 'react';

/**
 * Скелетон сообщения в личных сообщениях с резервированием места для изображений
 */
const DMMessageSkeleton = ({ messageData = null }) => {
  const hasImages = messageData?.hasImages || false;
  const imageCount = messageData?.imageCount || 0;
  const attachments = messageData?.attachments || [];

  return (
    <div className="dm-skeleton-message">
      <div className="dm-skeleton-avatar" />
      <div className="dm-skeleton-content">
        <div className="dm-skeleton-header">
          <div className="dm-skeleton-username" />
          <div className="dm-skeleton-timestamp" />
        </div>
        <div className="dm-skeleton-text" />
        <div className="dm-skeleton-text short" />

        {/* Резервируем место для изображений точно как в реальных сообщениях */}
        {hasImages && (
          <div className="dm-skeleton-attachments">
            {attachments.length > 0 ? (
              attachments.map((attachment, i) => (
                <div
                  key={i}
                  className="dm-skeleton-attachment-image"
                  style={{
                    width: '200px',
                    height: '150px',
                    maxWidth: '400px',
                    maxHeight: '300px'
                  }}
                />
              ))
            ) : (
              Array.from({ length: imageCount }, (_, index) => (
                <div key={index} className="dm-skeleton-attachment-image" />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DMMessageSkeleton;
