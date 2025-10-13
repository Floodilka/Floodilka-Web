const friendService = require('../services/friendService');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');
const { SOCKET_EVENTS } = require('../constants/events');

exports.getFriends = asyncHandler(async (req, res) => {
  logger.debug('📥 Запрос списка друзей для пользователя:', req.user.id);
  const overview = await friendService.getOverview(req.user.id);
  res.json(overview);
});

exports.sendRequest = asyncHandler(async (req, res) => {
  const { username } = req.body;
  logger.debug('🤝 Отправка заявки в друзья:', { by: req.user.id, username });

  const result = await friendService.sendRequest(req.user.id, username);
  const io = req.app.get('io');

  if (io) {
    if (result.type === 'request') {
      io.emit(SOCKET_EVENTS.FRIEND_REQUEST_CREATED, {
        request: result.request
      });
    }

    if (result.type === 'accepted') {
      io.emit(SOCKET_EVENTS.FRIEND_REQUEST_UPDATED, {
        request: result.request,
        status: 'accepted'
      });

      // Уведомляем обе стороны о новом друге
      io.emit(SOCKET_EVENTS.FRIEND_ADDED, {
        userId: req.user.id,
        friend: result.friend,
        requestId: result.request._id
      });
      io.emit(SOCKET_EVENTS.FRIEND_ADDED, {
        userId: result.friend._id,
        friend: result.self,
        requestId: result.request._id
      });
    }
  }

  res.status(result.type === 'request' ? 201 : 200).json(result);
});

exports.respondToRequest = asyncHandler(async (req, res) => {
  const { requestId, action } = req.body;
  logger.debug('🤝 Обработка заявки в друзья:', { user: req.user.id, requestId, action });

  const result = await friendService.respondToRequest(req.user.id, requestId, action);
  const io = req.app.get('io');

  if (io) {
    io.emit(SOCKET_EVENTS.FRIEND_REQUEST_UPDATED, {
      request: result.request,
      status: result.status
    });

    if (result.status === 'accepted') {
      io.emit(SOCKET_EVENTS.FRIEND_ADDED, {
        userId: req.user.id,
        friend: result.friend,
        requestId: result.request._id
      });
      io.emit(SOCKET_EVENTS.FRIEND_ADDED, {
        userId: result.friend._id,
        friend: result.self,
        requestId: result.request._id
      });
    }
  }

  res.json(result);
});

exports.removeFriend = asyncHandler(async (req, res) => {
  const { friendId } = req.params;
  logger.debug('❌ Удаление друга:', { user: req.user.id, friendId });

  await friendService.removeFriend(req.user.id, friendId);

  const io = req.app.get('io');
  if (io) {
    io.emit(SOCKET_EVENTS.FRIEND_REMOVED, {
      userId: req.user.id,
      friendId
    });
    io.emit(SOCKET_EVENTS.FRIEND_REMOVED, {
      userId: friendId,
      friendId: req.user.id
    });
  }

  res.json({ success: true });
});
