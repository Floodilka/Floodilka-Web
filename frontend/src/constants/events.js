// WebSocket события
export const SOCKET_EVENTS = {
  // Connection
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',
  ERROR: 'error',

  // Server events
  SERVER_JOIN: 'server:join',
  SERVER_LEAVE: 'server:leave',
  SERVER_USERS_UPDATE: 'server:users-update',

  // Channel events
  CHANNEL_JOIN: 'channel:join',
  CHANNEL_CREATED: 'channel:created',

  // Message events
  MESSAGE_SEND: 'message:send',
  MESSAGE_NEW: 'message:new',
  MESSAGE_EDIT: 'message:edit',
  MESSAGE_EDITED: 'message:edited',
  MESSAGE_DELETE: 'message:delete',
  MESSAGE_DELETED: 'message:deleted',
  MESSAGES_HISTORY: 'messages:history',

  // User events
  USERS_UPDATE: 'users:update',

  // Voice events
  VOICE_JOIN: 'voice:join',
  VOICE_LEAVE: 'voice:leave',
  VOICE_USERS: 'voice:users',
  VOICE_USER_JOINED: 'voice:user-joined',
  VOICE_USER_LEFT: 'voice:user-left',
  VOICE_USER_MUTED: 'voice:user-muted',
  VOICE_USER_DEAFENED: 'voice:user-deafened',
  VOICE_MUTE_TOGGLE: 'voice:mute-toggle',
  VOICE_DEAFEN_TOGGLE: 'voice:deafen-toggle',
  VOICE_GET_ALL_USERS: 'voice:get-all-users',
  VOICE_CHANNELS_UPDATE: 'voice:channels-update',

  // WebRTC events
  VOICE_OFFER: 'voice:offer',
  VOICE_ANSWER: 'voice:answer',
  VOICE_ICE_CANDIDATE: 'voice:ice-candidate',

  // Direct message events
  DIRECT_MESSAGE_NEW: 'direct-message:new',
  DIRECT_MESSAGE_EDITED: 'direct-message:edited',
  DIRECT_MESSAGE_DELETED: 'direct-message:deleted'
};

