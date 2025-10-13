import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import socketService from '../services/socket';
import { useAuth } from './AuthContext';
import { useSocketContext } from './SocketContext';
import { SOCKET_EVENTS } from '../constants/events';

const FriendsContext = createContext(null);

export const useFriends = () => {
  const context = useContext(FriendsContext);
  if (!context) {
    throw new Error('useFriends must be used within FriendsProvider');
  }
  return context;
};

const normalizeRequest = (request) => {
  if (!request) return null;
  return {
    _id: request._id,
    status: request.status,
    createdAt: request.createdAt,
    from: request.from,
    to: request.to
  };
};

export const FriendsProvider = ({ children }) => {
  const { user } = useAuth();
  const { socket } = useSocketContext();

  const [friends, setFriends] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const resetState = useCallback(() => {
    setFriends([]);
    setIncomingRequests([]);
    setOutgoingRequests([]);
    setError(null);
  }, []);

  const refreshFriends = useCallback(async () => {
    if (!user?.id) {
      resetState();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await api.getFriends();
      setFriends(Array.isArray(data.friends) ? data.friends : []);
      setIncomingRequests(Array.isArray(data.incomingRequests) ? data.incomingRequests : []);
      setOutgoingRequests(Array.isArray(data.outgoingRequests) ? data.outgoingRequests : []);
    } catch (err) {
      console.error('Ошибка загрузки списка друзей:', err);
      setError(err.message || 'Не удалось загрузить друзей');
    } finally {
      setLoading(false);
    }
  }, [user?.id, resetState]);

  useEffect(() => {
    if (user?.id) {
      refreshFriends();
    } else {
      resetState();
    }
  }, [user?.id, refreshFriends, resetState]);

  const upsertRequest = useCallback((requests, updatedRequest) => {
    if (!updatedRequest) return requests;
    const exists = requests.some(req => req._id === updatedRequest._id);
    if (exists) {
      return requests.map(req => (req._id === updatedRequest._id ? { ...req, ...updatedRequest } : req));
    }
    return [updatedRequest, ...requests];
  }, []);

  const removeRequestById = useCallback((requests, requestId) => {
    return requests.filter(req => req._id !== requestId);
  }, []);

  // WebSocket listeners
  useEffect(() => {
    if (!socket || !user?.id) return;

    const handleRequestCreated = ({ request }) => {
      const normalized = normalizeRequest(request);
      if (!normalized) return;

      if (normalized.to?._id === user.id) {
        setIncomingRequests(prev => upsertRequest(prev, normalized));
      } else if (normalized.from?._id === user.id) {
        setOutgoingRequests(prev => upsertRequest(prev, normalized));
      }
    };

    const handleRequestUpdated = ({ request, status }) => {
      const normalized = normalizeRequest(request);
      if (!normalized) return;

      normalized.status = status || normalized.status;

      if (normalized.to?._id === user.id) {
        setIncomingRequests(prev => {
          if (status === 'pending') {
            return upsertRequest(prev, normalized);
          }
          return removeRequestById(prev, normalized._id);
        });
      }

      if (normalized.from?._id === user.id) {
        setOutgoingRequests(prev => {
          if (status === 'pending') {
            return upsertRequest(prev, normalized);
          }
          return removeRequestById(prev, normalized._id);
        });
      }
    };

    const handleFriendAdded = ({ userId, friend, requestId }) => {
      if (userId !== user.id || !friend) return;

      setFriends(prev => {
        const exists = prev.some(existing => existing._id === friend._id);
        if (exists) {
          return prev.map(existing => existing._id === friend._id ? { ...existing, ...friend } : existing);
        }
        return [...prev, friend];
      });

      if (requestId) {
        setIncomingRequests(prev => removeRequestById(prev, requestId));
        setOutgoingRequests(prev => removeRequestById(prev, requestId));
      } else {
        setIncomingRequests(prev => prev.filter(req => req.from?._id !== friend._id));
        setOutgoingRequests(prev => prev.filter(req => req.to?._id !== friend._id));
      }
    };

    const handleFriendRemoved = ({ userId, friendId }) => {
      if (userId !== user.id) return;
      setFriends(prev => prev.filter(friend => friend._id !== friendId));
    };

    socketService.on(SOCKET_EVENTS.FRIEND_REQUEST_CREATED, handleRequestCreated);
    socketService.on(SOCKET_EVENTS.FRIEND_REQUEST_UPDATED, handleRequestUpdated);
    socketService.on(SOCKET_EVENTS.FRIEND_ADDED, handleFriendAdded);
    socketService.on(SOCKET_EVENTS.FRIEND_REMOVED, handleFriendRemoved);

    return () => {
      socketService.off(SOCKET_EVENTS.FRIEND_REQUEST_CREATED, handleRequestCreated);
      socketService.off(SOCKET_EVENTS.FRIEND_REQUEST_UPDATED, handleRequestUpdated);
      socketService.off(SOCKET_EVENTS.FRIEND_ADDED, handleFriendAdded);
      socketService.off(SOCKET_EVENTS.FRIEND_REMOVED, handleFriendRemoved);
    };
  }, [socket, user?.id, upsertRequest, removeRequestById]);

  const sendFriendRequest = useCallback(async (username) => {
    const result = await api.sendFriendRequest(username);

    if (result.type === 'request' && result.request) {
      const normalized = normalizeRequest(result.request);
      if (normalized?.from?._id === user?.id) {
        setOutgoingRequests(prev => upsertRequest(prev, normalized));
      } else if (normalized?.to?._id === user?.id) {
        setIncomingRequests(prev => upsertRequest(prev, normalized));
      }
    }

    if (result.type === 'accepted') {
      if (result.request?._id) {
        setIncomingRequests(prev => removeRequestById(prev, result.request._id));
        setOutgoingRequests(prev => removeRequestById(prev, result.request._id));
      }

      if (result.friend) {
        setFriends(prev => {
          const exists = prev.some(existing => existing._id === result.friend._id);
          if (exists) {
            return prev.map(existing => existing._id === result.friend._id ? { ...existing, ...result.friend } : existing);
          }
          return [...prev, result.friend];
        });
      }
    }

    return result;
  }, [user?.id, upsertRequest, removeRequestById]);

  const respondToRequest = useCallback(async (requestId, action) => {
    const result = await api.respondToFriendRequest(requestId, action);

    if (result.request?._id) {
      const normalized = normalizeRequest(result.request);

      if (normalized?.to?._id === user?.id) {
        setIncomingRequests(prev => removeRequestById(prev, normalized._id));
      }
      if (normalized?.from?._id === user?.id) {
        setOutgoingRequests(prev => removeRequestById(prev, normalized._id));
      }
    }

    if (result.status === 'accepted' && result.friend) {
      setFriends(prev => {
        const exists = prev.some(existing => existing._id === result.friend._id);
        if (exists) {
          return prev.map(existing => existing._id === result.friend._id ? { ...existing, ...result.friend } : existing);
        }
        return [...prev, result.friend];
      });
    }

    return result;
  }, [user?.id, removeRequestById]);

  const cancelOutgoingRequest = useCallback(async (requestId) => {
    const result = await respondToRequest(requestId, 'cancel');
    return result;
  }, [respondToRequest]);

  const removeFriend = useCallback(async (friendId) => {
    await api.removeFriend(friendId);
    setFriends(prev => prev.filter(friend => friend._id !== friendId));
  }, []);

  const value = {
    friends,
    incomingRequests,
    outgoingRequests,
    loading,
    error,
    refreshFriends,
    sendFriendRequest,
    respondToRequest,
    cancelOutgoingRequest,
    removeFriend
  };

  return (
    <FriendsContext.Provider value={value}>
      {children}
    </FriendsContext.Provider>
  );
};
