import { useState, useEffect, useRef } from 'react';
import './VoiceChannel.css';

function VoiceChannel({ socket, channel, user, globalMuted, globalDeafened, onDisconnectRef, onSpeakingUpdate }) {
  const [isConnected, setIsConnected] = useState(false);
  const [voiceUsers, setVoiceUsers] = useState([]);
  const [speakingUsers, setSpeakingUsers] = useState(new Set());
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Гарантированная очистка при размонтировании компонента
  useEffect(() => {
    return () => {
      // Отменить все animation frames
      animationFramesRef.current.forEach(frameId => {
        if (frameId) cancelAnimationFrame(frameId);
      });
      animationFramesRef.current = [];

      // Закрыть все AudioContext
      audioContextsRef.current.forEach(({ context, source }) => {
        try {
          if (source) source.disconnect();
          if (context && context.state !== 'closed') context.close();
        } catch (err) {
          console.warn('Ошибка закрытия AudioContext:', err);
        }
      });
      audioContextsRef.current = [];

      // Остановить ВСЕ СОХРАНЕННЫЕ потоки (для StrictMode)
      allStreamsRef.current.forEach((streamObj) => {
        if (streamObj.original) {
          streamObj.original.getTracks().forEach(track => track.stop());
        }
        if (streamObj.processed) {
          streamObj.processed.getTracks().forEach(track => track.stop());
        }
      });
      allStreamsRef.current = [];

      // Также очищаем текущие ref
      originalStreamRef.current = null;
      localStreamRef.current = null;

      // Остановить анализатор
      localAnalyserRef.current = null;

      // Остановить мониторинг сети
      if (networkMonitorRef.current) {
        clearInterval(networkMonitorRef.current);
        networkMonitorRef.current = null;
      }

      // Закрыть все peer соединения
      Object.values(peersRef.current).forEach(peer => {
        if (peer) peer.close();
      });
      peersRef.current = {};

      // Удалить все аудио элементы
      document.querySelectorAll('audio[id^="audio-"]').forEach(audio => {
        audio.pause();
        audio.srcObject = null;
        audio.remove();
      });

      // Сбросить флаг подключения
      isConnectingRef.current = false;
    };
  }, []);

  // Дополнительная защита: останавливаем все медиа-треки при закрытии/перезагрузке страницы
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Отменить все animation frames
      animationFramesRef.current.forEach(frameId => {
        if (frameId) cancelAnimationFrame(frameId);
      });

      // Закрыть все AudioContext
      audioContextsRef.current.forEach(({ context, source }) => {
        try {
          if (source) source.disconnect();
          if (context && context.state !== 'closed') context.close();
        } catch (err) {
          // Игнорируем ошибки при закрытии страницы
        }
      });

      // Остановить все медиа-треки (оригинальный и обработанный)
      if (originalStreamRef.current) {
        originalStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Проверяем поддержку браузера
  const isBrowserSupported = () => {
    return !!(navigator.mediaDevices &&
              navigator.mediaDevices.getUserMedia &&
              window.RTCPeerConnection &&
              (window.AudioContext || window.webkitAudioContext));
  };

  // Определяем браузер для специальной обработки
  const getBrowserInfo = () => {
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('yabrowser') || userAgent.includes('yandex')) {
      return 'yandex';
    } else if (userAgent.includes('arc')) {
      return 'arc';
    } else if (userAgent.includes('chrome')) {
      return 'chrome';
    } else if (userAgent.includes('firefox')) {
      return 'firefox';
    } else if (userAgent.includes('safari')) {
      return 'safari';
    } else if (userAgent.includes('edge')) {
      return 'edge';
    }
    return 'unknown';
  };

  // Сохранить функцию onSpeakingUpdate в ref для избежания циклов
  const onSpeakingUpdateRef = useRef(onSpeakingUpdate);
  onSpeakingUpdateRef.current = onSpeakingUpdate;

  // Передать информацию о говорящих наверх для сайдбара
  useEffect(() => {
    if (onSpeakingUpdateRef.current) {
      const allSpeaking = new Set(speakingUsers);
      // Добавляем себя только если микрофон включен и говорим
      if (isSpeaking && !globalMuted) {
        allSpeaking.add('me');
      }
      onSpeakingUpdateRef.current(allSpeaking);
    }
  }, [speakingUsers, isSpeaking, globalMuted]);

  // Загрузить настройки из localStorage или использовать значения по умолчанию
  const loadAudioSettings = () => {
    const savedSettings = localStorage.getItem('audioSettings');
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      return {
        noiseSuppression: settings.noiseSuppression ?? true,
        echoCancellation: settings.echoCancellation ?? true,
        autoGainControl: settings.autoGainControl ?? true,
        micSensitivity: settings.micSensitivity ?? 1,
        audioBitrate: settings.audioBitrate ?? 512000,
        audioQuality: settings.audioQuality ?? 'ultra',
        selectedMicrophone: settings.selectedMicrophone ?? 'default',
        selectedSpeaker: settings.selectedSpeaker ?? 'default',
        inputVolume: settings.inputVolume ?? 100,
        outputVolume: settings.outputVolume ?? 100,
        voiceMode: settings.voiceMode ?? 'vad',
        pttKey: settings.pttKey ?? 'ControlLeft'
      };
    }
    return {
      noiseSuppression: true,
      echoCancellation: true,
      autoGainControl: true,
      micSensitivity: 1,
      audioBitrate: 512000, // Максимальный битрейт по умолчанию
      audioQuality: 'ultra',
      selectedMicrophone: 'default',
      selectedSpeaker: 'default',
      inputVolume: 100,
      outputVolume: 100,
      voiceMode: 'vad',
      pttKey: 'ControlLeft'
    };
  };

  const initialSettings = loadAudioSettings();
  const [noiseSuppression, setNoiseSuppression] = useState(initialSettings.noiseSuppression);
  const [echoCancellation, setEchoCancellation] = useState(initialSettings.echoCancellation);
  const [micSensitivity, setMicSensitivity] = useState(initialSettings.micSensitivity);
  const [audioBitrate, setAudioBitrate] = useState(initialSettings.audioBitrate);
  const [selectedMicrophone, setSelectedMicrophone] = useState(initialSettings.selectedMicrophone);
  const [selectedSpeaker, setSelectedSpeaker] = useState(initialSettings.selectedSpeaker);
  const [voiceMode, setVoiceMode] = useState(initialSettings.voiceMode);
  const [pttKey, setPttKey] = useState(initialSettings.pttKey);
  const [isPttActive, setIsPttActive] = useState(false);
  const [inputVolume, setInputVolume] = useState(initialSettings.inputVolume);
  const [outputVolume, setOutputVolume] = useState(initialSettings.outputVolume);
  const [networkQuality, setNetworkQuality] = useState('good'); // Качество сети: poor, good, excellent

  const localStreamRef = useRef(null); // Обработанный поток для WebRTC
  const originalStreamRef = useRef(null); // Оригинальный поток от getUserMedia
  const allStreamsRef = useRef([]); // ВСЕ созданные потоки (для StrictMode)
  const peersRef = useRef({});
  const localAnalyserRef = useRef(null);
  const networkMonitorRef = useRef(null);
  const audioContextsRef = useRef([]); // Хранить все AudioContext для их закрытия
  const animationFramesRef = useRef([]); // Хранить все requestAnimationFrame ID
  const isConnectingRef = useRef(false); // Флаг подключения

  // ICE серверы для WebRTC - улучшенная конфигурация
  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      { urls: 'stun:stun.voiparound.com' },
      { urls: 'stun:stun.voipbuster.com' },
      { urls: 'stun:stun.voipstunt.com' },
      { urls: 'stun:stun.counterpath.com' },
      { urls: 'stun:stun.1und1.de' }
    ],
    iceCandidatePoolSize: 10
  };

  // Функция для адаптивного битрейта
  const getAdaptiveBitrate = (quality) => {
    switch (quality) {
      case 'poor':
        return 96000;  // 96 kbps для плохой сети
      case 'good':
        return 192000; // 192 kbps для хорошей сети
      case 'excellent':
        return 512000; // 512 kbps для отличной сети
      default:
        return 192000;
    }
  };

  // Мониторинг качества сети
  const startNetworkMonitoring = () => {
    if (networkMonitorRef.current) return;

    const monitorInterval = setInterval(async () => {
      try {
        // Проверяем статистику WebRTC соединений
        const peerConnections = Object.values(peersRef.current);
        if (peerConnections.length === 0) return;

        const stats = await peerConnections[0].getStats();
        let totalPacketsLost = 0;
        let totalPacketsSent = 0;

        stats.forEach(report => {
          if (report.type === 'inbound-rtp' && report.mediaType === 'audio') {
            totalPacketsLost += report.packetsLost || 0;
          }
          if (report.type === 'outbound-rtp' && report.mediaType === 'audio') {
            totalPacketsSent += report.packetsSent || 0;
          }
        });

        // Определяем качество сети на основе потерь пакетов
        const packetLossRate = totalPacketsSent > 0 ? (totalPacketsLost / totalPacketsSent) * 100 : 0;

        let newQuality;
        if (packetLossRate < 1) {
          newQuality = 'excellent';
        } else if (packetLossRate < 3) {
          newQuality = 'good';
        } else {
          newQuality = 'poor';
        }

        if (newQuality !== networkQuality) {
          setNetworkQuality(newQuality);
          const newBitrate = getAdaptiveBitrate(newQuality);
          setAudioBitrate(newBitrate);

          // Обновить параметры всех активных соединений
          Object.values(peersRef.current).forEach(peerConnection => {
            const senders = peerConnection.getSenders();
            senders.forEach(sender => {
              if (sender.track && sender.track.kind === 'audio') {
                const parameters = sender.getParameters();
                if (!parameters.encodings) {
                  parameters.encodings = [{}];
                }
                parameters.encodings[0].maxBitrate = newBitrate;
                sender.setParameters(parameters).catch(err =>
                  console.warn('Не удалось обновить параметры битрейта:', err)
                );
              }
            });
          });
        }
      } catch (err) {
        console.warn('Ошибка мониторинга сети:', err);
      }
    }, 5000); // Проверяем каждые 5 секунд

    networkMonitorRef.current = monitorInterval;
  };

  const stopNetworkMonitoring = () => {
    if (networkMonitorRef.current) {
      clearInterval(networkMonitorRef.current);
      networkMonitorRef.current = null;
    }
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

    // Сбрасываем состояние подключения и подключаемся заново
    setIsConnected(false);
    isConnectingRef.current = false;
    handleConnect();

    return () => {
      socket.off('voice:users');
      socket.off('voice:user-joined');
      socket.off('voice:user-left');
      socket.off('voice:user-muted');
      socket.off('voice:user-deafened');
      socket.off('voice:offer');
      socket.off('voice:answer');
      socket.off('voice:ice-candidate');

      // Отменить все requestAnimationFrame
      animationFramesRef.current.forEach(frameId => {
        if (frameId) cancelAnimationFrame(frameId);
      });
      animationFramesRef.current = [];

      // Закрыть все AudioContext и отключить источники
      audioContextsRef.current.forEach(({ context, source }) => {
        try {
          if (source) source.disconnect();
          if (context && context.state !== 'closed') context.close();
        } catch (err) {
          console.warn('Ошибка закрытия AudioContext:', err);
        }
      });
      audioContextsRef.current = [];

      // Остановить локальные потоки
      if (originalStreamRef.current) {
        originalStreamRef.current.getTracks().forEach(track => track.stop());
        originalStreamRef.current = null;
      }

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }

      // Остановить все сохраненные потоки (очищаем для переключения канала)
      allStreamsRef.current.forEach((streamObj) => {
        if (streamObj.original) {
          streamObj.original.getTracks().forEach(track => track.stop());
        }
        if (streamObj.processed) {
          streamObj.processed.getTracks().forEach(track => track.stop());
        }
      });
      allStreamsRef.current = [];

      // Остановить анализатор
      localAnalyserRef.current = null;

      // Остановить мониторинг сети
      if (networkMonitorRef.current) {
        clearInterval(networkMonitorRef.current);
        networkMonitorRef.current = null;
      }

      // Закрыть все peer соединения
      Object.values(peersRef.current).forEach(peer => {
        if (peer) peer.close();
      });
      peersRef.current = {};

      // Удалить все удаленные аудио элементы
      document.querySelectorAll('audio[id^="audio-"]').forEach(audio => {
        audio.pause();
        audio.srcObject = null;
        audio.remove();
      });

      // Покинуть голосовой канал
      socket.emit('voice:leave', { channelId: channel.id });

      // Сбрасываем isConnected для следующего подключения
      setIsConnected(false);
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

  // Улучшить SDP для максимального качества аудио
  const enhanceAudioSDP = (sdp) => {
    // Установить Opus как приоритетный кодек с максимальным качеством
    let lines = sdp.split('\r\n');

    // Найти строку с Opus и установить параметры
    const opusPayload = lines.find(line => line.includes('opus/48000'));
    if (opusPayload) {
      const payload = opusPayload.match(/:\d+ /)?.[0]?.replace(/[: ]/g, '');
      if (payload) {
        // Добавить или обновить fmtp для Opus с максимальными параметрами качества
        const fmtpIndex = lines.findIndex(line => line.includes(`a=fmtp:${payload}`));
        const fmtpLine = `a=fmtp:${payload} minptime=5;useinbandfec=1;maxaveragebitrate=${audioBitrate};stereo=1;maxplaybackrate=48000;sprop-stereo=1;cbr=1;dtx=0;useinbandfec=1;maxbandwidth=32000;maxframeSize=120;maxcapturerate=48000;maxptime=60;ptime=10;useinbandfec=1;maxaveragebitrate=${audioBitrate};stereo=1;maxplaybackrate=48000;sprop-stereo=1;cbr=1;dtx=0;useinbandfec=1;maxbandwidth=32000;maxframeSize=120;maxcapturerate=48000;maxptime=60;ptime=10;useinbandfec=1;maxaveragebitrate=${audioBitrate};stereo=1;maxplaybackrate=48000;sprop-stereo=1;cbr=1;dtx=0;useinbandfec=1;maxbandwidth=32000;maxframeSize=120;maxcapturerate=48000;maxptime=60;ptime=10;`;

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

    // Увеличить пропускную способность до максимума
    const bwIndex = lines.findIndex(line => line.startsWith('b=AS:'));
    if (bwIndex !== -1) {
      lines[bwIndex] = 'b=AS:1024'; // Увеличиваем до 1024 kbps для максимального качества
    } else {
      // Добавить после медиа-секции
      const mediaIndex = lines.findIndex(line => line.startsWith('m=audio'));
      if (mediaIndex !== -1) {
        lines.splice(mediaIndex + 1, 0, 'b=AS:1024');
      }
    }

    // Добавить дополнительные параметры для лучшего качества
    const mediaIndex = lines.findIndex(line => line.startsWith('m=audio'));
    if (mediaIndex !== -1) {
      // Добавить параметры для низкой задержки
      lines.splice(mediaIndex + 1, 0, 'a=rtcp-fb:* nack');
      lines.splice(mediaIndex + 2, 0, 'a=rtcp-fb:* nack pli');
      lines.splice(mediaIndex + 3, 0, 'a=rtcp-fb:* ccm fir');
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

      // Сохраняем AudioContext для последующего закрытия
      audioContextsRef.current.push({ context: audioContext, source });
      localAnalyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const checkMyAudioLevel = () => {
        if (!localAnalyserRef.current) return;

        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;

        // В режиме PTT не используем автоматическую детекцию голоса
        // Состояние isSpeaking контролируется только нажатием клавиши PTT
        const currentVoiceMode = localStorage.getItem('audioSettings');
        const settings = currentVoiceMode ? JSON.parse(currentVoiceMode) : {};
        const isVADMode = !settings.voiceMode || settings.voiceMode === 'vad';

        // Показывать говорение только если:
        // 1. Микрофон включен (!globalMuted)
        // 2. Уровень звука выше порога (average > 20)
        // 3. Включен режим Voice Activation (не PTT)
        if (isVADMode) {
          setIsSpeaking(!globalMuted && average > 20);
        }

        const frameId = requestAnimationFrame(checkMyAudioLevel);
        // Сохраняем только последний frameId
        if (animationFramesRef.current.length > 0) {
          animationFramesRef.current[animationFramesRef.current.length - 1] = frameId;
        } else {
          animationFramesRef.current.push(frameId);
        }
      };

      const initialFrameId = requestAnimationFrame(checkMyAudioLevel);
      animationFramesRef.current.push(initialFrameId);
    } catch (err) {
      console.warn('Не удалось анализировать локальное аудио:', err);
    }
  };

  const playRemoteAudio = async (stream, userId) => {
    // Создать аудио элемент для воспроизведения
    let audio = document.getElementById(`audio-${userId}`);
    if (!audio) {
      audio = document.createElement('audio');
      audio.id = `audio-${userId}`;
      audio.autoplay = true;
      document.body.appendChild(audio);
    }

    // Устанавливаем громкость входящего звука (0-200% преобразуется в 0-2.0)
    audio.volume = Math.min(2.0, Math.max(0, outputVolume / 100));
    audio.srcObject = stream;

    // Устанавливаем выбранное устройство вывода звука (если поддерживается)
    if (selectedSpeaker && selectedSpeaker !== 'default' && typeof audio.setSinkId === 'function') {
      try {
        await audio.setSinkId(selectedSpeaker);
        console.log('🔊 Установлены динамики:', selectedSpeaker);
      } catch (err) {
        console.warn('Не удалось установить устройство вывода:', err);
      }
    }

    console.log(`🔊 Громкость входящего звука для ${userId}:`, audio.volume);

    // Анализ громкости для индикатора говорения
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    analyser.fftSize = 512;

    // Сохраняем AudioContext для последующего закрытия
    audioContextsRef.current.push({ context: audioContext, source, userId });

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const checkAudioLevel = () => {
      // Проверяем, что AudioContext еще существует
      if (audioContext.state === 'closed') return;

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

      const frameId = requestAnimationFrame(checkAudioLevel);
      animationFramesRef.current.push(frameId);
    };

    const initialFrameId = requestAnimationFrame(checkAudioLevel);
    animationFramesRef.current.push(initialFrameId);
  };

  const handleConnect = async () => {
    // Предотвращаем двойное подключение (для StrictMode)
    if (isConnectingRef.current) {
      return;
    }

    isConnectingRef.current = true;

    try {
      // Проверяем поддержку браузера
      if (!isBrowserSupported()) {
        isConnectingRef.current = false;
        throw new Error('Ваш браузер не поддерживает голосовой чат. Пожалуйста, используйте современный браузер (Chrome, Firefox, Safari, Edge).');
      }

      // Определяем браузер для специальной конфигурации
      const browser = getBrowserInfo();

      // Базовая конфигурация аудио
      const audioConstraints = {
        echoCancellation: echoCancellation,
        noiseSuppression: noiseSuppression,
        autoGainControl: true
      };

      // Добавляем deviceId если выбрано конкретное устройство
      if (selectedMicrophone && selectedMicrophone !== 'default') {
        audioConstraints.deviceId = { exact: selectedMicrophone };
        console.log('🎤 Используется микрофон:', selectedMicrophone);
      }

      // Сначала пробуем базовую конфигурацию для максимальной совместимости
      let constraints = {
        audio: audioConstraints,
        video: false
      };

      // Для Яндекс браузера используем более простую конфигурацию
      if (browser === 'yandex') {
        const yandexAudio = {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        };
        // Добавляем deviceId для Яндекс браузера тоже
        if (selectedMicrophone && selectedMicrophone !== 'default') {
          yandexAudio.deviceId = { exact: selectedMicrophone };
        }
        constraints = {
          audio: yandexAudio,
          video: false
        };
      }

      let stream;
      try {
        // Пробуем базовую конфигурацию
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('✅ Базовый доступ к микрофону получен');
      } catch (basicError) {
        console.warn('Базовый доступ не удался, пробуем расширенную конфигурацию:', basicError);

        // Если базовая конфигурация не работает, пробуем расширенную
        const advancedAudioConstraints = {
          echoCancellation: echoCancellation,
          noiseSuppression: noiseSuppression,
          autoGainControl: true,
          sampleRate: { ideal: 48000, min: 44100 },
          channelCount: { ideal: 1, min: 1, max: 2 },
          // Добавляем только основные goog параметры для Chrome-совместимых браузеров
          googEchoCancellation: true,
          googAutoGainControl: true,
          googNoiseSuppression: noiseSuppression,
          googHighpassFilter: true,
          googTypingNoiseDetection: true,
          googAudioMirroring: false
        };

        // Добавляем deviceId в расширенную конфигурацию
        if (selectedMicrophone && selectedMicrophone !== 'default') {
          advancedAudioConstraints.deviceId = { exact: selectedMicrophone };
        }

        constraints = {
          audio: advancedAudioConstraints,
          video: false
        };

        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          console.log('✅ Расширенный доступ к микрофону получен');
        } catch (advancedError) {
          console.warn('Расширенный доступ не удался, пробуем минимальную конфигурацию:', advancedError);

          // Последняя попытка - минимальная конфигурация
          let minimalAudio = true;
          if (selectedMicrophone && selectedMicrophone !== 'default') {
            minimalAudio = { deviceId: { exact: selectedMicrophone } };
          }

          constraints = {
            audio: minimalAudio,
            video: false
          };

          stream = await navigator.mediaDevices.getUserMedia(constraints);
          console.log('✅ Минимальный доступ к микрофону получен');
        }
      }

      // Сохраняем оригинальный поток для гарантированной остановки
      originalStreamRef.current = stream;

      // Сохраняем ВСЕ потоки (для StrictMode)
      allStreamsRef.current.push({ original: stream, type: 'original' });

      // Применить дополнительную обработку к аудио
      const processedStream = await processAudioStream(stream);

      localStreamRef.current = processedStream;
      allStreamsRef.current.push({ processed: processedStream, type: 'processed' });

      setIsConnected(true);
      isConnectingRef.current = false;

      // Воспроизводим звук подключения к голосовому каналу
      try {
        const audio = new Audio('/user_join.mp3');
        audio.volume = 0.5;
        audio.play().catch(err => console.log('Не удалось воспроизвести звук подключения:', err));
      } catch (err) {
        console.log('Ошибка при воспроизведении звука подключения:', err);
      }

      // Анализировать свой собственный микрофон (используем оригинальный поток)
      startLocalAudioAnalysis(stream);

      // Запустить мониторинг качества сети
      startNetworkMonitoring();

      // Присоединиться к голосовому каналу
      socket.emit('voice:join', {
        channelId: channel.id,
        username: user?.username,
        displayName: user?.displayName,
        avatar: user?.avatar,
        badge: user?.badge,
        badgeTooltip: user?.badgeTooltip,
        userId: user?.id
      });

    } catch (err) {
      console.error('Ошибка доступа к микрофону:', err);

      let errorMessage = 'Не удалось получить доступ к микрофону. ';

      if (err.name === 'NotAllowedError') {
        errorMessage += 'Разрешение на использование микрофона было отклонено. Пожалуйста, разрешите доступ к микрофону в настройках браузера и обновите страницу.';
      } else if (err.name === 'NotFoundError') {
        errorMessage += 'Микрофон не найден. Убедитесь, что микрофон подключен и работает.';
      } else if (err.name === 'NotReadableError') {
        errorMessage += 'Микрофон используется другим приложением. Закройте другие приложения, использующие микрофон, и попробуйте снова.';
      } else if (err.name === 'OverconstrainedError') {
        errorMessage += 'Настройки микрофона не поддерживаются. Попробуйте использовать другой микрофон или обновите браузер.';
      } else if (err.name === 'SecurityError') {
        errorMessage += 'Ошибка безопасности. Убедитесь, что сайт использует HTTPS.';
      } else if (err.message.includes('getUserMedia не поддерживается')) {
        errorMessage += 'Ваш браузер не поддерживает голосовой чат. Пожалуйста, используйте современный браузер (Chrome, Firefox, Safari, Edge).';
      } else if (getBrowserInfo() === 'arc') {
        errorMessage += 'Для Arc браузера: 1) Нажмите на иконку в адресной строке (слева от URL) 2) Найдите "Микрофон" и выберите "Разрешить" 3) Обновите страницу (⌘+R). Также проверьте системные настройки macOS: Конфиденциальность и безопасность → Микрофон → убедитесь что Arc включен.';
      } else if (getBrowserInfo() === 'yandex') {
        errorMessage += 'Для Яндекс браузера: 1) Нажмите на иконку замка в адресной строке 2) Разрешите доступ к микрофону 3) Обновите страницу. Подробные инструкции: MICROPHONE_SETUP.md';
      } else {
        errorMessage += 'Проверьте разрешения браузера и убедитесь, что микрофон работает.';
      }

      // Показываем более подробное сообщение об ошибке
      alert(errorMessage);

      // Дополнительная информация в консоль для отладки
      console.error('Детали ошибки:', {
        name: err.name,
        message: err.message,
        constraint: err.constraint,
        userAgent: navigator.userAgent
      });

      // Сбрасываем флаг подключения при ошибке
      isConnectingRef.current = false;
    }
  };

  // Упрощенная обработка аудио потока для лучшей совместимости
  const processAudioStream = async (stream) => {
    try {
      // Проверяем поддержку AudioContext
      if (!window.AudioContext && !window.webkitAudioContext) {
        console.warn('AudioContext не поддерживается, используем оригинальный поток');
        return stream;
      }

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContextClass({
        sampleRate: 48000,
        latencyHint: 'interactive'
      });

      const source = audioContext.createMediaStreamSource(stream);
      const destination = audioContext.createMediaStreamDestination();

      // 1. Высокочастотный фильтр (High-pass filter) - убирает низкочастотные шумы (гул, шум кондиционера)
      const highPassFilter = audioContext.createBiquadFilter();
      highPassFilter.type = 'highpass';
      highPassFilter.frequency.value = 100; // Убираем всё ниже 100Hz
      highPassFilter.Q.value = 1.0;

      // 2. Notch фильтр для устранения гудения 50/60Hz от электросети
      const notchFilter = audioContext.createBiquadFilter();
      notchFilter.type = 'notch';
      notchFilter.frequency.value = 50; // Европейские 50Hz
      notchFilter.Q.value = 10;

      // 3. Анализатор для Noise Gate
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.3;

      // 4. Noise Gate (шумовые ворота) - настоящая реализация
      const noiseGateGain = audioContext.createGain();
      noiseGateGain.gain.value = 0; // По умолчанию закрыт

      // Используем анализатор для определения уровня сигнала
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let gateOpen = false;
      const gateThreshold = micSensitivity / 50 * 255; // Порог от 0 до 255
      const attackTime = 0.01; // 10ms
      const releaseTime = 0.1; // 100ms

      const updateNoiseGate = () => {
        analyser.getByteTimeDomainData(dataArray);

        // Вычисляем RMS (среднеквадратичное значение)
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const normalized = (dataArray[i] - 128) / 128;
          sum += normalized * normalized;
        }
        const rms = Math.sqrt(sum / dataArray.length);
        const level = rms * 255;

        const currentTime = audioContext.currentTime;

        // Открываем/закрываем ворота
        if (level > gateThreshold) {
          if (!gateOpen) {
            // Открываем ворота плавно
            noiseGateGain.gain.cancelScheduledValues(currentTime);
            noiseGateGain.gain.setValueAtTime(noiseGateGain.gain.value, currentTime);
            noiseGateGain.gain.linearRampToValueAtTime(1.0, currentTime + attackTime);
            gateOpen = true;
          }
        } else if (level < gateThreshold * 0.7) { // Гистерезис для предотвращения дребезга
          if (gateOpen) {
            // Закрываем ворота плавно
            noiseGateGain.gain.cancelScheduledValues(currentTime);
            noiseGateGain.gain.setValueAtTime(noiseGateGain.gain.value, currentTime);
            noiseGateGain.gain.linearRampToValueAtTime(0.0, currentTime + releaseTime);
            gateOpen = false;
          }
        }

        if (audioContext.state !== 'closed') {
          requestAnimationFrame(updateNoiseGate);
        }
      };
      updateNoiseGate();

      // 5. De-esser - убирает шипение
      const deEsser = audioContext.createBiquadFilter();
      deEsser.type = 'peaking';
      deEsser.frequency.value = 7000;
      deEsser.Q.value = 1.5;
      deEsser.gain.value = -3; // Подавляем шипение на 3dB

      // 6. Компрессор для выравнивания громкости
      const compressor = audioContext.createDynamicsCompressor();
      compressor.threshold.value = -24;
      compressor.knee.value = 30;
      compressor.ratio.value = 12;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.25;

      // 7. Низкочастотный фильтр (Low-pass filter) - убирает ультразвук и высокочастотные шумы
      const lowPassFilter = audioContext.createBiquadFilter();
      lowPassFilter.type = 'lowpass';
      lowPassFilter.frequency.value = 10000; // Убираем всё выше 10kHz
      lowPassFilter.Q.value = 0.7;

      // 8. Финальный усилитель
      const finalGain = audioContext.createGain();
      finalGain.gain.value = 1.5; // Усиление после обработки

      // 9. Контроль исходящей громкости (inputVolume)
      const volumeControl = audioContext.createGain();
      volumeControl.gain.value = Math.min(2.0, Math.max(0, inputVolume / 100));
      console.log('🎤 Громкость исходящего звука (микрофон):', volumeControl.gain.value);

      // 10. Лимитер для предотвращения перегрузки
      const limiter = audioContext.createDynamicsCompressor();
      limiter.threshold.value = -1;
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.001;
      limiter.release.value = 0.01;

      // ПОЛНАЯ ЦЕПОЧКА ОБРАБОТКИ (как в Discord)
      source
        .connect(highPassFilter)     // Убираем низкие частоты (гул)
        .connect(notchFilter)         // Убираем гудение сети
        .connect(analyser)            // Анализируем уровень для noise gate
        .connect(noiseGateGain)       // Шумовые ворота (главная фича!)
        .connect(deEsser)             // Убираем шипение
        .connect(compressor)          // Выравниваем громкость
        .connect(lowPassFilter)       // Убираем высокочастотные шумы
        .connect(finalGain)           // Усиливаем
        .connect(volumeControl)       // Контролируем громкость
        .connect(limiter)             // Предотвращаем перегрузку
        .connect(destination);

      // Сохраняем AudioContext для последующего закрытия
      audioContextsRef.current.push({
        context: audioContext,
        source,
        userId: 'processing'
      });

      return destination.stream;
    } catch (err) {
      console.warn('Не удалось обработать аудио, используем оригинальный поток:', err);
      return stream;
    }
  };

  const handleDisconnect = () => {
    // Отменить все requestAnimationFrame
    animationFramesRef.current.forEach(frameId => {
      if (frameId) cancelAnimationFrame(frameId);
    });
    animationFramesRef.current = [];

    // Остановить локальные потоки (и оригинальный, и обработанный)
    if (originalStreamRef.current) {
      originalStreamRef.current.getTracks().forEach(track => track.stop());
      originalStreamRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    // Остановить все сохраненные потоки
    allStreamsRef.current.forEach((streamObj) => {
      if (streamObj.original) {
        streamObj.original.getTracks().forEach(track => track.stop());
      }
      if (streamObj.processed) {
        streamObj.processed.getTracks().forEach(track => track.stop());
      }
    });
    allStreamsRef.current = [];

    // Закрыть все AudioContext и отключить источники
    audioContextsRef.current.forEach(({ context, source }) => {
      try {
        if (source) source.disconnect();
        if (context && context.state !== 'closed') context.close();
      } catch (err) {
        console.warn('Ошибка закрытия AudioContext:', err);
      }
    });
    audioContextsRef.current = [];

    // Остановить анализатор
    localAnalyserRef.current = null;

    // Остановить мониторинг сети
    stopNetworkMonitoring();

    // Закрыть все peer соединения
    Object.values(peersRef.current).forEach(peer => {
      if (peer) peer.close();
    });
    peersRef.current = {};

    // Удалить все удаленные аудио элементы
    document.querySelectorAll('audio[id^="audio-"]').forEach(audio => {
      audio.pause();
      audio.srcObject = null;
      audio.remove();
    });

    // Воспроизводим звук отключения от голосового канала
    try {
      const audio = new Audio('/user_leave.mp3');
      audio.volume = 0.5;
      audio.play().catch(err => console.log('Не удалось воспроизвести звук отключения:', err));
    } catch (err) {
      console.log('Ошибка при воспроизведении звука отключения:', err);
    }

    // Покинуть голосовой канал
    if (socket && channel) {
      socket.emit('voice:leave', { channelId: channel.id });
    }

    setIsConnected(false);
    setVoiceUsers([]);
    setSpeakingUsers(new Set());
    setIsSpeaking(false);
    isConnectingRef.current = false;
  };

  // Прокинуть функцию disconnect наверх для использования в профиле
  const onDisconnectRefRef = useRef(onDisconnectRef);
  onDisconnectRefRef.current = onDisconnectRef;

  useEffect(() => {
    if (onDisconnectRefRef.current) {
      onDisconnectRefRef.current.current = handleDisconnect;
    }
  }, []);

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
  }, [globalDeafened, socket, channel]);

  // Слушаем изменения настроек звука (мгновенное применение)
  useEffect(() => {
    const handleSettingsChange = async (e) => {
      const newSettings = e.detail;

      // Обновляем состояния
      if (newSettings.noiseSuppression !== undefined) {
        setNoiseSuppression(newSettings.noiseSuppression);
      }
      if (newSettings.echoCancellation !== undefined) {
        setEchoCancellation(newSettings.echoCancellation);
      }
      if (newSettings.audioBitrate !== undefined) {
        setAudioBitrate(newSettings.audioBitrate);
      }

      // Обработка изменения микрофона
      if (newSettings.selectedMicrophone !== undefined && newSettings.selectedMicrophone !== selectedMicrophone) {
        setSelectedMicrophone(newSettings.selectedMicrophone);

        // Если уже подключены, нужно переподключиться с новым микрофоном
        if (isConnected && socket && channel) {
          console.log('🔄 Переподключение с новым микрофоном...');
          // Отключаемся и подключаемся заново
          handleDisconnect();
          // Небольшая задержка перед переподключением
          setTimeout(() => {
            handleConnect();
          }, 500);
        }
        return; // Выходим, чтобы не применять другие настройки при переподключении
      }

      // Обработка изменения динамиков
      if (newSettings.selectedSpeaker !== undefined && newSettings.selectedSpeaker !== selectedSpeaker) {
        setSelectedSpeaker(newSettings.selectedSpeaker);

        // Обновляем sinkId для всех существующих audio элементов
        const audioElements = document.querySelectorAll('audio[id^="audio-"]');
        audioElements.forEach(async (audio) => {
          if (typeof audio.setSinkId === 'function') {
            try {
              const deviceId = newSettings.selectedSpeaker === 'default' ? '' : newSettings.selectedSpeaker;
              await audio.setSinkId(deviceId);
              console.log('🔊 Динамики обновлены для', audio.id);
            } catch (err) {
              console.warn('Не удалось обновить устройство вывода:', err);
            }
          }
        });
      }

      // Обработка изменения громкости входящего звука
      if (newSettings.outputVolume !== undefined && newSettings.outputVolume !== outputVolume) {
        setOutputVolume(newSettings.outputVolume);

        // Обновляем громкость для всех существующих audio элементов
        const audioElements = document.querySelectorAll('audio[id^="audio-"]');
        audioElements.forEach((audio) => {
          const newVolume = Math.min(2.0, Math.max(0, newSettings.outputVolume / 100));
          audio.volume = newVolume;
          console.log('🔊 Громкость обновлена для', audio.id, ':', newVolume);
        });
      }

      // Обработка изменения громкости исходящего звука (микрофона)
      if (newSettings.inputVolume !== undefined && newSettings.inputVolume !== inputVolume) {
        setInputVolume(newSettings.inputVolume);

        // Для изменения громкости микрофона нужно переподключиться
        if (isConnected && socket && channel) {
          console.log('🔄 Переподключение для применения новой громкости микрофона...');
          handleDisconnect();
          setTimeout(() => {
            handleConnect();
          }, 500);
        }
      }

      // Обработка изменения чувствительности микрофона
      if (newSettings.micSensitivity !== undefined && newSettings.micSensitivity !== micSensitivity) {
        setMicSensitivity(newSettings.micSensitivity);
        console.log('🎯 Порог активации голоса обновлен:', newSettings.micSensitivity);
        // Применяется автоматически, не нужно переподключаться
      }

      // Обработка изменения режима активации (PTT/VAD)
      if (newSettings.voiceMode !== undefined && newSettings.voiceMode !== voiceMode) {
        setVoiceMode(newSettings.voiceMode);
        console.log('🎙️ Режим активации изменен на:', newSettings.voiceMode === 'ptt' ? 'Push-to-Talk' : 'Voice Activation');

        // При переключении в режим PTT, автоматически выключаем микрофон и сбрасываем состояния
        if (newSettings.voiceMode === 'ptt' && !globalMuted) {
          setIsPttActive(false);
          setIsSpeaking(false);

          // Выключаем аудио трек
          if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
              audioTrack.enabled = false;
              console.log('🎙️ Режим PTT: микрофон выключен');
            }
          }
        }

        // При переключении обратно в VAD, включаем микрофон
        if (newSettings.voiceMode === 'vad' && !globalMuted) {
          if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
              audioTrack.enabled = true;
              console.log('🎙️ Режим VAD: микрофон включен');
            }
          }
        }
      }

      // Обработка изменения клавиши PTT
      if (newSettings.pttKey !== undefined && newSettings.pttKey !== pttKey) {
        setPttKey(newSettings.pttKey);
        console.log('⌨️ Клавиша PTT изменена на:', newSettings.pttKey);
      }

      // Если уже подключены, применяем настройки к существующему потоку
      if (localStreamRef.current && isConnected) {
        const audioTrack = localStreamRef.current.getAudioTracks()[0];
        if (audioTrack) {
          try {
            // Применяем новые constraints к треку
            await audioTrack.applyConstraints({
              echoCancellation: newSettings.echoCancellation ?? echoCancellation,
              noiseSuppression: newSettings.noiseSuppression ?? noiseSuppression,
              autoGainControl: newSettings.autoGainControl ?? true
            });
            console.log('✅ Настройки микрофона обновлены моментально');
          } catch (err) {
            console.error('Ошибка применения настроек:', err);
          }
        }

        // Обновляем битрейт для всех активных соединений
        if (newSettings.audioBitrate) {
          Object.values(peersRef.current).forEach(peer => {
            if (peer && peer.getSenders) {
              const audioSender = peer.getSenders().find(s => s.track?.kind === 'audio');
              if (audioSender) {
                const parameters = audioSender.getParameters();
                if (!parameters.encodings) {
                  parameters.encodings = [{}];
                }
                parameters.encodings[0].maxBitrate = newSettings.audioBitrate;
                audioSender.setParameters(parameters)
                  .then(() => console.log(`✅ Битрейт обновлен до ${newSettings.audioBitrate}`))
                  .catch(err => console.error('Ошибка обновления битрейта:', err));
              }
            }
          });
        }
      }
    };

    window.addEventListener('audioSettingsChanged', handleSettingsChange);
    return () => window.removeEventListener('audioSettingsChanged', handleSettingsChange);
  }, [isConnected, echoCancellation, noiseSuppression, selectedMicrophone, selectedSpeaker, inputVolume, outputVolume, micSensitivity, voiceMode, pttKey, socket, channel, globalMuted]);

  // Обработка PTT (Push-to-Talk)
  useEffect(() => {
    if (voiceMode !== 'ptt' || !isConnected) return;

    const handleKeyDown = (e) => {
      // Игнорируем, если фокус в input/textarea
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.code === pttKey && !isPttActive) {
        e.preventDefault();
        setIsPttActive(true);
        setIsSpeaking(true); // Устанавливаем состояние говорения

        // Воспроизводим звук активации PTT
        try {
          const audio = new Audio('/ptt_start.mp3');
          audio.volume = 0.3;
          audio.play().catch(err => console.log('Не удалось воспроизвести звук PTT:', err));
        } catch (err) {
          console.log('Ошибка при воспроизведении звука PTT:', err);
        }

        // Включаем микрофон (снимаем mute)
        if (localStreamRef.current) {
          const audioTrack = localStreamRef.current.getAudioTracks()[0];
          if (audioTrack) {
            audioTrack.enabled = true;
            console.log('🎙️ PTT активирован - микрофон включен');

            // Отправляем событие о том, что начали говорить
            if (socket && channel) {
              socket.emit('speaking-start', { channelId: channel._id, userId: user._id });
            }
          }
        }
      }
    };

    const handleKeyUp = (e) => {
      if (e.code === pttKey && isPttActive) {
        e.preventDefault();
        setIsPttActive(false);
        setIsSpeaking(false); // Сбрасываем состояние говорения

        // Воспроизводим звук деактивации PTT
        try {
          const audio = new Audio('/ptt_stop.mp3');
          audio.volume = 0.3;
          audio.play().catch(err => console.log('Не удалось воспроизвести звук PTT:', err));
        } catch (err) {
          console.log('Ошибка при воспроизведении звука PTT:', err);
        }

        // Выключаем микрофон (ставим mute)
        if (localStreamRef.current) {
          const audioTrack = localStreamRef.current.getAudioTracks()[0];
          if (audioTrack) {
            audioTrack.enabled = false;
            console.log('🎙️ PTT деактивирован - микрофон выключен');

            // Отправляем событие о том, что перестали говорить
            if (socket && channel) {
              socket.emit('speaking-stop', { channelId: channel._id, userId: user._id });
            }
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [voiceMode, pttKey, isPttActive, isConnected, socket, channel, user]);

  // При подключении в режиме PTT микрофон должен быть выключен по умолчанию
  useEffect(() => {
    if (isConnected && voiceMode === 'ptt' && localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack && !isPttActive) {
        audioTrack.enabled = false;
        console.log('🎙️ PTT режим: микрофон выключен по умолчанию');
      }
    }
  }, [isConnected, voiceMode, isPttActive]);

  // Голосовой канал работает в фоне
  return null;
}

export default VoiceChannel;

