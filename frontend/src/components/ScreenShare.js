import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import './ScreenShare.css';
import { SOCKET_EVENTS } from '../constants/events';
import { useVoice } from '../context/VoiceContext';

const ScreenShare = forwardRef(({ socket, channel, user, isInVoice, voiceUsers }, ref) => {
  const [isSharing, setIsSharing] = useState(false);
  const [sharingUsers, setSharingUsers] = useState(new Map()); // userId -> { stream, username }
  const [availableStreams, setAvailableStreams] = useState(new Map()); // socketId -> { username, userId }
  const [loadingStreams, setLoadingStreams] = useState(new Map()); // socketId -> true/false
  const localScreenStreamRef = useRef(null);
  const screenPeersRef = useRef({}); // Отдельные peer соединения для screen sharing
  const videoRefsMap = useRef(new Map()); // userId -> video element ref
  const sharingUsersInfoRef = useRef(new Map()); // userId -> { username } - сохраняем информацию о пользователях
  const { setIsScreenSharing, updateScreenSharingUsers } = useVoice();

  // Мемоизируем массив sharingUsers для предотвращения лишних рендеров
  const sharingUsersArray = React.useMemo(() =>
    Array.from(sharingUsers.entries()),
    [sharingUsers]
  );

  // ICE серверы для WebRTC
  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ],
    iceCandidatePoolSize: 10
  };

  // Функция для подключения к стриму по требованию
  const connectToStream = async (socketId) => {
    console.log(`🔌 Подключение к стриму пользователя (socketId: ${socketId})`);

    // Проверяем, есть ли этот стрим в доступных
    const streamInfo = availableStreams.get(socketId);
    if (!streamInfo) {
      console.log(`❌ Стрим ${socketId} недоступен`);
      return;
    }

    // Если peer соединение уже существует, закрываем его
    if (screenPeersRef.current[socketId]) {
      console.log(`🔄 Закрываем существующее peer соединение для ${socketId}`);
      screenPeersRef.current[socketId].close();
      delete screenPeersRef.current[socketId];
    }

    // Удаляем из sharingUsers если есть
    setSharingUsers(prev => {
      const newMap = new Map(prev);
      newMap.delete(socketId);
      console.log(`🗑️ Удален из sharingUsers: ${socketId}`);
      return newMap;
    });

    // Сохраняем информацию о пользователе для обработки удаленного stream
    sharingUsersInfoRef.current.set(socketId, streamInfo);
    console.log(`📝 Сохранена информация о пользователе для ${socketId}:`, streamInfo);

    // Устанавливаем состояние загрузки
    setLoadingStreams(prev => {
      const newMap = new Map(prev);
      newMap.set(socketId, true);
      console.log(`⏳ Начинаем загрузку стрима для ${socketId}`);
      return newMap;
    });

    // Создаём peer соединение и отправляем OFFER напрямую
    createScreenPeerConnection(socketId, true);
    console.log(`📤 OFFER будет отправлен пользователю ${socketId}`);
  };

  // Expose toggle function to parent
  useImperativeHandle(ref, () => ({
    toggleScreenShare: handleToggleScreenShare,
    connectToStream
  }));

  // Очистка при размонтировании компонента
  useEffect(() => {
    return () => {
      console.log('🧹 Размонтирование ScreenShare компонента');
      // Остановить демонстрацию при размонтировании
      if (localScreenStreamRef.current) {
        localScreenStreamRef.current.getTracks().forEach(track => track.stop());
        localScreenStreamRef.current = null;
      }
      // Очистить информацию о демонстрирующих
      sharingUsersInfoRef.current.clear();
      setSharingUsers(new Map());
      console.log('🗑️ Очищена информация о демонстрациях');
    };
  }, []);

  useEffect(() => {
    if (!socket || !channel) return;

    console.log('🔧 Подключение обработчиков screen sharing для канала:', channel.id);

    // Обработчики событий screen sharing
    socket.on(SOCKET_EVENTS.SCREEN_SHARE_START, handleRemoteScreenShareStart);
    socket.on(SOCKET_EVENTS.SCREEN_SHARE_STOP, handleRemoteScreenShareStop);
    socket.on(SOCKET_EVENTS.SCREEN_SHARE_NEW_VIEWER, handleNewViewer);
    socket.on(SOCKET_EVENTS.SCREEN_SHARE_OFFER, handleScreenShareOffer);
    // socket.on(SOCKET_EVENTS.SCREEN_SHARE_OFFER_REQUEST, handleScreenShareOfferRequest); // Убрано - не нужно
    socket.on(SOCKET_EVENTS.SCREEN_SHARE_ANSWER, handleScreenShareAnswer);
    socket.on(SOCKET_EVENTS.SCREEN_SHARE_ICE_CANDIDATE, handleScreenShareIceCandidate);

    console.log('✅ Обработчики screen sharing подключены');

    return () => {
      console.log('🔌 Отключение обработчиков screen sharing (размонтирование компонента)');
      socket.off(SOCKET_EVENTS.SCREEN_SHARE_START);
      socket.off(SOCKET_EVENTS.SCREEN_SHARE_STOP);
      socket.off(SOCKET_EVENTS.SCREEN_SHARE_NEW_VIEWER);
      socket.off(SOCKET_EVENTS.SCREEN_SHARE_OFFER);
      // socket.off(SOCKET_EVENTS.SCREEN_SHARE_OFFER_REQUEST); // Убрано - не нужно
      socket.off(SOCKET_EVENTS.SCREEN_SHARE_ANSWER);
      socket.off(SOCKET_EVENTS.SCREEN_SHARE_ICE_CANDIDATE);

      // Закрыть все peer соединения
      Object.values(screenPeersRef.current).forEach(peer => {
        if (peer) peer.close();
      });
      screenPeersRef.current = {};
    };
  }, [socket, channel]); // Убрали isSharing из зависимостей!

  // Улучшить SDP для максимального качества видео HD с поддержкой Safari
  const enhanceVideoSDP = (sdp) => {
    let lines = sdp.split('\r\n');

    // Проверяем браузер для определения стратегии
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

    if (isSafari) {
      console.log('🍎 Обнаружен Safari - используем совместимую конфигурацию SDP');
      // Для Safari используем более простую конфигурацию
      const bwIndex = lines.findIndex(line => line.startsWith('b=AS:'));
      if (bwIndex !== -1) {
        lines[bwIndex] = 'b=AS:8000'; // 8 Mbps для HD screen sharing
      } else {
        const mediaIndex = lines.findIndex(line => line.startsWith('m=video'));
        if (mediaIndex !== -1) {
          lines.splice(mediaIndex + 1, 0, 'b=AS:8000');
        }
      }
    } else {
      console.log('🌐 Не Safari - используем расширенную конфигурацию SDP');
      // Для Chrome/Edge используем полную конфигурацию
      const bwIndex = lines.findIndex(line => line.startsWith('b=AS:'));
      if (bwIndex !== -1) {
        lines[bwIndex] = 'b=AS:8000'; // 8 Mbps для HD screen sharing
      } else {
        const mediaIndex = lines.findIndex(line => line.startsWith('m=video'));
        if (mediaIndex !== -1) {
          lines.splice(mediaIndex + 1, 0, 'b=AS:8000');
        }
      }

      // Установить максимальный битрейт для TIAS (только для Chrome/Edge)
      const mediaIndex = lines.findIndex(line => line.startsWith('m=video'));
      if (mediaIndex !== -1) {
        lines.splice(mediaIndex + 1, 0, 'b=TIAS:8000000'); // 8 Mbps максимум
        // Добавляем x-google-start-bitrate для Chrome/Edge
        const rtpmapIndex = lines.findIndex((line, idx) => idx > mediaIndex && line.includes('rtpmap'));
        if (rtpmapIndex !== -1) {
          const codecMatch = lines[rtpmapIndex].match(/a=rtpmap:(\d+)/);
          if (codecMatch) {
            const payloadType = codecMatch[1];
            const fmtpIndex = lines.findIndex(line => line.startsWith(`a=fmtp:${payloadType}`));
            if (fmtpIndex !== -1) {
              lines[fmtpIndex] += ';x-google-start-bitrate=8000;x-google-max-bitrate=8000';
            } else {
              lines.splice(rtpmapIndex + 1, 0, `a=fmtp:${payloadType} x-google-start-bitrate=8000;x-google-max-bitrate=8000`);
            }
          }
        }
      }
    }

    return lines.join('\r\n');
  };

  const handleRemoteScreenShareStart = ({ id, username, userId }) => {
    // ВАЖНО: используем socket.id (id), а не userId, потому что WebRTC работает с socket.id
    console.log(`🖥️ ${username} начал демонстрацию экрана (socket.id: ${id}, userId: ${userId})`);

    // Показать уведомление пользователю
    console.log(`%c📺 ${username} начал демонстрацию экрана! Наведите на пользователя и нажмите "Открыть стрим"`,
      'background: #5865f2; color: white; padding: 8px 12px; border-radius: 4px; font-size: 14px; font-weight: bold;');

    // Добавляем стрим в доступные (НЕ подключаемся автоматически!)
    setAvailableStreams(prev => {
      const newMap = new Map(prev);
      newMap.set(id, { username, userId });
      return newMap;
    });

    // Обновить состояние screen sharing (используем userId для отображения в sidebar)
    updateScreenSharingUsers(channel.id, userId || id, true, { userId, username, socketId: id });

    console.log('✅ Стрим добавлен в доступные. Наведите на пользователя для подключения.');
  };

  const handleNewViewer = ({ viewerId, viewerUsername }) => {
    console.log(`👁️ Новый зритель подключился: ${viewerUsername} (socket.id: ${viewerId})`);
    console.log(`ℹ️ Новый зритель может подключиться через кнопку "Открыть стрим"`);

    // НЕ создаём peer соединение автоматически!
    // Пользователь сам решит, хочет ли он смотреть стрим
  };

  const handleRemoteScreenShareStop = ({ id }) => {
    console.log(`🛑 Пользователь (socket.id: ${id}) остановил демонстрацию экрана`);

    // Получаем userId перед удалением
    const userInfo = sharingUsersInfoRef.current.get(id);
    const userId = userInfo?.userId || id;

    // Удаляем информацию о пользователе по socket.id
    sharingUsersInfoRef.current.delete(id);

    // Удаляем из доступных стримов
    setAvailableStreams(prev => {
      const newMap = new Map(prev);
      newMap.delete(id);
      console.log('🗑️ Удален пользователь из availableStreams:', id);
      return newMap;
    });

    // Удаляем из состояния загрузки
    setLoadingStreams(prev => {
      const newMap = new Map(prev);
      newMap.delete(id);
      console.log('🗑️ Удален пользователь из loadingStreams:', id);
      return newMap;
    });

    // Обновить состояние screen sharing (используем userId для отображения в sidebar)
    updateScreenSharingUsers(channel.id, userId, false);

    // Удаляем из состояния по socket.id
    setSharingUsers(prev => {
      const newMap = new Map(prev);
      newMap.delete(id);
      console.log('🗑️ Удален пользователь из sharingUsers:', id);
      return newMap;
    });

    // Закрыть peer соединение по socket.id
    if (screenPeersRef.current[id]) {
      screenPeersRef.current[id].close();
      delete screenPeersRef.current[id];
      console.log('🔌 Закрыто peer соединение для:', id);
    }
  };

  const createScreenPeerConnection = (socketId, createOffer) => {
    if (screenPeersRef.current[socketId]) {
      console.log('⚠️ Peer соединение для', socketId, 'уже существует');
      return;
    }

    console.log(`🔌 Создание peer соединения для демонстрации экрана (socketId: ${socketId}, createOffer: ${createOffer})`);

    // Конфигурация для максимального качества с поддержкой Safari
    const config = {
      ...iceServers,
      sdpSemantics: 'unified-plan',
      // Убираем max-bundle для совместимости с Safari
      bundlePolicy: 'balanced',
      rtcpMuxPolicy: 'require'
    };

    const peerConnection = new RTCPeerConnection(config);
    screenPeersRef.current[socketId] = peerConnection;

    // Отладка состояния соединения
    peerConnection.onconnectionstatechange = () => {
      console.log(`🔗 Состояние соединения с ${socketId}:`, peerConnection.connectionState);
      if (peerConnection.connectionState === 'failed') {
        console.error('❌ WebRTC соединение провалилось для', socketId);
      }
    };

    peerConnection.oniceconnectionstatechange = () => {
      console.log(`🧊 ICE состояние с ${socketId}:`, peerConnection.iceConnectionState);
    };

    // Добавить локальный screen stream если есть (для стримера)
    if (localScreenStreamRef.current) {
      localScreenStreamRef.current.getTracks().forEach(track => {
        const sender = peerConnection.addTrack(track, localScreenStreamRef.current);

        // Установить битрейт 8 Mbps для HD качества
        if (track.kind === 'video') {
          const parameters = sender.getParameters();
          if (!parameters.encodings) {
            parameters.encodings = [{}];
          }
          // Устанавливаем максимальный битрейт 8 Mbps, WebRTC сам подстроится под сеть
          parameters.encodings[0].maxBitrate = 8000000; // 8 Mbps максимум
          parameters.encodings[0].priority = 'high';
          parameters.encodings[0].networkPriority = 'high';
          sender.setParameters(parameters).catch(err =>
            console.warn('Не удалось установить параметры видео:', err)
          );
          console.log(`➕ Добавлен локальный track для screen sharing с максимальным битрейтом 8 Mbps (createOffer: ${createOffer})`);
        }
      });
    }

    // Обработать удаленный поток
    peerConnection.ontrack = (event) => {
      const [remoteStream] = event.streams;
      const userInfo = sharingUsersInfoRef.current.get(socketId) || {};
      console.log(`📺 Получен удаленный stream от ${socketId}:`, {
        stream: remoteStream,
        username: userInfo.username,
        tracks: remoteStream.getTracks().length
      });

      // Завершаем загрузку практически мгновенно (фиксированный битрейт не требует стабилизации)
      setTimeout(() => {
        setLoadingStreams(prev => {
          const newMap = new Map(prev);
          newMap.set(socketId, false);
          console.log(`✅ Загрузка стрима завершена для ${socketId}`);
          return newMap;
        });
      }, 300); // Минимальная задержка для отображения подключения

      setSharingUsers(prev => {
        const newMap = new Map(prev);
        newMap.set(socketId, {
          stream: remoteStream,
          username: userInfo.username || 'Пользователь'
        });
        console.log('✅ SharingUsers обновлен:', Array.from(newMap.keys()));
        return newMap;
      });
    };

    // Обработать ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`🧊 Отправка ICE candidate пользователю ${socketId}`);
        socket.emit(SOCKET_EVENTS.SCREEN_SHARE_ICE_CANDIDATE, {
          candidate: event.candidate,
          to: socketId
        });
      } else {
        console.log(`✅ Все ICE candidates собраны для ${socketId}`);
      }
    };

    // Создать offer если нужно
    if (createOffer) {
      console.log(`📤 Создание OFFER для ${socketId}...`);
      peerConnection.createOffer({
        offerToReceiveVideo: true,
        offerToReceiveAudio: false
      })
        .then(offer => {
          // Модифицировать SDP для максимального качества видео
          offer.sdp = enhanceVideoSDP(offer.sdp);
          console.log(`✅ OFFER создан для ${socketId}`);
          return peerConnection.setLocalDescription(offer);
        })
        .then(() => {
          console.log(`📤 Отправка OFFER пользователю ${socketId}`);
          console.log('📡 Socket подключен?', socket?.connected);
          console.log('📋 OFFER данные:', {
            event: SOCKET_EVENTS.SCREEN_SHARE_OFFER,
            to: socketId,
            offerType: peerConnection.localDescription?.type
          });
          socket.emit(SOCKET_EVENTS.SCREEN_SHARE_OFFER, {
            offer: peerConnection.localDescription,
            to: socketId
          });
          console.log('✅ OFFER отправлен через socket');
        })
        .catch(err => console.error('❌ Ошибка создания screen share offer:', err));
    }
  };

  const handleScreenShareOffer = async ({ offer, from }) => {
    console.log(`📨 Получен OFFER для screen share от ${from}`);

    // Если мы стримим (есть локальный stream), то мы стример - обрабатываем OFFER
    if (localScreenStreamRef.current) {
      console.log(`🎥 Мы стримим - обрабатываем OFFER от зрителя ${from}`);

      // Создаём peer соединение для зрителя
      createScreenPeerConnection(from, false);
      const peerConnection = screenPeersRef.current[from];

      try {
        // Улучшить входящий SDP
        offer.sdp = enhanceVideoSDP(offer.sdp);
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        console.log(`✅ Remote description установлен для ${from}`);

        const answer = await peerConnection.createAnswer();
        // Улучшить исходящий SDP
        answer.sdp = enhanceVideoSDP(answer.sdp);
        await peerConnection.setLocalDescription(answer);
        console.log(`✅ Создан и установлен ANSWER для ${from}`);

        socket.emit(SOCKET_EVENTS.SCREEN_SHARE_ANSWER, {
          answer: peerConnection.localDescription,
          to: from
        });
        console.log(`📤 ANSWER отправлен пользователю ${from}`);
      } catch (err) {
        console.error(`❌ Ошибка обработки OFFER от ${from}:`, err);
      }
    } else {
      // Мы зритель - проверяем, есть ли этот стрим в доступных
      const streamInfo = availableStreams.get(from);
      if (!streamInfo) {
        console.log(`⚠️ OFFER получен, но стрим ${from} не в списке доступных. Игнорируем.`);
        return;
      }

      console.log(`👀 Мы зритель - обрабатываем OFFER от стримера ${from}`);

      // Создаём peer соединение
      createScreenPeerConnection(from, false);
      const peerConnection = screenPeersRef.current[from];

      try {
        // Улучшить входящий SDP
        offer.sdp = enhanceVideoSDP(offer.sdp);
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        console.log(`✅ Remote description установлен для ${from}`);

        const answer = await peerConnection.createAnswer();
        // Улучшить исходящий SDP
        answer.sdp = enhanceVideoSDP(answer.sdp);
        await peerConnection.setLocalDescription(answer);
        console.log(`✅ Создан и установлен ANSWER для ${from}`);

        socket.emit(SOCKET_EVENTS.SCREEN_SHARE_ANSWER, {
          answer: peerConnection.localDescription,
          to: from
        });
        console.log(`📤 ANSWER отправлен пользователю ${from}`);

        // Удаляем стрим из доступных после успешного подключения
        setAvailableStreams(prev => {
          const newMap = new Map(prev);
          newMap.delete(from);
          console.log(`✅ Стрим ${from} удален из доступных после подключения`);
          return newMap;
        });
      } catch (err) {
        console.error(`❌ Ошибка обработки OFFER от ${from}:`, err);
      }
    }
  };

  // handleScreenShareOfferRequest больше не нужна - убрана

  const handleScreenShareAnswer = async ({ answer, from }) => {
    console.log(`📨 Получен ANSWER для screen share от ${from}`);
    const peerConnection = screenPeersRef.current[from];
    if (peerConnection) {
      try {
        // Улучшить входящий SDP
        answer.sdp = enhanceVideoSDP(answer.sdp);
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        console.log(`✅ ANSWER установлен для ${from}`);
      } catch (err) {
        console.error('❌ Ошибка обработки screen share answer:', err);
      }
    } else {
      console.error('❌ Peer соединение не найдено для', from);
    }
  };

  const handleScreenShareIceCandidate = async ({ candidate, from }) => {
    console.log(`🧊 Получен ICE candidate от ${from}`);
    const peerConnection = screenPeersRef.current[from];
    if (peerConnection) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        console.log(`✅ ICE candidate добавлен для ${from}`);
      } catch (err) {
        console.error('❌ Ошибка добавления screen share ICE candidate:', err);
      }
    } else {
      console.log(`ℹ️ ICE candidate от ${from} получен, но peer соединение еще не создано (это нормально)`);
    }
  };

  const startScreenShare = async () => {
    try {
      // Запросить доступ к экрану с HD качеством
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          displaySurface: 'monitor',
          width: { ideal: 1920, max: 1920 }, // HD 1080p максимум
          height: { ideal: 1080, max: 1080 }, // HD 1080p максимум
          frameRate: { ideal: 30, max: 30 } // 30 FPS для стабильности
        },
        audio: false
      });

      localScreenStreamRef.current = stream;
      setIsSharing(true);
      setIsScreenSharing(true);

      // Обновить состояние screen sharing
      updateScreenSharingUsers(channel.id, user?.id, true, { userId: user?.id, username: user?.username, socketId: socket.id });

      // Уведомить других пользователей
      socket.emit(SOCKET_EVENTS.SCREEN_SHARE_START, {
        channelId: channel.id,
        username: user?.username,
        userId: user?.id
      });

      // НЕ создаём peer соединения автоматически!
      // Пользователи сами будут подключаться через кнопку "Открыть стрим"
      console.log('✅ Стрим начат. Пользователи могут подключиться через кнопку "Открыть стрим"');

      // Отслеживать остановку демонстрации экрана (когда пользователь нажимает "Прекратить демонстрацию")
      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };

    } catch (err) {
      console.error('Ошибка доступа к экрану:', err);
      let errorMessage = 'Не удалось получить доступ к экрану. ';

      if (err.name === 'NotAllowedError') {
        errorMessage += 'Разрешение на демонстрацию экрана было отклонено.';
      } else if (err.name === 'NotFoundError') {
        errorMessage += 'Не удалось найти источник для демонстрации.';
      } else {
        errorMessage += 'Проверьте разрешения браузера.';
      }

      alert(errorMessage);
    }
  };

  const stopScreenShare = () => {
    // Остановить локальный поток
    if (localScreenStreamRef.current) {
      localScreenStreamRef.current.getTracks().forEach(track => track.stop());
      localScreenStreamRef.current = null;
    }

    // Обновить состояние screen sharing
    if (channel) {
      updateScreenSharingUsers(channel.id, user?.id, false);
    }

    // Уведомить других пользователей
    if (socket && channel) {
      socket.emit(SOCKET_EVENTS.SCREEN_SHARE_STOP, {
        channelId: channel.id
      });
    }

    // Закрыть все screen share peer соединения
    Object.values(screenPeersRef.current).forEach(peer => {
      if (peer) peer.close();
    });
    screenPeersRef.current = {};

    setIsSharing(false);
    setIsScreenSharing(false);
  };

  const handleToggleScreenShare = () => {
    if (isSharing) {
      stopScreenShare();
    } else {
      startScreenShare();
    }
  };

  // Отладка: выводим текущее состояние (только при изменении количества пользователей)
  const prevSharingCountRef = useRef(0);
  useEffect(() => {
    if (prevSharingCountRef.current !== sharingUsers.size) {
      console.log('📊 Изменение состояния ScreenShare:', {
        sharingUsersCount: sharingUsers.size,
        sharingUserIds: Array.from(sharingUsers.keys()),
        isInVoice,
        channelId: channel?.id
      });
      prevSharingCountRef.current = sharingUsers.size;
    }
  }, [sharingUsers, isInVoice, channel]);

  return (
    <div className="screen-share-container">
      {/* Отображение демонстрируемых экранов */}
      {sharingUsers.size > 0 ? (
        <div className="screen-share-viewers">
          {sharingUsersArray.map(([userId, data]) => {
            const isLoading = loadingStreams.get(userId);
            return (
            <div key={userId} className="screen-share-viewer">
              {/* Лоадер показывается пока видео загружается */}
              {isLoading && (
                <div className="screen-share-loader">
                  <div className="screen-share-spinner"></div>
                  <div className="screen-share-loader-text">
                    Подключение к стриму...
                  </div>
                </div>
              )}
              <video
                ref={(el) => {
                  if (el && data.stream && el.srcObject !== data.stream) {
                    el.srcObject = data.stream;
                    videoRefsMap.current.set(userId, el);
                    // Принудительно воспроизводим видео
                    el.play().catch(err => console.log('Автовоспроизведение:', err));
                    console.log('✅ Видео stream установлен для пользователя:', userId);
                  }
                }}
                autoPlay
                playsInline
                muted={false}
                className="screen-share-video"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain'
                }}
              />
              <div className="screen-share-overlay">
                <span className="screen-share-username">
                  {data.username || 'Пользователь'} демонстрирует экран
                </span>
                <button
                  className="screen-share-close-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Скрываем видео (минимизируем)
                    const viewer = e.target.closest('.screen-share-viewer');
                    if (viewer) {
                      viewer.style.display = 'none';
                    }
                  }}
                  title="Свернуть (не прекращает трансляцию)"
                >
                  ✕
                </button>
              </div>
            </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
});

ScreenShare.displayName = 'ScreenShare';

export default ScreenShare;

