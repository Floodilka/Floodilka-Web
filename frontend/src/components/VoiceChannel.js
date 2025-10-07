import React, { useState, useEffect, useRef } from 'react';
import './VoiceChannel.css';

function VoiceChannel({ socket, channel, user, globalMuted, globalDeafened, onDisconnectRef, onSpeakingUpdate }) {
  const [isConnected, setIsConnected] = useState(false);
  const [voiceUsers, setVoiceUsers] = useState([]);
  const [speakingUsers, setSpeakingUsers] = useState(new Set());
  const [isSpeaking, setIsSpeaking] = useState(false);

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
        micSensitivity: settings.micSensitivity ?? 15,
        audioBitrate: settings.audioBitrate ?? 512000,
        audioQuality: settings.audioQuality ?? 'ultra'
      };
    }
    return {
      noiseSuppression: true,
      echoCancellation: true,
      micSensitivity: 15,
      audioBitrate: 512000, // Максимальный битрейт по умолчанию
      audioQuality: 'ultra'
    };
  };

  const initialSettings = loadAudioSettings();
  const [noiseSuppression, setNoiseSuppression] = useState(initialSettings.noiseSuppression);
  const [echoCancellation, setEchoCancellation] = useState(initialSettings.echoCancellation);
  const [micSensitivity] = useState(initialSettings.micSensitivity);
  const [audioBitrate, setAudioBitrate] = useState(initialSettings.audioBitrate);
  const [audioQuality] = useState(initialSettings.audioQuality);
  const [networkQuality, setNetworkQuality] = useState('good'); // Качество сети: poor, good, excellent

  const localStreamRef = useRef(null);
  const peersRef = useRef({});
  const localAnalyserRef = useRef(null);
  const networkMonitorRef = useRef(null);

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
        let totalBytesReceived = 0;
        let totalPacketsLost = 0;
        let totalPacketsSent = 0;

        stats.forEach(report => {
          if (report.type === 'inbound-rtp' && report.mediaType === 'audio') {
            totalBytesReceived += report.bytesReceived || 0;
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
      // Проверяем поддержку браузера
      if (!isBrowserSupported()) {
        throw new Error('Ваш браузер не поддерживает голосовой чат. Пожалуйста, используйте современный браузер (Chrome, Firefox, Safari, Edge).');
      }

      // Определяем браузер для специальной конфигурации
      const browser = getBrowserInfo();
      console.log('Обнаружен браузер:', browser);

      // Сначала пробуем базовую конфигурацию для максимальной совместимости
      let constraints = {
        audio: {
          echoCancellation: echoCancellation,
          noiseSuppression: noiseSuppression,
          autoGainControl: true
        },
        video: false
      };

      // Для Яндекс браузера используем более простую конфигурацию
      if (browser === 'yandex') {
        constraints = {
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          },
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
        constraints = {
          audio: {
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
          },
          video: false
        };

        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          console.log('✅ Расширенный доступ к микрофону получен');
        } catch (advancedError) {
          console.warn('Расширенный доступ не удался, пробуем минимальную конфигурацию:', advancedError);

          // Последняя попытка - минимальная конфигурация
          constraints = {
            audio: true,
            video: false
          };

          stream = await navigator.mediaDevices.getUserMedia(constraints);
          console.log('✅ Минимальный доступ к микрофону получен');
        }
      }

      // Применить дополнительную обработку к аудио
      const processedStream = await processAudioStream(stream);

      localStreamRef.current = processedStream;
      setIsConnected(true);

      // Анализировать свой собственный микрофон
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

      // 1. Предварительный усилитель с автоматической регулировкой усиления
      const preAmp = audioContext.createGain();
      preAmp.gain.value = 1.2; // Небольшое предварительное усиление

      // 2. Высокочастотный фильтр (High-pass filter) - убирает низкочастотные шумы
      const highPassFilter = audioContext.createBiquadFilter();
      highPassFilter.type = 'highpass';
      highPassFilter.frequency.value = 85; // Оптимизированная частота
      highPassFilter.Q.value = 0.7; // Более крутой спад

      // 3. Шумовые ворота (Noise Gate) - убирают фоновый шум
      const noiseGate = audioContext.createDynamicsCompressor();
      noiseGate.threshold.value = -65; // Более чувствительный порог
      noiseGate.knee.value = 2;
      noiseGate.ratio.value = 25; // Более агрессивное подавление
      noiseGate.attack.value = 0.0005; // Быстрее срабатывание
      noiseGate.release.value = 0.15; // Плавнее отпускание

      // 4. Многочастотный эквалайзер (5 полос)
      const eq1 = audioContext.createBiquadFilter(); // Суббасы (60-250 Гц)
      eq1.type = 'lowshelf';
      eq1.frequency.value = 200;
      eq1.gain.value = 1.5; // Легкое усиление суббасов

      const eq2 = audioContext.createBiquadFilter(); // Низкие средние (250-1000 Гц)
      eq2.type = 'peaking';
      eq2.frequency.value = 500;
      eq2.Q.value = 0.8;
      eq2.gain.value = 2; // Усиление низких средних

      const eq3 = audioContext.createBiquadFilter(); // Средние (1000-4000 Гц) - голосовой диапазон
      eq3.type = 'peaking';
      eq3.frequency.value = 2000;
      eq3.Q.value = 1.2;
      eq3.gain.value = 4; // Максимальное усиление голосового диапазона

      const eq4 = audioContext.createBiquadFilter(); // Высокие средние (4000-8000 Гц)
      eq4.type = 'peaking';
      eq4.frequency.value = 5000;
      eq4.Q.value = 1.0;
      eq4.gain.value = 2.5; // Усиление четкости

      const eq5 = audioContext.createBiquadFilter(); // Высокие (8000+ Гц)
      eq5.type = 'highshelf';
      eq5.frequency.value = 8000;
      eq5.gain.value = 1.5; // Легкое усиление высоких

      // 5. Низкочастотный фильтр (Low-pass filter) - убирает высокочастотные шумы
      const lowPassFilter = audioContext.createBiquadFilter();
      lowPassFilter.type = 'lowpass';
      lowPassFilter.frequency.value = 12000; // Расширенный диапазон для лучшего качества
      lowPassFilter.Q.value = 0.5;

      // 6. Компрессор для выравнивания громкости (более мягкий)
      const compressor = audioContext.createDynamicsCompressor();
      compressor.threshold.value = -25; // Более мягкий порог
      compressor.knee.value = 15; // Более мягкое колено
      compressor.ratio.value = 3.5; // Менее агрессивное сжатие
      compressor.attack.value = 0.005; // Немного медленнее атака
      compressor.release.value = 0.15; // Плавнее отпускание

      // 7. Дополнительный компрессор для голоса (Vocal Compressor)
      const vocalCompressor = audioContext.createDynamicsCompressor();
      vocalCompressor.threshold.value = -20;
      vocalCompressor.knee.value = 5;
      vocalCompressor.ratio.value = 2.5;
      vocalCompressor.attack.value = 0.01;
      vocalCompressor.release.value = 0.1;

      // 8. Лимитер для предотвращения клиппинга (более мягкий)
      const limiter = audioContext.createDynamicsCompressor();
      limiter.threshold.value = -2; // Более мягкий лимит
      limiter.knee.value = 1;
      limiter.ratio.value = 15; // Менее агрессивное ограничение
      limiter.attack.value = 0.0005; // Очень быстрая атака
      limiter.release.value = 0.02; // Быстрое отпускание

      // 9. Финальный усилитель с нормализацией
      const finalGain = audioContext.createGain();
      finalGain.gain.value = 0.95; // Легкое снижение для предотвращения перегрузки

      // 10. Дополнительный фильтр для устранения артефактов
      const deEsser = audioContext.createBiquadFilter();
      deEsser.type = 'peaking';
      deEsser.frequency.value = 6000; // Частота шипения
      deEsser.Q.value = 2.0;
      deEsser.gain.value = -1.5; // Легкое подавление шипения

      // Упрощенная цепочка обработки для лучшей совместимости
      source
        .connect(highPassFilter)
        .connect(compressor)
        .connect(finalGain)
        .connect(destination);

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

    // Остановить мониторинг сети
    stopNetworkMonitoring();

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
  }, [isConnected, echoCancellation, noiseSuppression]);

  // Голосовой канал теперь скрыт - работает в фоне
  return null;
}

export default VoiceChannel;

