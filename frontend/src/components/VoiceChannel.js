import React, { useState, useEffect, useRef } from 'react';
import './VoiceChannel.css';

function VoiceChannel({ socket, channel, username }) {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [voiceUsers, setVoiceUsers] = useState([]);
  const [speakingUsers, setSpeakingUsers] = useState(new Set());
  const [noiseSuppression, setNoiseSuppression] = useState(true);
  const [echoCancellation, setEchoCancellation] = useState(true);
  const [micSensitivity, setMicSensitivity] = useState(20); // Порог для определения речи
  const [audioBitrate, setAudioBitrate] = useState(128000); // Битрейт в kbps
  const [showSettings, setShowSettings] = useState(false);

  const localStreamRef = useRef(null);
  const peersRef = useRef({});
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const audioCheckIntervalRef = useRef(null);

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
    socket.on('voice:offer', handleOffer);
    socket.on('voice:answer', handleAnswer);
    socket.on('voice:ice-candidate', handleIceCandidate);

    return () => {
      socket.off('voice:users');
      socket.off('voice:user-joined');
      socket.off('voice:user-left');
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

      // Присоединиться к голосовому каналу
      socket.emit('voice:join', {
        channelId: channel.id,
        username
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

    // Закрыть все peer соединения
    Object.values(peersRef.current).forEach(peer => peer.close());
    peersRef.current = {};

    // Удалить все удаленные аудио элементы
    voiceUsers.forEach(user => {
      const audio = document.getElementById(`audio-${user.id}`);
      if (audio) audio.remove();
    });

    // Покинуть голосовой канал
    socket.emit('voice:leave', { channelId: channel.id });

    setIsConnected(false);
    setVoiceUsers([]);
    setSpeakingUsers(new Set());
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  // Применить настройки звука (требует переподключения)
  const applyAudioSettings = async () => {
    if (!isConnected || !localStreamRef.current) return;

    try {
      // Остановить старый поток
      localStreamRef.current.getTracks().forEach(track => track.stop());

      // Получить новый поток с обновленными настройками
      const constraints = {
        audio: {
          echoCancellation: echoCancellation,
          noiseSuppression: noiseSuppression,
          autoGainControl: true,
          sampleRate: { ideal: 48000 },
          sampleSize: { ideal: 16 },
          channelCount: { ideal: 2 },
          latency: { ideal: 0.01 },
          volume: { ideal: 1.0 }
        },
        video: false
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      const processedStream = await processAudioStream(newStream);

      localStreamRef.current = processedStream;

      // Обновить треки во всех peer соединениях с новыми параметрами
      Object.values(peersRef.current).forEach(peerConnection => {
        const sender = peerConnection.getSenders().find(s => s.track?.kind === 'audio');
        if (sender && processedStream.getAudioTracks()[0]) {
          sender.replaceTrack(processedStream.getAudioTracks()[0]);

          // Обновить параметры битрейта
          const parameters = sender.getParameters();
          if (!parameters.encodings) {
            parameters.encodings = [{}];
          }
          parameters.encodings[0].maxBitrate = audioBitrate;
          parameters.encodings[0].priority = 'high';
          parameters.encodings[0].networkPriority = 'high';
          sender.setParameters(parameters).catch(err =>
            console.warn('Не удалось обновить параметры:', err)
          );
        }
      });

      alert('✅ Настройки звука применены! Качество улучшено.');
    } catch (err) {
      console.error('Ошибка применения настроек:', err);
      alert('❌ Не удалось применить настройки звука');
    }
  };

  return (
    <div className="voice-channel">
      <div className="voice-header">
        <div className="voice-header-info">
          <span className="voice-icon">🔊</span>
          <h3>{channel.name}</h3>
        </div>
      </div>

      <div className="voice-content">
        {!isConnected ? (
          <div className="voice-connect">
            <div className="voice-connect-icon">🎤</div>
            <h2>Голосовой канал</h2>
            <p>Подключитесь к голосовому каналу, чтобы начать общение</p>
            <button className="connect-btn" onClick={handleConnect}>
              Подключиться
            </button>
          </div>
        ) : (
          <div className="voice-active">
            <div className="voice-users-list">
              <h4>В голосовом канале ({voiceUsers.length + 1})</h4>

              <div className="voice-user-item me">
                <div className="voice-user-avatar">
                  {username[0].toUpperCase()}
                </div>
                <div className="voice-user-info">
                  <span className="voice-user-name">{username} (вы)</span>
                  <span className="voice-user-status">
                    {isMuted ? '🔇 Выключен' : '🎤 Включен'}
                  </span>
                </div>
              </div>

              {voiceUsers.map(user => (
                <div
                  key={user.id}
                  className={`voice-user-item ${speakingUsers.has(user.id) ? 'speaking' : ''}`}
                >
                  <div className="voice-user-avatar">
                    {user.username[0].toUpperCase()}
                  </div>
                  <div className="voice-user-info">
                    <span className="voice-user-name">{user.username}</span>
                    <span className="voice-user-status">
                      {speakingUsers.has(user.id) ? '🗣️ Говорит' : '🎧 Слушает'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Настройки звука */}
            <div className="voice-settings">
              <button
                className="settings-toggle"
                onClick={() => setShowSettings(!showSettings)}
              >
                ⚙️ {showSettings ? 'Скрыть' : 'Настройки звука'}
              </button>

              {showSettings && (
                <div className="settings-panel">
                  <div className="setting-item">
                    <label>
                      <input
                        type="checkbox"
                        checked={noiseSuppression}
                        onChange={(e) => setNoiseSuppression(e.target.checked)}
                      />
                      <span>🔊 Шумоподавление</span>
                    </label>
                  </div>

                  <div className="setting-item">
                    <label>
                      <input
                        type="checkbox"
                        checked={echoCancellation}
                        onChange={(e) => setEchoCancellation(e.target.checked)}
                      />
                      <span>🔄 Подавление эха</span>
                    </label>
                  </div>

                  <div className="setting-item slider-item">
                    <label>
                      <span>🎚️ Чувствительность микрофона: {micSensitivity}</span>
                      <input
                        type="range"
                        min="5"
                        max="50"
                        value={micSensitivity}
                        onChange={(e) => setMicSensitivity(Number(e.target.value))}
                      />
                      <small>Низкая ← → Высокая</small>
                    </label>
                  </div>

                  <div className="setting-item slider-item">
                    <label>
                      <span>🎵 Качество звука: {Math.round(audioBitrate / 1000)} kbps</span>
                      <input
                        type="range"
                        min="64000"
                        max="256000"
                        step="8000"
                        value={audioBitrate}
                        onChange={(e) => setAudioBitrate(Number(e.target.value))}
                      />
                      <small>Экономный (64) ← → Высокое (256)</small>
                    </label>
                  </div>

                  <button
                    className="apply-settings-btn"
                    onClick={applyAudioSettings}
                  >
                    🔄 Применить настройки
                  </button>
                </div>
              )}
            </div>

            <div className="voice-controls">
              <button
                className={`voice-control-btn ${isMuted ? 'muted' : ''}`}
                onClick={toggleMute}
                title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
              >
                {isMuted ? '🔇' : '🎤'}
              </button>
              <button
                className="voice-control-btn settings-btn"
                onClick={() => setShowSettings(!showSettings)}
                title="Настройки"
              >
                ⚙️
              </button>
              <button
                className="voice-control-btn disconnect"
                onClick={handleDisconnect}
                title="Отключиться"
              >
                📞
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default VoiceChannel;

