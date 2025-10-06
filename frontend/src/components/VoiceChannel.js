import React, { useState, useEffect, useRef } from 'react';
import './VoiceChannel.css';

function VoiceChannel({ socket, channel, user, globalMuted, globalDeafened, onDisconnectRef, onSpeakingUpdate }) {
  const [isConnected, setIsConnected] = useState(false);
  const [voiceUsers, setVoiceUsers] = useState([]);
  const [speakingUsers, setSpeakingUsers] = useState(new Set());
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Передать информацию о говорящих наверх для сайдбара
  useEffect(() => {
    if (onSpeakingUpdate) {
      const allSpeaking = new Set(speakingUsers);
      // Добавляем себя только если микрофон включен и говорим
      if (isSpeaking && !globalMuted) {
        allSpeaking.add('me');
      }
      onSpeakingUpdate(allSpeaking);
    }
  }, [speakingUsers, isSpeaking, globalMuted, onSpeakingUpdate]);

  const [noiseSuppression] = useState(true);
  const [echoCancellation] = useState(true);
  const [micSensitivity] = useState(20); // Порог для определения речи
  const [audioBitrate] = useState(128000); // Битрейт в kbps

  const localStreamRef = useRef(null);
  const peersRef = useRef({});
  const localAnalyserRef = useRef(null);

  // ICE серверы для WebRTC
  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  useEffect(() => {
    if (!socket || !channel) return;

    // Обработка голосовых событий
    socket.on('voice:users', handleVoiceUsers);
    socket.on('voice:user-joined', handleUserJoined);
    socket.on('voice:user-left', handleUserLeft);
    socket.on('voice:user-muted', handleUserMuted);
    socket.on('voice:user-deafened', handleUserDeafened);
    socket.on('voice:offer', handleOffer);
    socket.on('voice:answer', handleAnswer);
    socket.on('voice:ice-candidate', handleIceCandidate);

    // Автоматически подключиться при входе в канал (только если еще не подключены)
    if (!isConnected) {
      handleConnect();
    }

    return () => {
      socket.off('voice:users');
      socket.off('voice:user-joined');
      socket.off('voice:user-left');
      socket.off('voice:user-muted');
      socket.off('voice:user-deafened');
      socket.off('voice:offer');
      socket.off('voice:answer');
      socket.off('voice:ice-candidate');

      // Отключиться при размонтировании
      if (isConnected) {
        handleDisconnect();
      }
    };
  }, [socket, channel]);

  const handleVoiceUsers = (users) => {
    setVoiceUsers(users);
    // Создать соединения со всеми существующими пользователями
    users.forEach(user => {
      createPeerConnection(user.id, true);
    });
  };

  const handleUserJoined = (user) => {
    setVoiceUsers(prev => [...prev, user]);
    // Не создаем соединение сразу, ждем offer от нового пользователя
  };

  const handleUserLeft = ({ id }) => {
    setVoiceUsers(prev => prev.filter(u => u.id !== id));
    setSpeakingUsers(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });

    // Закрыть соединение с пользователем
    if (peersRef.current[id]) {
      peersRef.current[id].close();
      delete peersRef.current[id];
    }
  };

  const handleUserMuted = ({ id, isMuted }) => {
    setVoiceUsers(prev =>
      prev.map(u => u.id === id ? { ...u, isMuted } : u)
    );
  };

  const handleUserDeafened = ({ id, isDeafened }) => {
    setVoiceUsers(prev =>
      prev.map(u => u.id === id ? { ...u, isDeafened } : u)
    );
  };

  const createPeerConnection = (userId, createOffer) => {
    if (peersRef.current[userId]) return;

    const peerConnection = new RTCPeerConnection(iceServers);
    peersRef.current[userId] = peerConnection;

    // Добавить локальный поток с настройками
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        const sender = peerConnection.addTrack(track, localStreamRef.current);

        // Настроить параметры кодека для лучшего качества
        const parameters = sender.getParameters();
        if (!parameters.encodings) {
          parameters.encodings = [{}];
        }
        parameters.encodings[0].maxBitrate = audioBitrate;
        parameters.encodings[0].priority = 'high';
        parameters.encodings[0].networkPriority = 'high';
        sender.setParameters(parameters).catch(err =>
          console.warn('Не удалось установить параметры:', err)
        );
      });
    }

    // Обработать удаленный поток
    peerConnection.ontrack = (event) => {
      const [remoteStream] = event.streams;
      playRemoteAudio(remoteStream, userId);
    };

    // Обработать ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('voice:ice-candidate', {
          candidate: event.candidate,
          to: userId
        });
      }
    };

    // Создать offer если нужно
    if (createOffer) {
      // Настройки для создания offer
      const offerOptions = {
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
        voiceActivityDetection: false
      };

      peerConnection.createOffer(offerOptions)
        .then(offer => {
          // Модифицировать SDP для улучшения качества
          offer.sdp = enhanceAudioSDP(offer.sdp);
          return peerConnection.setLocalDescription(offer);
        })
        .then(() => {
          socket.emit('voice:offer', {
            offer: peerConnection.localDescription,
            to: userId
          });
        })
        .catch(err => console.error('Ошибка создания offer:', err));
    }
  };

  // Улучшить SDP для лучшего качества аудио
  const enhanceAudioSDP = (sdp) => {
    // Установить Opus как приоритетный кодек с максимальным качеством
    let lines = sdp.split('\r\n');

    // Найти строку с Opus и установить параметры
    const opusPayload = lines.find(line => line.includes('opus/48000'));
    if (opusPayload) {
      const payload = opusPayload.match(/:\d+ /)?.[0]?.replace(/[: ]/g, '');
      if (payload) {
        // Добавить или обновить fmtp для Opus
        const fmtpIndex = lines.findIndex(line => line.includes(`a=fmtp:${payload}`));
        const fmtpLine = `a=fmtp:${payload} minptime=10;useinbandfec=1;maxaveragebitrate=${audioBitrate};stereo=1;maxplaybackrate=48000;sprop-stereo=1;cbr=1`;

        if (fmtpIndex !== -1) {
          lines[fmtpIndex] = fmtpLine;
        } else {
          // Найти место после rtpmap и вставить
          const rtpmapIndex = lines.findIndex(line => line.includes(`a=rtpmap:${payload}`));
          if (rtpmapIndex !== -1) {
            lines.splice(rtpmapIndex + 1, 0, fmtpLine);
          }
        }
      }
    }

    // Увеличить пропускную способность
    const bwIndex = lines.findIndex(line => line.startsWith('b=AS:'));
    if (bwIndex !== -1) {
      lines[bwIndex] = 'b=AS:256';
    } else {
      // Добавить после медиа-секции
      const mediaIndex = lines.findIndex(line => line.startsWith('m=audio'));
      if (mediaIndex !== -1) {
        lines.splice(mediaIndex + 1, 0, 'b=AS:256');
      }
    }

    return lines.join('\r\n');
  };

  const handleOffer = async ({ offer, from }) => {
    createPeerConnection(from, false);
    const peerConnection = peersRef.current[from];

    try {
      // Улучшить входящий SDP
      offer.sdp = enhanceAudioSDP(offer.sdp);

      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

      const answer = await peerConnection.createAnswer();
      // Улучшить исходящий SDP
      answer.sdp = enhanceAudioSDP(answer.sdp);

      await peerConnection.setLocalDescription(answer);

      socket.emit('voice:answer', {
        answer: peerConnection.localDescription,
        to: from
      });
    } catch (err) {
      console.error('Ошибка обработки offer:', err);
    }
  };

  const handleAnswer = async ({ answer, from }) => {
    const peerConnection = peersRef.current[from];
    if (peerConnection) {
      try {
        // Улучшить входящий SDP
        answer.sdp = enhanceAudioSDP(answer.sdp);
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (err) {
        console.error('Ошибка обработки answer:', err);
      }
    }
  };

  const handleIceCandidate = async ({ candidate, from }) => {
    const peerConnection = peersRef.current[from];
    if (peerConnection) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error('Ошибка добавления ICE candidate:', err);
      }
    }
  };

  const startLocalAudioAnalysis = (stream) => {
    try {
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 512;

      localAnalyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const checkMyAudioLevel = () => {
        if (!localAnalyserRef.current) return;

        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;

        // Показывать говорение только если микрофон включен
        setIsSpeaking(!globalMuted && average > 20);

        requestAnimationFrame(checkMyAudioLevel);
      };
      checkMyAudioLevel();
    } catch (err) {
      console.warn('Не удалось анализировать локальное аудио:', err);
    }
  };

  const playRemoteAudio = (stream, userId) => {
    // Создать аудио элемент для воспроизведения
    let audio = document.getElementById(`audio-${userId}`);
    if (!audio) {
      audio = document.createElement('audio');
      audio.id = `audio-${userId}`;
      audio.autoplay = true;
      audio.volume = 1.0;
      document.body.appendChild(audio);
    }
    audio.srcObject = stream;

    // Анализ громкости для индикатора говорения
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    analyser.fftSize = 512;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const checkAudioLevel = () => {
      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;

      setSpeakingUsers(prev => {
        const newSet = new Set(prev);
        if (average > micSensitivity) {
          newSet.add(userId);
        } else {
          newSet.delete(userId);
        }
        return newSet;
      });

      requestAnimationFrame(checkAudioLevel);
    };
    checkAudioLevel();
  };

  const handleConnect = async () => {
    try {
      // Получить доступ к микрофону с оптимальными настройками
      const constraints = {
        audio: {
          echoCancellation: echoCancellation,
          noiseSuppression: noiseSuppression,
          autoGainControl: true,
          sampleRate: { ideal: 48000 },
          sampleSize: { ideal: 16 },
          channelCount: { ideal: 2 }, // Стерео для лучшего качества
          latency: { ideal: 0.01 }, // Низкая задержка
          volume: { ideal: 1.0 }
        },
        video: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      // Применить дополнительную обработку к аудио
      const processedStream = await processAudioStream(stream);

      localStreamRef.current = processedStream;
      setIsConnected(true);

      // Анализировать свой собственный микрофон
      startLocalAudioAnalysis(stream);

      // Присоединиться к голосовому каналу
      socket.emit('voice:join', {
        channelId: channel.id,
        username: user?.displayName || user?.username,
        avatar: user?.avatar,
        badge: user?.badge,
        badgeTooltip: user?.badgeTooltip
      });

    } catch (err) {
      console.error('Ошибка доступа к микрофону:', err);
      alert('Не удалось получить доступ к микрофону. Проверьте разрешения.');
    }
  };

  // Обработка аудио потока для улучшения качества
  const processAudioStream = async (stream) => {
    try {
      const audioContext = new AudioContext({
        sampleRate: 48000,
        latencyHint: 'interactive'
      });

      const source = audioContext.createMediaStreamSource(stream);
      const destination = audioContext.createMediaStreamDestination();

      // Компрессор для выравнивания громкости
      const compressor = audioContext.createDynamicsCompressor();
      compressor.threshold.value = -50;
      compressor.knee.value = 40;
      compressor.ratio.value = 12;
      compressor.attack.value = 0;
      compressor.release.value = 0.25;

      // Фильтр для улучшения голоса
      const filter = audioContext.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1000;
      filter.Q.value = 0.5;

      // Усиление (gain)
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 1.2;

      // Соединить узлы
      source.connect(compressor);
      compressor.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(destination);

      return destination.stream;
    } catch (err) {
      console.warn('Не удалось обработать аудио, используем оригинальный поток:', err);
      return stream;
    }
  };

  const handleDisconnect = () => {
    // Остановить локальный поток
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    // Остановить анализатор
    localAnalyserRef.current = null;

    // Закрыть все peer соединения
    Object.values(peersRef.current).forEach(peer => peer.close());
    peersRef.current = {};

    // Удалить все удаленные аудио элементы
    voiceUsers.forEach(user => {
      const audio = document.getElementById(`audio-${user.id}`);
      if (audio) audio.remove();
    });

    // Покинуть голосовой канал
    if (socket && channel) {
      socket.emit('voice:leave', { channelId: channel.id });
    }

    setIsConnected(false);
    setVoiceUsers([]);
    setSpeakingUsers(new Set());
    setIsSpeaking(false);
  };

  // Прокинуть функцию disconnect наверх для использования в профиле
  useEffect(() => {
    if (onDisconnectRef) {
      onDisconnectRef.current = handleDisconnect;
    }
  }, [onDisconnectRef]);

  // Синхронизация с глобальными состояниями
  useEffect(() => {
    if (!localStreamRef.current || !socket || !channel) return;

    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !globalMuted;

      socket.emit('voice:mute-toggle', {
        channelId: channel.id,
        isMuted: globalMuted
      });
    }
  }, [globalMuted, socket, channel]);

  useEffect(() => {
    if (!socket || !channel) return;

    // Управление входящими аудио потоками
    voiceUsers.forEach(user => {
      const audio = document.getElementById(`audio-${user.id}`);
      if (audio) {
        audio.muted = globalDeafened;
      }
    });

    socket.emit('voice:deafen-toggle', {
      channelId: channel.id,
      isDeafened: globalDeafened
    });
  }, [globalDeafened, voiceUsers, socket, channel]);

  // Голосовой канал теперь скрыт - работает в фоне
  return null;
}

export default VoiceChannel;

