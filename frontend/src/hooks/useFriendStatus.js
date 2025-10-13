import { useMemo } from 'react';
import { useFriends } from '../context/FriendsContext';

const normalizeId = (value) => {
  if (!value) return null;
  try {
    return value.toString();
  } catch (err) {
    return null;
  }
};

export const useFriendStatus = (targetUserId) => {
  const { friends, incomingRequests, outgoingRequests } = useFriends();

  return useMemo(() => {
    const normalizedId = normalizeId(targetUserId);

    if (!normalizedId) {
      return {
        isFriend: false,
        hasIncomingRequest: false,
        hasOutgoingRequest: false,
        incomingRequestId: null,
        outgoingRequestId: null,
        friend: null
      };
    }

    const friend = friends.find(item => normalizeId(item?._id) === normalizedId) || null;
    const incoming = incomingRequests.find(req => normalizeId(req?.from?._id) === normalizedId) || null;
    const outgoing = outgoingRequests.find(req => normalizeId(req?.to?._id) === normalizedId) || null;

    return {
      isFriend: Boolean(friend),
      hasIncomingRequest: Boolean(incoming),
      hasOutgoingRequest: Boolean(outgoing),
      incomingRequestId: incoming?._id || null,
      outgoingRequestId: outgoing?._id || null,
      friend
    };
  }, [targetUserId, friends, incomingRequests, outgoingRequests]);
};
