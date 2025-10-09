export const CHANNEL_TYPES = {
  TEXT: 'text',
  VOICE: 'voice'
};

export const MESSAGE_MAX_LENGTH = 2000;

export const BACKEND_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : `${window.location.protocol}//${window.location.hostname}`;

