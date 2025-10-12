// WebSocket события
const SOCKET_EVENTS = {
  // Connection
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',
  ERROR: 'error',

  // Server events
  SERVER_JOIN: 'server:join',
  SERVER_LEAVE: 'server:leave',
  SERVER_USERS_UPDATE: 'server:users-update',
  GLOBAL_USERS_UPDATE: 'global:users-update',

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

  // Reaction events
  REACTION_ADD: 'reaction:add',
  REACTION_ADDED: 'reaction:added',
  REACTION_REMOVE: 'reaction:remove',
  REACTION_REMOVED: 'reaction:removed',

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
  VOICE_PING: 'voice:ping',
  VOICE_PONG: 'voice:pong',

  // WebRTC events
  VOICE_OFFER: 'voice:offer',
  VOICE_ANSWER: 'voice:answer',
  VOICE_ICE_CANDIDATE: 'voice:ice-candidate',

  // Screen sharing events
  SCREEN_SHARE_START: 'screen-share:start',
  SCREEN_SHARE_STOP: 'screen-share:stop',
  SCREEN_SHARE_NEW_VIEWER: 'screen-share:new-viewer',
  SCREEN_SHARE_OFFER: 'screen-share:offer',
  SCREEN_SHARE_ANSWER: 'screen-share:answer',
  SCREEN_SHARE_ICE_CANDIDATE: 'screen-share:ice-candidate',
  SCREEN_SHARING_UPDATE: 'screen-sharing:update',

  // Direct message events
  DIRECT_MESSAGE_NEW: 'direct-message:new'
};

module.exports = { SOCKET_EVENTS };
