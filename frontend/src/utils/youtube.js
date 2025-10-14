const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtu.be'
]);

const normalizeYoutubeTime = (raw) => {
  if (!raw) {
    return 0;
  }

  if (/^\d+$/.test(raw)) {
    return Number(raw);
  }

  const match = /^((\d+)h)?((\d+)m)?((\d+)s?)?$/i.exec(raw);
  if (!match) {
    return 0;
  }

  const hours = Number(match[2] || 0);
  const minutes = Number(match[4] || 0);
  const seconds = Number(match[6] || 0);
  return hours * 3600 + minutes * 60 + seconds;
};

export const parseYoutubeUrl = (href) => {
  if (!href || typeof href !== 'string') {
    return null;
  }

  let url;
  try {
    url = new URL(href);
  } catch (error) {
    return null;
  }

  const host = url.hostname.toLowerCase();
  if (!YOUTUBE_HOSTS.has(host)) {
    return null;
  }

  let videoId = '';

  if (host === 'youtu.be' || host === 'www.youtu.be') {
    const pathParts = url.pathname.split('/').filter(Boolean);
    if (pathParts.length > 0) {
      [videoId] = pathParts;
    }
  } else if (url.pathname === '/watch' || url.pathname.startsWith('/watch')) {
    videoId = url.searchParams.get('v') || '';
  } else if (url.pathname.startsWith('/embed/')) {
    videoId = url.pathname.split('/')[2] || '';
  } else if (url.pathname.startsWith('/shorts/')) {
    videoId = url.pathname.split('/')[2] || '';
  }

  const safeId = videoId.trim();
  if (!/^[\w-]{11}$/.test(safeId)) {
    return null;
  }

  const params = new URLSearchParams();
  params.set('rel', '0');

  const start = normalizeYoutubeTime(url.searchParams.get('start') || url.searchParams.get('t'));
  const list = url.searchParams.get('list');

  if (start > 0) {
    params.set('start', String(start));
  }

  if (list) {
    params.set('list', list);
  }

  const query = params.toString();
  const embedUrl = `https://www.youtube.com/embed/${encodeURIComponent(safeId)}${query ? `?${query}` : ''}`;

  return {
    videoId: safeId,
    embedUrl
  };
};

export default parseYoutubeUrl;
