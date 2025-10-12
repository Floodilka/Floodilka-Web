import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './VoiceChannel.css';
import ScreenShare from './ScreenShare';
import { useVoice } from '../context/VoiceContext';
import { useVoiceEngine } from '../hooks/useVoiceEngine';

const STORAGE_KEYS = {
  audioSettings: 'audioSettings',
  userVolumes: 'voiceUserVolumes',
};

const DEFAULT_AUDIO_SETTINGS = {
  noiseSuppression: true,
  echoCancellation: true,
  autoGainControl: true,
  micSensitivity: 50,
  audioBitrate: 192000,
  selectedMicrophone: 'default',
  selectedSpeaker: 'default',
  inputVolume: 100,
  outputVolume: 100,
  voiceMode: 'vad',
  pttKey: 'ControlLeft',
};

function VoiceChannel({
  socket,
  channel,
  user,
  globalMuted,
  globalDeafened,
  onDisconnectRef,
  onSpeakingUpdate,
}) {
  const screenShareRef = useRef(null);
  const accountToSocketsRef = useRef(new Map());
  const pttActiveRef = useRef(false);
  const disconnectHandlerRef = useRef(null);
  const joinSoundPlayedRef = useRef(false);
  const [audioSettings, setAudioSettings] = useState(loadAudioSettings);
  const [userVolumes, setUserVolumes] = useState(loadUserVolumes);
  const [isPttActive, setIsPttActive] = useState(false);
  const [lastError, setLastError] = useState(null);

  const {
    screenShareRef: globalScreenShareRef,
    connectToStreamRef,
  } = useVoice();

  const engine = useVoiceEngine({
    socket,
    channel,
    user,
    settings: audioSettings,
    onError: setLastError,
  });

  const {
    ready,
    participants,
    remoteSpeaking,
    localSpeaking,
    setMuted,
    setDeafened,
    setPushToTalk,
    applyUserVolume,
    stop,
  } = engine;

  const speakingSet = useMemo(() => {
    const remoteIds = Array.from(remoteSpeaking?.keys?.() || []);
    return new Set(remoteIds);
  }, [remoteSpeaking]);

  useEffect(() => {
    if (!onSpeakingUpdate) return;
    const combined = new Set(speakingSet);
    if (localSpeaking && !globalMuted) {
      combined.add('me');
    } else {
      combined.delete('me');
    }
    onSpeakingUpdate(combined);
  }, [speakingSet, localSpeaking, globalMuted, onSpeakingUpdate]);

  useEffect(() => {
    if (!ready) return;
    setMuted(Boolean(globalMuted));
  }, [ready, setMuted, globalMuted]);

  useEffect(() => {
    if (!ready) return;
    setDeafened(Boolean(globalDeafened));
  }, [ready, setDeafened, globalDeafened]);

  useEffect(() => {
    if (ready && !joinSoundPlayedRef.current) {
      playTone('/user_join.mp3', 0.45);
      joinSoundPlayedRef.current = true;
    } else if (!ready) {
      joinSoundPlayedRef.current = false;
    }
  }, [ready]);

  useEffect(() => {
    if (globalMuted) {
      pttActiveRef.current = false;
      setIsPttActive(false);
      setPushToTalk(false);
    }
  }, [globalMuted, setPushToTalk]);

  const applyVolumeForAccount = useCallback(
    (accountId, volume) => {
      const sockets = accountToSocketsRef.current.get(accountId);
      if (!sockets) return;
      sockets.forEach((socketId) => {
        applyUserVolume(socketId, volume);
      });
    },
    [applyUserVolume],
  );

  useEffect(() => {
    const accountToSockets = new Map();
    if (ready) {
      participants.forEach((participant) => {
        const accountId = participant.userId || participant.id;
        const socketId = participant.id;
        if (!accountId || !socketId) return;

        if (!accountToSockets.has(accountId)) {
          accountToSockets.set(accountId, new Set());
        }
        accountToSockets.get(accountId).add(socketId);
      });
    }

    accountToSocketsRef.current = accountToSockets;

    accountToSockets.forEach((socketIds, accountId) => {
      const stored = userVolumes[accountId];
      socketIds.forEach((socketId) => {
        applyUserVolume(socketId, stored);
      });
    });
  }, [ready, participants, userVolumes, applyUserVolume]);

  useEffect(() => {
    const handleAudioSettingsChanged = (event) => {
      const detail = event?.detail || {};
      setAudioSettings((prev) => {
        const next = { ...prev, ...detail };
        persistAudioSettings(next);
        return next;
      });
    };

    window.addEventListener('audioSettingsChanged', handleAudioSettingsChanged);
    return () => {
      window.removeEventListener('audioSettingsChanged', handleAudioSettingsChanged);
    };
  }, []);

  useEffect(() => {
    const handleUserVolumeChange = (event) => {
      const detail = event?.detail;
      if (!detail?.userId) return;
      setUserVolumes((prev) => {
        const next = { ...prev };
        if (detail.volume === 100 || detail.volume === undefined) {
          delete next[detail.userId];
        } else {
          next[detail.userId] = detail.volume;
        }
        return next;
      });
      applyVolumeForAccount(detail.userId, detail.volume);
    };

    window.addEventListener('voiceUserVolumeChanged', handleUserVolumeChange);
    return () => {
      window.removeEventListener('voiceUserVolumeChanged', handleUserVolumeChange);
    };
  }, [applyVolumeForAccount]);

  useEffect(() => {
    persistUserVolumes(userVolumes);
  }, [userVolumes]);

  useEffect(() => {
    if (!ready || audioSettings.voiceMode !== 'ptt') {
      pttActiveRef.current = false;
      setIsPttActive(false);
      setPushToTalk(false);
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.repeat) return;
      if (isInputFocused(event.target)) return;
      if (event.code !== audioSettings.pttKey) return;
      if (pttActiveRef.current) return;

      event.preventDefault();
      pttActiveRef.current = true;
      setIsPttActive(true);
      setPushToTalk(true);
      playTone('/ptt_start.mp3', 0.3);
    };

    const handleKeyUp = (event) => {
      if (event.code !== audioSettings.pttKey) return;
      if (!pttActiveRef.current) return;

      event.preventDefault();
      pttActiveRef.current = false;
      setIsPttActive(false);
      setPushToTalk(false);
      playTone('/ptt_stop.mp3', 0.3);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      pttActiveRef.current = false;
      setIsPttActive(false);
      setPushToTalk(false);
    };
  }, [ready, setPushToTalk, audioSettings.voiceMode, audioSettings.pttKey]);

  useEffect(() => {
    if (onDisconnectRef) {
      disconnectHandlerRef.current = async () => {
        try {
          setPushToTalk(false);
          await stop();
          playTone('/user_leave.mp3', 0.4);
        } catch (err) {
          console.warn('Voice disconnect failed', err);
        }
      };
      onDisconnectRef.current = disconnectHandlerRef.current;
    }
  }, [onDisconnectRef, setPushToTalk, stop]);

  useEffect(() => {
    if (globalScreenShareRef) {
      globalScreenShareRef.current = () => {
        screenShareRef.current?.toggleScreenShare?.();
      };
    }
  }, [globalScreenShareRef]);

  useEffect(() => {
    if (connectToStreamRef) {
      connectToStreamRef.current = (socketId) => {
        screenShareRef.current?.connectToStream?.(socketId);
      };
    }
  }, [connectToStreamRef]);

  useEffect(() => {
    if (lastError) {
      console.error('Voice engine error:', lastError);
    }
  }, [lastError]);

  const isInVoice = ready;

  return (
    <ScreenShare
      ref={screenShareRef}
      socket={socket}
      channel={channel}
      user={user}
      isInVoice={isInVoice}
      voiceUsers={participants}
    />
  );
}

