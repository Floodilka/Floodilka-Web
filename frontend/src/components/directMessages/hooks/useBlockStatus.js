import { useState, useCallback } from 'react';
import api from '../../../services/api';

/**
 * Хук для управления статусом блокировки пользователей
 */
export const useBlockStatus = () => {
  const [blockStatus, setBlockStatus] = useState(null);
  const [blockActionLoading, setBlockActionLoading] = useState(false);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [blockActionError, setBlockActionError] = useState('');

  // Обновление статуса блокировки в списке разговоров
  const updateConversationBlockStatus = useCallback((directMessages, targetId, status) => {
    if (!targetId) return directMessages;

    return directMessages.map(dm => {
      if (!dm) return dm;

      const dmUserId = dm._id || dm.user?._id;
      if (dmUserId && dmUserId.toString() === targetId.toString()) {
        return {
          ...dm,
          blockStatus: status || null
        };
      }

      return dm;
    });
  }, []);

  // Обновление статуса блокировки
  const refreshBlockStatus = useCallback(async (targetUserId) => {
    if (!targetUserId) {
      setBlockStatus(null);
      return;
    }

    setBlockActionError('');

    try {
      const status = await api.getBlockStatus(targetUserId);
      setBlockStatus(status);
      return status;
    } catch (err) {
      console.error('Ошибка загрузки статуса блокировки:', err);
      setBlockStatus(null);
      return null;
    }
  }, []);

  // Открытие диалога блокировки
  const handleOpenBlockDialog = useCallback(() => {
    setBlockActionError('');
    setBlockReason('');
    setShowBlockDialog(true);
  }, []);

  // Закрытие диалога блокировки
  const handleCloseBlockDialog = useCallback(() => {
    setShowBlockDialog(false);
    setBlockActionError('');
  }, []);

  // Подтверждение блокировки
  const handleBlockConfirm = useCallback(async (targetId) => {
    if (!targetId || blockActionLoading) return;

    setBlockActionLoading(true);
    setBlockActionError('');

    try {
      const reason = blockReason.trim();
      await api.blockUser(targetId, reason || undefined);
      const status = await refreshBlockStatus(targetId);
      setShowBlockDialog(false);
      setBlockReason('');
      return status;
    } catch (err) {
      console.error('Ошибка блокировки пользователя:', err);
      setBlockActionError(err?.message || 'Не удалось заблокировать пользователя');
      throw err;
    } finally {
      setBlockActionLoading(false);
    }
  }, [blockReason, blockActionLoading, refreshBlockStatus]);

  // Разблокировка пользователя
  const handleUnblock = useCallback(async (targetId) => {
    if (!targetId || blockActionLoading) return;

    setBlockActionLoading(true);
    setBlockActionError('');

    try {
      await api.unblockUser(targetId);
      const status = await refreshBlockStatus(targetId);
      return status;
    } catch (err) {
      console.error('Ошибка разблокировки пользователя:', err);
      setBlockActionError(err?.message || 'Не удалось разблокировать пользователя');
      throw err;
    } finally {
      setBlockActionLoading(false);
    }
  }, [blockActionLoading, refreshBlockStatus]);

  return {
    blockStatus,
    setBlockStatus,
    blockActionLoading,
    showBlockDialog,
    setShowBlockDialog,
    blockReason,
    setBlockReason,
    blockActionError,
    setBlockActionError,
    updateConversationBlockStatus,
    refreshBlockStatus,
    handleOpenBlockDialog,
    handleCloseBlockDialog,
    handleBlockConfirm,
    handleUnblock
  };
};
