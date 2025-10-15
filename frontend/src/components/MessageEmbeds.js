import React, { useMemo, useEffect, useState } from 'react';
import './MessageEmbeds.css';
import parseYoutubeUrl from '../utils/youtube';

const IMAGE_REGEX = /\.(?:png|jpe?g|gif|webp)(?:\?.*)?$/i;
const URL_REGEX = /(https?:\/\/[^\s]+)/g;
const metadataCache = new Map();

const extractUrls = (content) => {
  if (!content || typeof content !== 'string') {
    return [];
  }

  const urls = new Set();
  let match = URL_REGEX.exec(content);
  while (match) {
    urls.add(match[1]);
    match = URL_REGEX.exec(content);
  }

  return Array.from(urls);
};

const buildEmbeds = (content) => {
  const urls = extractUrls(content);

  return urls
    .map((url) => {
      const youtube = parseYoutubeUrl(url);
      if (youtube) {
        return {
          type: 'youtube',
          url,
          videoId: youtube.videoId,
          embedUrl: youtube.embedUrl
        };
      }

      if (IMAGE_REGEX.test(url)) {
        return {
          type: 'image',
          url
        };
      }

      return null;
    })
    .filter(Boolean);
};

const MessageEmbeds = ({ content }) => {
  const embeds = useMemo(() => buildEmbeds(content), [content]);
  const [metadata, setMetadata] = useState({});
  const [embedErrors, setEmbedErrors] = useState(new Set());

  useEffect(() => {
    let isMounted = true;
    const youtubeEmbeds = embeds.filter(embed => embed.type === 'youtube');

    if (youtubeEmbeds.length === 0) {
      setMetadata({});
      return undefined;
    }

    const updateMetadata = (videoId, data) => {
      setMetadata(prev => {
        if (prev[videoId] && prev[videoId].title === data.title) {
          return prev;
        }
        return { ...prev, [videoId]: data };
      });
    };

    youtubeEmbeds.forEach(({ videoId, url }) => {
      if (metadataCache.has(videoId)) {
        updateMetadata(videoId, metadataCache.get(videoId));
        return;
      }

      // Добавляем обработку ошибок для YouTube API
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 секунд таймаут

      fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`, {
        signal: controller.signal,
        mode: 'cors',
        credentials: 'omit'
      })
        .then((response) => {
          clearTimeout(timeoutId);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          return response.json();
        })
        .then((data) => {
          if (!isMounted) return;
          const normalized = {
            title: data.title,
            authorName: data.author_name,
            authorUrl: data.author_url
          };
          metadataCache.set(videoId, normalized);
          updateMetadata(videoId, normalized);
          // Убираем ошибку если она была
          setEmbedErrors(prev => {
            const newSet = new Set(prev);
            newSet.delete(videoId);
            return newSet;
          });
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          if (!isMounted) return;
          
          console.warn(`Не удалось загрузить метаданные YouTube для видео ${videoId}:`, error.message);
          
          const fallback = {
            title: 'Видео на YouTube',
            authorName: null,
            authorUrl: null
          };
          metadataCache.set(videoId, fallback);
          updateMetadata(videoId, fallback);
          
          // Добавляем ошибку в список
          setEmbedErrors(prev => new Set(prev).add(videoId));
        });
    });

    return () => {
      isMounted = false;
    };
  }, [embeds]);

  if (!embeds || embeds.length === 0) {
    return null;
  }

  return (
    <div className="message-embeds">
      {embeds.map((embed, index) => {
        if (embed.type === 'youtube') {
          const info = metadata[embed.videoId] || metadataCache.get(embed.videoId);
          const title = info?.title || 'Видео на YouTube';
          const hasError = embedErrors.has(embed.videoId);

          return (
            <div
              key={`${embed.type}-${embed.videoId}-${index}`}
              className="embed-card embed-card-youtube"
            >
              <div className="embed-card-thumbnail">
                <iframe
                  src={embed.embedUrl}
                  title={`YouTube video player: ${title}`}
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  onError={(e) => {
                    console.warn('Ошибка загрузки YouTube iframe:', e);
                    // Можно добавить fallback изображение
                  }}
                  onLoad={() => {
                    // Убираем ошибку при успешной загрузке
                    if (hasError) {
                      setEmbedErrors(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(embed.videoId);
                        return newSet;
                      });
                    }
                  }}
                />
                <span className="embed-card-badge">YouTube</span>
                {hasError && (
                  <div className="embed-error-indicator" title="Возможны проблемы с загрузкой">
                    ⚠️
                  </div>
                )}
              </div>
              <div className="embed-card-body">
                <a
                  className="embed-card-title"
                  href={embed.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {title}
                </a>
                {info?.authorName && (
                  info.authorUrl ? (
                    <a
                      className="embed-card-subtitle"
                      href={info.authorUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {info.authorName}
                    </a>
                  ) : (
                    <div className="embed-card-subtitle">{info.authorName}</div>
                  )
                )}
                {hasError && (
                  <div className="embed-error-message">
                    Возможны проблемы с загрузкой. Попробуйте открыть видео напрямую.
                  </div>
                )}
              </div>
            </div>
          );
        }

        if (embed.type === 'image') {
          return (
            <a
              key={`${embed.type}-${embed.url}-${index}`}
              href={embed.url}
              className="embed-card embed-card-image"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img src={embed.url} alt="Вложенное изображение" loading="lazy" />
            </a>
          );
        }

        return null;
      })}
    </div>
  );
};

export default MessageEmbeds;