function isInputFocused(target) {
  if (!target) return false;
  const tagName = target.tagName?.toLowerCase();
  return tagName === 'input' || tagName === 'textarea' || target.isContentEditable;
}

function playTone(src, volume = 0.3) {
  try {
    const audio = new Audio(src);
    audio.volume = volume;
    audio.play().catch(() => {});
  } catch (err) {
    console.warn('Tone playback failed', err);
  }
}

function loadAudioSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.audioSettings);
    if (!raw) {
      return { ...DEFAULT_AUDIO_SETTINGS };
    }
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_AUDIO_SETTINGS, ...parsed };
  } catch (err) {
    console.warn('Failed to load audio settings, using defaults', err);
    return { ...DEFAULT_AUDIO_SETTINGS };
  }
}

function persistAudioSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEYS.audioSettings, JSON.stringify(settings));
  } catch (err) {
    console.warn('Failed to persist audio settings', err);
  }
}

function loadUserVolumes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.userVolumes);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed;
    }
    return {};
  } catch (err) {
    console.warn('Failed to load user volume overrides', err);
    return {};
  }
}

function persistUserVolumes(data) {
  try {
    localStorage.setItem(STORAGE_KEYS.userVolumes, JSON.stringify(data));
  } catch (err) {
    console.warn('Failed to persist user volumes', err);
  }
}

export default VoiceChannel;
