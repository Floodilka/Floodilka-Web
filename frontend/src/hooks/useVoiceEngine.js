import { useEffect, useMemo, useRef, useState } from 'react';
import { VoiceEngine } from '../voice/VoiceEngine';

const emptyArray = [];

const defaultSettings = {
  noiseSuppression: true,
  echoCancellation: true,
  autoGainControl: true,
  micSensitivity: 0,
  audioBitrate: 192000,
  selectedMicrophone: 'default',
  selectedSpeaker: 'default',
  inputVolume: 100,
  outputVolume: 100,
  voiceMode: 'vad',
  pttKey: 'ControlLeft',
};

export function useVoiceEngine({
  socket,
  channel,
  user,
  settings,
  onError,
}) {
  const engineRef = useRef(null);
  const participantsRef = useRef([]);
  const [participants, setParticipants] = useState(emptyArray);
  const [remoteSpeaking, setRemoteSpeaking] = useState(new Map());
  const [localSpeaking, setLocalSpeaking] = useState(false);
  const [networkQuality, setNetworkQuality] = useState({ status: 'excellent', loss: 0 });
  const [ready, setReady] = useState(false);
  const [engineError, setEngineError] = useState(null);

  const mergedSettings = useMemo(
    () => ({ ...defaultSettings, ...(settings || {}) }),
    [settings],
  );

  useEffect(() => {
    if (!socket || !channel) {
      return undefined;
    }

    const engine = new VoiceEngine({
      socket,
      channel,
      user,
      settings: mergedSettings,
      callbacks: {
        onParticipants: (list) => {
          participantsRef.current = list;
          setParticipants(list);
        },
        onUserJoined: (info) => {
          participantsRef.current = upsertParticipant(participantsRef.current, info);
          setParticipants(participantsRef.current);
        },
        onUserLeft: (id) => {
          participantsRef.current = participantsRef.current.filter((u) => u.id !== id);
          setParticipants(participantsRef.current);
          setRemoteSpeaking((prev) => {
            if (!prev.has(id)) return prev;
            const next = new Map(prev);
            next.delete(id);
            return next;
          });
        },
        onUserUpdated: (update) => {
          participantsRef.current = upsertParticipant(participantsRef.current, update);
          setParticipants(participantsRef.current);
        },
        onRemoteSpeaking: (id, speaking) => {
          setRemoteSpeaking((prev) => {
            const next = new Map(prev);
            if (speaking) {
              next.set(id, true);
            } else {
              next.delete(id);
            }
            return next;
          });
        },
        onLocalSpeaking: (speaking) => {
          setLocalSpeaking(Boolean(speaking));
        },
        onNetworkQuality: (status, loss) => {
          setNetworkQuality({ status, loss });
        },
        onError: (err) => {
          console.error('VoiceEngine error', err);
          setEngineError(err);
          onError?.(err);
        },
      },
    });

    engineRef.current = engine;
    let cancelled = false;

    engine
      .start()
      .then(() => {
        if (!cancelled) {
          setReady(true);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('VoiceEngine start failed', err);
          setEngineError(err);
          onError?.(err);
        }
      });

    return () => {
      cancelled = true;
      setReady(false);
      participantsRef.current = [];
      setParticipants(emptyArray);
      setRemoteSpeaking(new Map());
      setLocalSpeaking(false);
      setNetworkQuality({ status: 'excellent', loss: 0 });
      engine.stop().catch((err) => console.warn('VoiceEngine stop error', err));
      engineRef.current = null;
    };
  }, [socket, channel?.id]);

  useEffect(() => {
    if (ready && engineRef.current) {
      engineRef.current.updateSettings(mergedSettings);
    }
  }, [ready, mergedSettings]);

  const api = useMemo(() => ({
    ready,
    participants,
    remoteSpeaking,
    localSpeaking,
    networkQuality,
    error: engineError,
    setMuted: (flag) => engineRef.current?.setMuted(flag),
    setPushToTalk: (active) => engineRef.current?.setPTTActive(active),
    setDeafened: (flag) => engineRef.current?.setDeafened(flag),
    updateSettings: (next) => engineRef.current?.updateSettings(next),
    applyUserVolume: (id, percent) => engineRef.current?.applyUserVolume(id, percent),
    stop: () => engineRef.current?.stop(),
  }), [ready, participants, remoteSpeaking, localSpeaking, networkQuality, engineError]);

  return api;
}

function upsertParticipant(list, update) {
  if (!update || !update.id) {
    return list;
  }
  const idx = list.findIndex((u) => u.id === update.id);
  const merged = idx === -1 ? [...list, { ...update }] : list.map((u, i) => (i === idx ? { ...u, ...update } : u));
  return merged;
}
