import React, { useState, useEffect, useRef } from 'react';
import './UserSettingsModal.css';
import api from '../services/api';
import { createProcessingGraph } from '../voice/audioProcessing';

const BACKEND_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : `${window.location.protocol}//${window.location.hostname}`;

const buildAuthHeaders = (extra = {}) => {
  let token = null;
  try {
    token = localStorage.getItem('token');
  } catch (err) {
    // storage недоступно
  }

  return {
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...extra
  };
};

function UserSettingsModal({ user, onClose, onLogout, onAvatarUpdate }) {
  const [uploading, setUploading] = useState(false);
  const [isEditingDisplayName, setIsEditingDisplayName] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState('');
  const [displayNameError, setDisplayNameError] = useState('');

  // Состояния для вкладок
  const [activeTab, setActiveTab] = useState('account');

  // Состояние для поиска
  const [searchQuery, setSearchQuery] = useState('');

  // Обработка изменения поискового запроса
  const handleSearchChange = (value) => {
    setSearchQuery(value);

    // Если поисковый запрос точно совпадает с названием вкладки, переключаемся на неё
    if (value.trim()) {
      const exactMatch = navigationItems.find(item =>
        item.label.toLowerCase() === value.toLowerCase().trim()
      );
      if (exactMatch) {
        setActiveTab(exactMatch.id);
      }
    }
  };

  // Функция для фильтрации элементов навигации по поисковому запросу
  const filterNavigationItems = (items) => {
    if (!searchQuery.trim()) return items;

    const query = searchQuery.toLowerCase().trim();
    return items.filter(item =>
      item.label.toLowerCase().includes(query) ||
      item.description?.toLowerCase().includes(query)
    );
  };

  // Элементы навигации с описаниями для поиска
  const navigationItems = [
    {
      id: 'account',
      label: 'Моя учётная запись',
      description: 'Профиль, аватар, отображение имени'
    },
    {
      id: 'audio',
      label: 'Голос и видео',
      description: 'Микрофон, динамики, громкость, качество звука'
    },
    {
      id: 'chat',
      label: 'Чат',
      description: 'Настройки сообщений, форматирование'
    },
    {
      id: 'notifications',
      label: 'Уведомления',
      description: 'Звуки, всплывающие окна, email'
    },
    {
      id: 'hotkeys',
      label: 'Горячие клавиши',
      description: 'Клавиши быстрого доступа'
    },
    {
      id: 'language',
      label: 'Язык',
      description: 'Язык интерфейса, регион'
    },
    {
      id: 'streamer',
      label: 'Режим стримера',
      description: 'Скрытие личной информации'
    },
    {
      id: 'advanced',
      label: 'Расширенные',
      description: 'Дополнительные настройки, отладка'
    }
  ];

  const userNavItems = navigationItems.filter(item => ['account', 'audio'].includes(item.id));

  // Состояния для настроек звука
  const [audioSettings, setAudioSettings] = useState(() => {
    const saved = localStorage.getItem('audioSettings');
    return saved ? JSON.parse(saved) : {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      selectedMicrophone: 'default',
      selectedSpeaker: 'default',
      inputVolume: 100,  // Громкость исходящего звука (микрофона) 0-200%
      outputVolume: 100,  // Громкость входящего звука (динамиков) 0-200%
      micSensitivity: 0,  // Порог активации голоса (Voice Activation) 0-50
      voiceMode: 'vad',  // Режим активации: 'vad' (Voice Activation) или 'ptt' (Push-to-Talk)
      pttKey: 'ControlLeft',  // Клавиша для PTT (по умолчанию Left Ctrl)
      audioBitrate: 64000,  // Битрейт для речи (64k оптимально)
      audioProfile: 'speech'  // Профиль звука: 'speech' или 'music'
    };
  });

  // Состояния для устройств
  const [audioDevices, setAudioDevices] = useState({
    microphones: [],
    speakers: []
  });
  const [isLoadingDevices, setIsLoadingDevices] = useState(true);
  const [isMicTesting, setIsMicTesting] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [testStream, setTestStream] = useState(null);
  const [testAudioContext, setTestAudioContext] = useState(null);

  // Состояния для тестового режима (loopback)
  const [isTestMode, setIsTestMode] = useState(false);
  const [loopbackStream, setLoopbackStream] = useState(null);
  const [loopbackAudioElement, setLoopbackAudioElement] = useState(null);
  const loopbackProcessingRef = useRef(null); // Граф обработки для реактивности
  const loopbackOutputVolumeRef = useRef(null); // Узел громкости для реактивности

  // Состояния для PTT
  const [isRecordingKey, setIsRecordingKey] = useState(false);
  const [pressedKeys, setPressedKeys] = useState(new Set());

  // Состояния для управления тегами (только для puncher)
  const [targetUsername, setTargetUsername] = useState('');
  const [badgeText, setBadgeText] = useState('');
  const [badgeTooltipText, setBadgeTooltipText] = useState('');
  const [badgeError, setBadgeError] = useState('');
  const [badgeSuccess, setBadgeSuccess] = useState('');
  const [isAssigningBadge, setIsAssigningBadge] = useState(false);

  // Актуальные данные пользователя
  const [currentUser, setCurrentUser] = useState(user);

  const isPuncher = currentUser?.username === 'puncher';

  // Функция загрузки списка аудиоустройств
  const loadAudioDevices = async () => {
    try {
      setIsLoadingDevices(true);

      // Быстрая загрузка без запроса разрешений (для ускорения)
      const devices = await navigator.mediaDevices.enumerateDevices();

      const microphones = devices
        .filter(device => device.kind === 'audioinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Микрофон ${device.deviceId.substring(0, 5)}`,
          groupId: device.groupId
        }));

      const speakers = devices
        .filter(device => device.kind === 'audiooutput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Динамик ${device.deviceId.substring(0, 5)}`,
          groupId: device.groupId
        }));

      // Добавляем устройство по умолчанию в начало списка (только если его еще нет)
      const hasDefaultMic = microphones.some(mic => mic.deviceId === 'default');
      if (!hasDefaultMic) {
        microphones.unshift({
          deviceId: 'default',
          label: 'По умолчанию',
          groupId: ''
        });
      }

      const hasDefaultSpeaker = speakers.some(speaker => speaker.deviceId === 'default');
      if (!hasDefaultSpeaker) {
        speakers.unshift({
          deviceId: 'default',
          label: 'По умолчанию',
          groupId: ''
        });
      }

      setAudioDevices({
        microphones,
        speakers
      });

      console.log('✅ Загружено устройств:', {
        microphones: microphones.length,
        speakers: speakers.length
      });

      // Минимальная задержка для плавности скелетона
      setTimeout(() => {
        setIsLoadingDevices(false);
      }, 200);

    } catch (error) {
      console.error('Ошибка загрузки аудиоустройств:', error);
      // В случае ошибки показываем хотя бы устройство по умолчанию
      setAudioDevices({
        microphones: [{ deviceId: 'default', label: 'По умолчанию', groupId: '' }],
        speakers: [{ deviceId: 'default', label: 'По умолчанию', groupId: '' }]
      });
      setIsLoadingDevices(false);
    }
  };

  // Загрузка аудиоустройств при открытии вкладки звука
  // Обработчик ESC для закрытия настроек
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    if (activeTab === 'audio') {
      loadAudioDevices();

      // Слушаем изменения подключенных устройств
      const handleDeviceChange = () => {
        console.log('🔄 Обнаружено изменение аудиоустройств');
        loadAudioDevices();
      };

      navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);

      return () => {
        navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
      };
    }
  }, [activeTab]);

  // Автоматический запуск мониторинга микрофона при открытии вкладки звука
  useEffect(() => {
    if (activeTab === 'audio' && !isMicTesting) {
      // Небольшая задержка, чтобы устройства успели загрузиться
      const timer = setTimeout(() => {
        startMicMonitoring();
      }, 500);

      return () => {
        clearTimeout(timer);
      };
    } else if (activeTab !== 'audio') {
      // Останавливаем мониторинг и тестовый режим при переходе на другую вкладку
      if (isMicTesting) {
        stopMicMonitoring();
      }
      if (isTestMode) {
        stopTestMode();
      }
    }
  }, [activeTab, audioSettings.selectedMicrophone, isMicTesting, isTestMode]);

  // Очистка тестового потока при закрытии модального окна
  useEffect(() => {
    return () => {
      if (testStream) {
        testStream.getTracks().forEach(track => track.stop());
      }
      if (testAudioContext && testAudioContext.state !== 'closed') {
        testAudioContext.close();
      }
    };
  }, [testStream, testAudioContext]);

  // Загрузка актуальных данных пользователя при открытии
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/auth/me`, {
          headers: buildAuthHeaders(),
          credentials: 'include'
        });

        if (response.ok) {
          const userData = await response.json();
          const updatedUser = {
            ...userData,
            blockedUsers: userData.blockedUsers || []
          };
          setCurrentUser(updatedUser);
          // Обновить в localStorage
          try {
            localStorage.setItem('user', JSON.stringify(updatedUser));
          } catch (err) {
            console.warn('Не удалось обновить пользователя в storage из модального окна', err);
          }
          if (onAvatarUpdate) {
            onAvatarUpdate(updatedUser);
          }
        }
      } catch (error) {
        console.error('Ошибка загрузки данных пользователя:', error);
      }
    };

    fetchUserData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ========== РЕАКТИВНОЕ ПРИМЕНЕНИЕ НАСТРОЕК В ТЕСТОВОМ РЕЖИМЕ ==========
  useEffect(() => {
    if (!isTestMode || !loopbackProcessingRef.current) {
      return;
    }

    // Применяем изменения микрофона в реальном времени
    if (loopbackProcessingRef.current.updateInputVolume) {
      loopbackProcessingRef.current.updateInputVolume(audioSettings.inputVolume);
    }

    if (loopbackProcessingRef.current.updateMicSensitivity) {
      loopbackProcessingRef.current.updateMicSensitivity(audioSettings.micSensitivity);
    }

    // Применяем изменения громкости выхода
    if (loopbackOutputVolumeRef.current) {
      const newVolume = Math.min(1.0, Math.max(0, audioSettings.outputVolume / 100));
      const currentTime = loopbackProcessingRef.current.context.currentTime;
      loopbackOutputVolumeRef.current.gain.cancelScheduledValues(currentTime);
      loopbackOutputVolumeRef.current.gain.setValueAtTime(
        loopbackOutputVolumeRef.current.gain.value,
        currentTime
      );
      loopbackOutputVolumeRef.current.gain.linearRampToValueAtTime(newVolume, currentTime + 0.05);
    }

    // Применяем изменение выходного устройства
    if (loopbackAudioElement && audioSettings.selectedSpeaker && typeof loopbackAudioElement.setSinkId === 'function') {
      loopbackAudioElement.setSinkId(audioSettings.selectedSpeaker).catch(err => {
        console.warn('Не удалось изменить выходное устройство:', err);
      });
    }

    console.log('🔄 Настройки обновлены в реальном времени');
  }, [
    isTestMode,
    audioSettings.inputVolume,
    audioSettings.outputVolume,
    audioSettings.micSensitivity,
    audioSettings.selectedSpeaker,
  ]);



  const handleLogout = () => {
    onLogout();
    onClose();
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Проверка типа файла
    if (!file.type.startsWith('image/')) {
      alert('Пожалуйста, выберите изображение');
      return;
    }

    // Проверка размера (макс 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Размер файла не должен превышать 5MB');
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const response = await fetch(`${BACKEND_URL}/api/auth/avatar`, {
        method: 'POST',
        headers: buildAuthHeaders(),
        credentials: 'include',
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка загрузки');
      }

      // Обновить аватар в localStorage и состоянии
      const updatedUser = {
        ...currentUser,
        avatar: data.avatar,
        blockedUsers: data.blockedUsers || currentUser.blockedUsers || []
      };
      try {
        localStorage.setItem('user', JSON.stringify(updatedUser));
      } catch (err) {
        console.warn('Не удалось сохранить обновленного пользователя после загрузки аватара', err);
      }
      setCurrentUser(updatedUser);

      if (onAvatarUpdate) {
        onAvatarUpdate(updatedUser);
      }

      alert('Аватар успешно обновлен!');
    } catch (error) {
      console.error('Ошибка загрузки аватара:', error);
      alert(error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDisplayNameEdit = () => {
    setNewDisplayName(currentUser?.displayName || currentUser?.username || '');
    setDisplayNameError('');
    setIsEditingDisplayName(true);
  };

  const handleDisplayNameSave = async () => {
    const trimmedName = newDisplayName.trim();

    if (!trimmedName) {
      setDisplayNameError('Имя не может быть пустым');
      return;
    }

    if (trimmedName.length > 32) {
      setDisplayNameError('Имя не может превышать 32 символа');
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/displayname`, {
        method: 'PATCH',
        headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({ displayName: trimmedName })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка обновления');
      }

      // Обновить пользователя в localStorage и состоянии
      const updatedUser = {
        ...currentUser,
        displayName: data.displayName,
        blockedUsers: currentUser.blockedUsers || []
      };
      try {
        localStorage.setItem('user', JSON.stringify(updatedUser));
      } catch (err) {
        console.warn('Не удалось обновить пользователя при сохранении отображаемого имени', err);
      }
      setCurrentUser(updatedUser);

      if (onAvatarUpdate) {
        onAvatarUpdate(updatedUser);
      }

      setIsEditingDisplayName(false);
      setDisplayNameError('');
    } catch (error) {
      setDisplayNameError(error.message);
    }
  };

  const handleDisplayNameCancel = () => {
    setIsEditingDisplayName(false);
    setDisplayNameError('');
  };

  const handleAudioSettingChange = (setting, value) => {
    const newSettings = { ...audioSettings, [setting]: value };
    setAudioSettings(newSettings);
    localStorage.setItem('audioSettings', JSON.stringify(newSettings));

    // Отправляем кастомное событие для мгновенного применения настроек
    window.dispatchEvent(new CustomEvent('audioSettingsChanged', {
      detail: newSettings
    }));
  };

  // Обработка изменения громкости
  const handleVolumeChange = (type, value) => {
    const numValue = parseInt(value, 10);
    // Ограничиваем значение в допустимом диапазоне 0-200%
    const clampedValue = Math.min(200, Math.max(0, numValue));
    const setting = type === 'input' ? 'inputVolume' : 'outputVolume';
    handleAudioSettingChange(setting, clampedValue);
  };

  // Получить читаемое имя клавиши
  const getKeyName = (code) => {
    // Проверка на undefined или пустую строку
    if (!code) return 'Не задано';

    const keyNames = {
      'ControlLeft': 'Left Ctrl',
      'ControlRight': 'Right Ctrl',
      'ShiftLeft': 'Left Shift',
      'ShiftRight': 'Right Shift',
      'AltLeft': 'Left Alt',
      'AltRight': 'Right Alt',
      'Space': 'Space',
      'CapsLock': 'Caps Lock',
      'Tab': 'Tab',
      'Enter': 'Enter',
      'Backquote': '`',
      'Backslash': '\\',
      'BracketLeft': '[',
      'BracketRight': ']',
      'Semicolon': ';',
      'Quote': "'",
      'Comma': ',',
      'Period': '.',
      'Slash': '/',
      'Minus': '-',
      'Equal': '='
    };

    // Если есть специальное имя, используем его
    if (keyNames[code]) return keyNames[code];

    // Для букв и цифр убираем Key/Digit префикс
    if (code.startsWith('Key')) return code.replace('Key', '');
    if (code.startsWith('Digit')) return code.replace('Digit', '');

    // Для F-клавиш и других
    return code;
  };

  // Начать запись клавиши для PTT
  const startKeyRecording = () => {
    setIsRecordingKey(true);
    setPressedKeys(new Set());
  };

  // Обработка нажатия клавиши при записи PTT
  useEffect(() => {
    if (!isRecordingKey) return;

    const handleKeyDown = (e) => {
      e.preventDefault();
      const newKeys = new Set(pressedKeys);
      newKeys.add(e.code);
      setPressedKeys(newKeys);

      // Сохраняем клавишу и завершаем запись
      handleAudioSettingChange('pttKey', e.code);
      setIsRecordingKey(false);
      console.log('🎹 Клавиша PTT установлена:', e.code);
    };

    const handleKeyUp = (e) => {
      e.preventDefault();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isRecordingKey, pressedKeys]);

  // Обработка выбора устройства
  const handleDeviceChange = (deviceType, deviceId) => {
    const setting = deviceType === 'microphone' ? 'selectedMicrophone' : 'selectedSpeaker';
    const newSettings = { ...audioSettings, [setting]: deviceId };
    setAudioSettings(newSettings);
    localStorage.setItem('audioSettings', JSON.stringify(newSettings));

    console.log(`✅ Выбрано устройство ${deviceType}:`, deviceId);

    // Отправляем событие для применения изменений
    window.dispatchEvent(new CustomEvent('audioSettingsChanged', {
      detail: newSettings
    }));
  };

  // Остановка мониторинга микрофона
  const stopMicMonitoring = () => {
    if (testStream) {
      testStream.getTracks().forEach(track => track.stop());
      setTestStream(null);
    }
    if (testAudioContext && testAudioContext.state !== 'closed') {
      testAudioContext.close();
      setTestAudioContext(null);
    }
    setIsMicTesting(false);
    setMicLevel(0);
  };

  // Запуск мониторинга микрофона
  const startMicMonitoring = async () => {
    // Если уже работает, не запускаем повторно
    if (isMicTesting) return;

    try {
      setIsMicTesting(true);

      // Получаем поток с выбранного микрофона
      const constraints = {
        audio: audioSettings.selectedMicrophone === 'default'
          ? true
          : { deviceId: { exact: audioSettings.selectedMicrophone } },
        video: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setTestStream(stream);

      // Создаем анализатор звука
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      setTestAudioContext(audioContext);

      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);

      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      microphone.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      let animationId = null;
      let isRunning = true;

      // Функция для обновления уровня
      const updateLevel = () => {
        // Проверяем, что поток все еще активен
        if (!stream.active || !isRunning || audioContext.state === 'closed') {
          if (animationId) {
            cancelAnimationFrame(animationId);
          }
          setMicLevel(0);
          return;
        }

        analyser.getByteTimeDomainData(dataArray);

        // Вычисляем RMS (root mean square) для более точного уровня
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          const normalized = (dataArray[i] - 128) / 128;
          sum += normalized * normalized;
        }
        const rms = Math.sqrt(sum / bufferLength);
        const normalizedLevel = Math.min(100, rms * 200);

        setMicLevel(normalizedLevel);
        animationId = requestAnimationFrame(updateLevel);
      };

      // Сохраняем ID анимации для возможности остановки
      stream.onended = () => {
        isRunning = false;
        if (animationId) {
          cancelAnimationFrame(animationId);
        }
        setMicLevel(0);
      };

      console.log('🎤 Тест микрофона запущен, stream active:', stream.active);
      updateLevel();
    } catch (error) {
      console.error('Ошибка тестирования микрофона:', error);
      alert('Не удалось получить доступ к микрофону. Проверьте разрешения браузера.');
      setIsMicTesting(false);
      setMicLevel(0);
    }
  };

  // Остановка тестового loopback режима
  const stopTestMode = () => {
    console.log('🛑 Остановка тестового режима...');

    // Останавливаем аудио элемент
    if (loopbackAudioElement) {
      loopbackAudioElement.pause();
      loopbackAudioElement.srcObject = null;
      setLoopbackAudioElement(null);
    }

    // Очищаем граф обработки
    if (loopbackProcessingRef.current) {
      loopbackProcessingRef.current.teardown().catch(err => {
        console.warn('Ошибка очистки графа обработки:', err);
      });
      loopbackProcessingRef.current = null;
    }

    // Очищаем ссылки
    loopbackOutputVolumeRef.current = null;

    // Останавливаем поток
    if (loopbackStream) {
      loopbackStream.getTracks().forEach(track => track.stop());
      setLoopbackStream(null);
    }

    setIsTestMode(false);
    console.log('✅ Тестовый режим остановлен');
  };

  /**
   * Запуск тестового режима "Услышать свой голос"
   *
   * Особенности:
   * 1. Использует ТУ ЖЕ обработку что и в реальном голосовом чате (createProcessingGraph)
   * 2. Задержка 2 секунды с звуковым уведомлением
   * 3. Реактивное применение всех настроек в реальном времени
   */
  const startTestMode = async () => {
    if (isTestMode) return;

    try {
      console.log('🎙️ Запуск тестового режима...');
      setIsTestMode(true);

      // Проверяем доступность API
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia не поддерживается в этом браузере');
      }

      // Получаем поток с микрофона с текущими настройками
      let constraints = {
        audio: {
          deviceId: audioSettings.selectedMicrophone === 'default'
            ? undefined
            : { exact: audioSettings.selectedMicrophone },
          echoCancellation: audioSettings.echoCancellation ?? true,
          noiseSuppression: audioSettings.noiseSuppression ?? true,
          autoGainControl: audioSettings.autoGainControl ?? true
        },
        video: false
      };

      console.log('📋 Запрашиваем разрешения с ограничениями:', constraints);
      let stream;

      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('✅ Поток микрофона получен успешно');
      } catch (deviceError) {
        console.log('⚠️ Выбранный микрофон недоступен, пробуем устройство по умолчанию:', deviceError);
        // Fallback: пробуем с устройством по умолчанию
        constraints = {
          audio: {
            echoCancellation: audioSettings.echoCancellation ?? true,
            noiseSuppression: audioSettings.noiseSuppression ?? true,
            autoGainControl: audioSettings.autoGainControl ?? true
          },
          video: false
        };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('✅ Поток микрофона получен с устройством по умолчанию');
      }

      setLoopbackStream(stream);

      // ========== ИСПОЛЬЗУЕМ ТУ ЖЕ ОБРАБОТКУ ЧТО И В РЕАЛЬНОМ ЧАТЕ ==========
      const processingGraph = await createProcessingGraph(stream, {
        inputVolume: audioSettings.inputVolume ?? 100,
        micSensitivity: audioSettings.micSensitivity ?? 1,
      });

      if (!processingGraph) {
        throw new Error('Не удалось создать граф обработки звука');
      }

      // Сохраняем ссылку для реактивного обновления настроек
      loopbackProcessingRef.current = processingGraph;

      // ========== ДОБАВЛЯЕМ ЗАДЕРЖКУ 2 СЕКУНДЫ ==========
      const audioContext = processingGraph.context;
      const processedSource = audioContext.createMediaStreamSource(processingGraph.stream);
      const delayNode = audioContext.createDelay(5.0); // Максимум 5 секунд
      delayNode.delayTime.value = 2.0; // Задержка 2 секунды

      // Узел контроля громкости выхода (для реактивности)
      const outputGain = audioContext.createGain();
      outputGain.gain.value = Math.min(1.0, Math.max(0, audioSettings.outputVolume / 100));
      loopbackOutputVolumeRef.current = outputGain;

      const destination = audioContext.createMediaStreamDestination();

      // Подключаем: обработанный звук -> задержка -> громкость -> выход
      processedSource.connect(delayNode).connect(outputGain).connect(destination);

      // Создаем аудио элемент для воспроизведения
      const audio = new Audio();
      audio.srcObject = destination.stream;
      audio.volume = 1.0; // Контролируем через gain node

      // Устанавливаем выходное устройство
      if (audioSettings.selectedSpeaker && audioSettings.selectedSpeaker !== 'default' && typeof audio.setSinkId === 'function') {
        try {
          await audio.setSinkId(audioSettings.selectedSpeaker);
          console.log('🔊 Выбрано устройство вывода:', audioSettings.selectedSpeaker);
        } catch (err) {
          console.warn('Не удалось установить устройство вывода:', err);
        }
      }

      // Воспроизводим звук
      await audio.play().catch(err => {
        console.error('Ошибка воспроизведения:', err);
        throw new Error('Не удалось начать воспроизведение');
      });

      setLoopbackAudioElement(audio);

      // ========== ЗВУКОВОЕ УВЕДОМЛЕНИЕ ЧЕРЕЗ 2 СЕКУНДЫ ==========
      setTimeout(() => {
        try {
          const beep = new Audio('/ptt_start.mp3');
          beep.volume = 0.5;
          beep.play().catch(() => {
            console.log('Не удалось воспроизвести звуковое уведомление');
          });
          console.log('🔔 Задержка 2 секунды прошла - теперь вы слышите себя!');
        } catch (err) {
          console.log('Ошибка воспроизведения звука уведомления:', err);
        }
      }, 2000);

      console.log('✅ Тестовый режим запущен - через 2 секунды услышите свой голос');
    } catch (error) {
      console.error('Ошибка запуска тестового режима:', error);
      setIsTestMode(false);

      // Определяем тип ошибки и показываем соответствующее сообщение
      let errorMessage = 'Не удалось запустить тестовый режим.';

      if (error.name === 'NotAllowedError') {
        errorMessage = '❌ Доступ к микрофону запрещен. Разрешите использование микрофона в настройках браузера и обновите страницу.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = '❌ Микрофон не найден. Проверьте подключение микрофона и выберите правильное устройство в настройках.';
      } else if (error.name === 'NotReadableError') {
        errorMessage = '❌ Микрофон используется другим приложением. Закройте другие программы, использующие микрофон.';
      } else if (error.name === 'OverconstrainedError') {
        errorMessage = '❌ Выбранный микрофон не поддерживает текущие настройки. Попробуйте выбрать другое устройство.';
      } else if (error.message.includes('не поддерживается')) {
        errorMessage = '❌ Ваш браузер не поддерживает тестовый режим микрофона. Используйте современный браузер (Chrome, Firefox, Safari).';
      } else {
        errorMessage = `❌ Ошибка: ${error.message || 'Неизвестная ошибка'}`;
      }

      alert(errorMessage);

      // Очистка при ошибке
      if (loopbackProcessingRef.current) {
        loopbackProcessingRef.current.teardown().catch(() => {});
        loopbackProcessingRef.current = null;
      }
      loopbackOutputVolumeRef.current = null;
      if (loopbackStream) {
        loopbackStream.getTracks().forEach(track => track.stop());
        setLoopbackStream(null);
      }
    }
  };


  // Проверка разрешений микрофона
  const checkMicPermissions = async () => {
    try {
      if (!navigator.permissions) {
        console.log('⚠️ Permissions API не поддерживается');
        return true; // Пробуем запустить без проверки
      }

      const permission = await navigator.permissions.query({ name: 'microphone' });
      console.log('🔍 Статус разрешений микрофона:', permission.state);

      if (permission.state === 'denied') {
        alert('❌ Доступ к микрофону запрещен. Разрешите использование микрофона в настройках браузера и обновите страницу.');
        return false;
      }

      return true;
    } catch (error) {
      console.log('⚠️ Не удалось проверить разрешения:', error);
      return true; // Пробуем запустить без проверки
    }
  };

  // Переключение тестового режима
  const toggleTestMode = async () => {
    if (isTestMode) {
      stopTestMode();
    } else {
      const hasPermission = await checkMicPermissions();
      if (hasPermission) {
        startTestMode();
      }
    }
  };

  const handleAssignBadge = async () => {
    setBadgeError('');
    setBadgeSuccess('');

    if (!targetUsername.trim()) {
      setBadgeError('Введите имя пользователя');
      return;
    }

    if (!badgeText.trim()) {
      setBadgeError('Введите тег');
      return;
    }

    if (badgeText.trim().length > 4) {
      setBadgeError('Тег не может превышать 4 символа');
      return;
    }

    setIsAssigningBadge(true);

    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/assign-badge`, {
        method: 'POST',
        headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({
          username: targetUsername.trim(),
          badge: badgeText.trim(),
          badgeTooltip: badgeTooltipText.trim() || badgeText.trim()
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка назначения тега');
      }

      setBadgeSuccess(`Тег "${badgeText}" успешно назначен пользователю ${targetUsername}!`);
      setTargetUsername('');
      setBadgeText('');
      setBadgeTooltipText('');

      // Очистить сообщение об успехе через 3 секунды
      setTimeout(() => {
        setBadgeSuccess('');
      }, 3000);
    } catch (error) {
      setBadgeError(error.message);
    } finally {
      setIsAssigningBadge(false);
    }
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-container" onClick={(e) => e.stopPropagation()}>
        {/* Кнопка закрытия - всегда справа */}
        <button className="settings-close-btn" onClick={onClose}>
          ✕
        </button>

        <div className="settings-content">
          {/* Боковая панель навигации */}
          <div className="settings-sidebar">
            <div className="settings-search">
              <input
                type="text"
                placeholder="Поиск настроек..."
                className="settings-search-input"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>

            <div className="settings-nav-section">
              <h3>НАСТРОЙКИ ПОЛЬЗОВАТЕЛЯ</h3>
              {filterNavigationItems(userNavItems).map((item) => (
                <button
                  key={item.id}
                  className={`settings-nav-item ${activeTab === item.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(item.id)}
                  title={item.description}
                >
                  {item.label}
                </button>
              ))}
              {filterNavigationItems(userNavItems).length === 0 && searchQuery.trim() && (
                <div className="search-no-results">
                  <p>Ничего не найдено для "{searchQuery}"</p>
                </div>
              )}
            </div>

            {isPuncher && (
              <div className="settings-nav-section">
                <h3>АДМИНИСТРАТОР</h3>
                <button
                  className={`settings-nav-item ${activeTab === 'admin' ? 'active' : ''}`}
                  onClick={() => setActiveTab('admin')}
                >
                  Admin panel
                </button>
              </div>
            )}

            {/* Кнопка выхода */}
            <div className="settings-nav-section settings-logout-section">
              <button
                className="settings-nav-item settings-logout-item"
                onClick={onLogout}
              >
                Выйти из аккаунта
              </button>
            </div>
          </div>

        <div className="settings-profile-section">
          {activeTab === 'account' && (
            <>
            <div className="settings-page-header">
              <h1 className="settings-page-title">Моя учётная запись</h1>
              <p className="settings-page-subtitle">Управляйте своей учётной записью и настройками профиля</p>
            </div>
          <div className="settings-profile-banner">
            <label className="settings-profile-avatar-wrapper" title="Изменить аватар">
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                disabled={uploading}
                style={{ display: 'none' }}
              />
              {currentUser?.avatar ? (
                <img
                  src={`${BACKEND_URL}${currentUser.avatar}`}
                  alt="Avatar"
                  className="settings-profile-avatar-img"
                />
              ) : (
                <div className="settings-profile-avatar">
                  {(currentUser?.displayName || currentUser?.username)?.charAt(0).toUpperCase() || 'U'}
                </div>
              )}
              <div className="avatar-edit-overlay">
                {uploading ? (
                  <span className="avatar-uploading">⏳</span>
                ) : (
                  <svg className="avatar-edit-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="white"/>
                  </svg>
                )}
              </div>
            </label>
            <div className="settings-profile-info">
              <h3>{currentUser?.displayName || currentUser?.username || 'Пользователь'}</h3>
              {currentUser?.badge && currentUser.badge !== 'User' && (
                <div className="settings-profile-badge" title={currentUser.badgeTooltip || currentUser.badge}>
                  {currentUser.badge}
                </div>
              )}
            </div>
          </div>

          <div className="settings-info-item">
            <div className="settings-info-label">Отображаемое имя</div>
            {isEditingDisplayName ? (
              <div className="settings-info-edit">
                <input
                  type="text"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  placeholder="Введите имя"
                  className="settings-info-input"
                  maxLength={32}
                  autoFocus
                />
                {displayNameError && <span className="settings-error">{displayNameError}</span>}
                <div className="settings-info-actions">
                  <button className="settings-save-btn" onClick={handleDisplayNameSave}>Сохранить</button>
                  <button className="settings-cancel-btn" onClick={handleDisplayNameCancel}>Отмена</button>
                </div>
              </div>
            ) : (
              <>
                <div className="settings-info-value">{currentUser?.displayName || currentUser?.username || 'Пользователь'}</div>
                <button className="settings-change-btn" onClick={handleDisplayNameEdit}>Изменить</button>
              </>
            )}
          </div>

          <div className="settings-info-item">
            <div className="settings-info-label">Имя пользователя</div>
            <div className="settings-info-value">{currentUser?.username || 'Пользователь'}</div>
          </div>

          <div className="settings-info-item">
            <div className="settings-info-label">Электронная почта</div>
            <div className="settings-info-value">
              {currentUser?.email ? `${currentUser.email.substring(0, 3)}***${currentUser.email.substring(currentUser.email.indexOf('@'))}` : '***@gmail.com'}
            </div>
            <button className="settings-change-btn">Изменить</button>
            </div>

            </>
          )}

          {activeTab === 'audio' && (
            <>
            <div className="settings-page-header">
              <h1 className="settings-page-title">Голос и видео</h1>
              <p className="settings-page-subtitle">Настройте свои аудио и видео устройства</p>
            </div>
            <div className="audio-settings-content">
              {/* Секция выбора устройств */}
              <div className="audio-settings-section">
                <h3 className="audio-settings-title">Аудиоустройства</h3>
                <p className="audio-settings-description">
                  Выберите микрофон и динамики для голосового чата
                </p>

                {isLoadingDevices ? (
                  <div className="audio-skeleton">
                    <div className="skeleton-item">
                      <div className="skeleton-icon"></div>
                      <div className="skeleton-content">
                        <div className="skeleton-title"></div>
                        <div className="skeleton-subtitle"></div>
                      </div>
                      <div className="skeleton-select"></div>
                    </div>
                    <div className="skeleton-item">
                      <div className="skeleton-icon"></div>
                      <div className="skeleton-content">
                        <div className="skeleton-title"></div>
                        <div className="skeleton-subtitle"></div>
                      </div>
                      <div className="skeleton-select"></div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="audio-setting-item">
                      <div className="audio-setting-info">
                        <div className="audio-setting-label">
                          <img src="/icons/microphone.png" alt="Microphone" className="audio-setting-icon" />
                          Микрофон
                        </div>
                        <div className="audio-setting-desc">
                          Выберите устройство для записи голоса
                        </div>
                      </div>
                      <select
                        className="audio-select"
                        value={audioSettings.selectedMicrophone}
                        onChange={(e) => handleDeviceChange('microphone', e.target.value)}
                      >
                        {audioDevices.microphones.map(mic => (
                          <option key={mic.deviceId} value={mic.deviceId}>
                            {mic.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="audio-setting-item">
                      <div className="audio-setting-info">
                        <div className="audio-setting-label">
                          <img src="/icons/headset.png" alt="Headset" className="audio-setting-icon" />
                          Динамики
                        </div>
                        <div className="audio-setting-desc">
                          Выберите устройство для воспроизведения звука
                        </div>
                      </div>
                      <select
                        className="audio-select"
                        value={audioSettings.selectedSpeaker}
                        onChange={(e) => handleDeviceChange('speaker', e.target.value)}
                        disabled={!document.createElement('audio').setSinkId}
                      >
                        {audioDevices.speakers.map(speaker => (
                          <option key={speaker.deviceId} value={speaker.deviceId}>
                            {speaker.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Индикатор уровня микрофона */}
                    <div className="mic-monitor-container">
                      <div className="mic-monitor-header">
                        <div className="mic-monitor-title">
                          <img src="/icons/wave_sound.png" alt="Wave" className="audio-setting-icon" />
                          Индикатор микрофона
                        </div>
                        <div className={`mic-status ${isMicTesting ? 'active' : 'inactive'}`}>
                          {isMicTesting ? '● Активен' : '○ Загрузка...'}
                        </div>
                      </div>

                      <div className="mic-level-container">
                        <div className="mic-level-label">Уровень входящего сигнала:</div>
                        <div className="mic-level-bar">
                          <div
                            className="mic-level-fill"
                            style={{ width: `${micLevel}%` }}
                          ></div>
                          {/* Порог активации голоса */}
                          <div
                            className="mic-threshold-line"
                            style={{ left: `${audioSettings.micSensitivity * 2}%` }}
                            title={`Порог активации: ${audioSettings.micSensitivity}`}
                          ></div>
                        </div>
                        <div className="mic-level-value">{Math.round(micLevel)}%</div>
                      </div>

                      {/* Настройка чувствительности */}
                      <div className="mic-sensitivity-container">
                        <div className="mic-sensitivity-header">
                          <div className="mic-sensitivity-label">
                            Порог активации голоса:
                          </div>
                          <div className="mic-sensitivity-value">{audioSettings.micSensitivity}</div>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="50"
                          value={audioSettings.micSensitivity}
                          onChange={(e) => handleAudioSettingChange('micSensitivity', parseInt(e.target.value, 10))}
                          className="mic-sensitivity-slider"
                          style={{ '--sensitivity-percent': audioSettings.micSensitivity * 2 }}
                        />
                        <div className="mic-sensitivity-desc">
                          Чем выше значение, тем больше нужна громкость голоса для активации. Оптимально: 1-5 для максимальной чистоты
                        </div>
                      </div>

                      {isMicTesting && micLevel < 5 && (
                        <div className="mic-tip">
                          💡 Говорите в микрофон, чтобы увидеть уровень сигнала
                        </div>
                      )}

                      {isMicTesting && micLevel >= 5 && micLevel < 30 && (
                        <div className="mic-tip mic-tip-warning">
                          ⚠️ Низкий уровень сигнала. Попробуйте говорить громче или увеличьте громкость микрофона
                        </div>
                      )}

                      {/* Кнопка тестового режима */}
                      <div className="test-mode-container">
                        <button
                          className={`test-mode-button ${isTestMode ? 'active' : ''}`}
                          onClick={toggleTestMode}
                        >
                          {isTestMode ? (
                            <>
                              <span className="test-mode-icon">🔊</span>
                              <span>Остановить тест</span>
                            </>
                          ) : (
                            <>
                              <span className="test-mode-icon">🎧</span>
                              <span>Услышать свой голос</span>
                            </>
                          )}
                        </button>
                        <div className="test-mode-desc">
                          {isTestMode ? (
                            <>
                              ✅ <strong>Тест активен:</strong> Вы слышите свой голос со всеми настройками обработки звука
                            </>
                          ) : (
                            'Нажмите для проверки качества микрофона и настроек звука'
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Секция режима активации */}
              <div className="audio-settings-section">
                <h3 className="audio-settings-title">Режим активации голоса</h3>
                <p className="audio-settings-description">
                  Выберите способ активации микрофона
                </p>

                <div className="voice-mode-selector">
                  <div
                    className={`voice-mode-option ${audioSettings.voiceMode === 'vad' ? 'active' : ''}`}
                    onClick={() => handleAudioSettingChange('voiceMode', 'vad')}
                  >
                    <div className="voice-mode-info">
                      <div className="voice-mode-name">Voice Activation</div>
                      <div className="voice-mode-desc">Микрофон включается автоматически при обнаружении голоса</div>
                    </div>
                  </div>

                  <div
                    className={`voice-mode-option ${audioSettings.voiceMode === 'ptt' ? 'active' : ''}`}
                    onClick={() => handleAudioSettingChange('voiceMode', 'ptt')}
                  >
                    <div className="voice-mode-info">
                      <div className="voice-mode-name">Push-to-Talk (PTT)</div>
                      <div className="voice-mode-desc">Удерживайте клавишу для активации микрофона</div>
                    </div>
                  </div>
                </div>

                {/* Настройка клавиши PTT */}
                {audioSettings.voiceMode === 'ptt' && (
                  <div className="ptt-key-setting">
                    <div className="ptt-key-info">
                      <div className="ptt-key-label">Клавиша PTT:</div>
                      <div className="ptt-key-desc">
                        Выберите клавишу, которую нужно удерживать для активации микрофона
                      </div>
                    </div>
                    <div className="ptt-key-control">
                      <button
                        className={`ptt-key-button ${isRecordingKey ? 'recording' : ''}`}
                        onClick={startKeyRecording}
                        disabled={isRecordingKey}
                      >
                        {isRecordingKey ? 'Нажмите клавишу...' : getKeyName(audioSettings.pttKey)}
                      </button>
                      {!isRecordingKey && (
                        <div className="ptt-key-hint">
                          Нажмите для изменения
                        </div>
                      )}
                      {isRecordingKey && (
                        <div className="ptt-key-hint recording">
                          Нажмите любую клавишу
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Секция громкости */}
              <div className="audio-settings-section">
                <h3 className="audio-settings-title">Громкость</h3>
                <p className="audio-settings-description">
                  Настройка уровня громкости микрофона и динамиков
                </p>

                <div className="volume-setting-item">
                  <div className="volume-setting-info">
                    <div className="volume-setting-label">
                      <img src="/icons/microphone.png" alt="Microphone" className="audio-setting-icon" />
                      Исходящий звук (микрофон)
                    </div>
                    <div className="volume-setting-desc">
                      Насколько громко вас слышат другие пользователи
                    </div>
                  </div>
                  <div className="volume-control">
                    <input
                      type="range"
                      min="0"
                      max="200"
                      value={audioSettings.inputVolume}
                      onChange={(e) => handleVolumeChange('input', e.target.value)}
                      className="volume-slider"
                      style={{ '--volume-percent': audioSettings.inputVolume / 2 }}
                    />
                    <span className="volume-value">{audioSettings.inputVolume}%</span>
                  </div>
                </div>

                <div className="volume-setting-item">
                  <div className="volume-setting-info">
                    <div className="volume-setting-label">
                      <img src="/icons/headset.png" alt="Headset" className="audio-setting-icon" />
                      Входящий звук (динамики)
                    </div>
                    <div className="volume-setting-desc">
                      Общая громкость голосов других пользователей
                    </div>
                  </div>
                  <div className="volume-control">
                    <input
                      type="range"
                      min="0"
                      max="200"
                      value={audioSettings.outputVolume}
                      onChange={(e) => handleVolumeChange('output', e.target.value)}
                      className="volume-slider"
                      style={{ '--volume-percent': audioSettings.outputVolume / 2 }}
                    />
                    <span className="volume-value">{audioSettings.outputVolume}%</span>
                  </div>
                </div>
              </div>

              <div className="audio-settings-section">
                <h3 className="audio-settings-title">Улучшение звука</h3>
                <p className="audio-settings-description">
                  Настройки для улучшения качества голосового чата
                </p>

                <div className="audio-setting-item">
                  <div className="audio-setting-info">
                    <div className="audio-setting-label">
                      <img src="/icons/echo.png" alt="Echo" className="audio-setting-icon" />
                      Без эха
                    </div>
                    <div className="audio-setting-desc">Убирает эхо и повторения голоса</div>
                  </div>
                  <label className="audio-toggle">
                    <input
                      type="checkbox"
                      checked={audioSettings.echoCancellation}
                      onChange={(e) => handleAudioSettingChange('echoCancellation', e.target.checked)}
                    />
                    <span className="audio-toggle-slider"></span>
                  </label>
                </div>

                <div className="audio-setting-item">
                  <div className="audio-setting-info">
                    <div className="audio-setting-label">
                      <img src="/icons/channel.png" alt="Channel" className="audio-setting-icon" />
                      Чистый звук
                    </div>
                    <div className="audio-setting-desc">Убирает шум вентилятора, клавиатуры и другие фоновые звуки</div>
                  </div>
                  <label className="audio-toggle">
                    <input
                      type="checkbox"
                      checked={audioSettings.noiseSuppression}
                      onChange={(e) => handleAudioSettingChange('noiseSuppression', e.target.checked)}
                    />
                    <span className="audio-toggle-slider"></span>
                  </label>
                </div>

                <div className="audio-setting-item">
                  <div className="audio-setting-info">
                    <div className="audio-setting-label">
                      <img src="/icons/wave_sound.png" alt="Wave Sound" className="audio-setting-icon" />
                      Автоматическое усиление
                    </div>
                    <div className="audio-setting-desc">Нормализует громкость микрофона</div>
                  </div>
                  <label className="audio-toggle">
                    <input
                      type="checkbox"
                      checked={audioSettings.autoGainControl}
                      onChange={(e) => handleAudioSettingChange('autoGainControl', e.target.checked)}
                    />
                    <span className="audio-toggle-slider"></span>
                  </label>
                </div>
              </div>


            </div>
            </>
          )}

          {activeTab === 'admin' && isPuncher && (
            <>
            <div className="settings-page-header">
              <h1 className="settings-page-title">Admin panel</h1>
              <p className="settings-page-subtitle">Панель администратора для управления системой</p>
            </div>
            <div className="settings-admin-section-content">
              <div className="settings-admin-header">
                <h3>Admin panel</h3>
                <span className="admin-badge">ADMIN</span>
              </div>
              <p className="admin-description">
                Вы можете назначать любые теги пользователям. Теги будут отображаться рядом с их именами.
              </p>
              <div className="badge-assign-form">
                <div className="badge-form-group">
                  <label>Имя пользователя</label>
                  <input
                    type="text"
                    value={targetUsername}
                    onChange={(e) => setTargetUsername(e.target.value)}
                    placeholder="Введите username"
                    className="badge-input"
                    disabled={isAssigningBadge}
                  />
                </div>
                <div className="badge-form-group">
                  <label>Тег (макс. 4 символа)</label>
                  <input
                    type="text"
                    value={badgeText}
                    onChange={(e) => setBadgeText(e.target.value)}
                    placeholder="Например: Dev, VIP, Mod"
                    className="badge-input"
                    disabled={isAssigningBadge}
                    maxLength={4}
                  />
                </div>
                <div className="badge-form-group">
                  <label>Подсказка (опционально)</label>
                  <input
                    type="text"
                    value={badgeTooltipText}
                    onChange={(e) => setBadgeTooltipText(e.target.value)}
                    placeholder="Описание тега"
                    className="badge-input"
                    disabled={isAssigningBadge}
                  />
                </div>
                {badgeError && <div className="badge-error">{badgeError}</div>}
                {badgeSuccess && <div className="badge-success">{badgeSuccess}</div>}
                <button
                  className="badge-assign-btn"
                  onClick={handleAssignBadge}
                  disabled={isAssigningBadge}
                >
                  {isAssigningBadge ? 'Назначение...' : 'Назначить тег'}
            </button>
          </div>
            </div>
            </>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}

export default UserSettingsModal;
