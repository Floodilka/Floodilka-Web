/**
 * Профессиональный микшер для голосового чата
 * Обеспечивает ровный микс всех участников без клиппинга
 */

class AudioMixer {
  constructor() {
    this.audioCtx = null;
    this.mixBus = null;
    this.busComp = null;
    this.busLimiter = null;
    this.participants = new Map(); // socketId -> { gain, source, disconnect }
    this.isInitialized = false;
  }

  /**
   * Инициализирует микшер
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error('Web Audio API не поддерживается');
      }

      // Создаём контекст с оптимальными настройками
      const contextOptions = {
        sampleRate: 48000,
        latencyHint: 'interactive'
      };

      // Для Safari добавляем дополнительные параметры
      if (/WebKit/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent)) {
        // Safari может не поддерживать latencyHint
        delete contextOptions.latencyHint;
      }

      this.audioCtx = new AudioContextClass(contextOptions);

      // Основная шина микширования
      this.mixBus = this.audioCtx.createGain();
      this.mixBus.gain.value = 1.0;

      // Финальный компрессор для ровного звука
      this.busComp = this.audioCtx.createDynamicsCompressor();
      this.busComp.threshold.value = -18;  // Порог срабатывания
      this.busComp.knee.value = 24;        // Плавность
      this.busComp.ratio.value = 6;        // Степень сжатия
      this.busComp.attack.value = 0.005;   // 5ms - быстрая атака
      this.busComp.release.value = 0.2;    // 200ms - средний релиз

      // Финальный лимитер для защиты от клиппинга
      this.busLimiter = this.audioCtx.createDynamicsCompressor();
      this.busLimiter.threshold.value = -1;   // Жёсткий лимит
      this.busLimiter.knee.value = 0;         // Без мягкости
      this.busLimiter.ratio.value = 20;       // Максимальное сжатие
      this.busLimiter.attack.value = 0.001;   // 1ms - мгновенная атака
      this.busLimiter.release.value = 0.01;   // 10ms - быстрый релиз

      // Строим цепочку: mixBus -> busComp -> busLimiter -> destination
      this.mixBus.connect(this.busComp);
      this.busComp.connect(this.busLimiter);
      this.busLimiter.connect(this.audioCtx.destination);

      this.isInitialized = true;
      console.log('✅ Аудио-микшер инициализирован');
    } catch (error) {
      console.error('Ошибка инициализации аудио-микшера:', error);
      throw error;
    }
  }

  /**
   * Подключает удалённый поток к микшеру
   *
   * @param {string} socketId - ID сокета участника
   * @param {MediaStream} stream - Поток участника
   * @param {number} initialGain - Начальная громкость (0.0 - 2.0)
   * @returns {Object} { setGain, disconnect } - Управление громкостью
   */
  async connectRemoteStream(socketId, stream, initialGain = 1.0) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Создаём источник из потока
      const source = this.audioCtx.createMediaStreamSource(stream);

      // Создаём узел громкости для этого участника
      const gain = this.audioCtx.createGain();
      gain.gain.value = initialGain;

      // Подключаем к микшеру
      source.connect(gain);
      gain.connect(this.mixBus);

      // Сохраняем для управления
      const participant = {
        source,
        gain,
        disconnect: () => {
          try {
            gain.disconnect();
            source.disconnect();
          } catch (err) {
            console.warn('Ошибка отключения участника от микшера:', err);
          }
        }
      };

      this.participants.set(socketId, participant);

      console.log(`✅ Участник ${socketId} подключён к микшеру`);

      return {
        setGain: (volume) => {
          const clamped = Math.max(0, Math.min(2.0, volume));
          gain.gain.setValueAtTime(gain.gain.value, this.audioCtx.currentTime);
          gain.gain.linearRampToValueAtTime(clamped, this.audioCtx.currentTime + 0.05);
        },
        disconnect: participant.disconnect
      };
    } catch (error) {
      console.error(`Ошибка подключения участника ${socketId}:`, error);
      throw error;
    }
  }

  /**
   * Устанавливает громкость участника
   *
   * @param {string} socketId - ID сокета участника
   * @param {number} volume - Громкость (0.0 - 2.0)
   */
  setParticipantVolume(socketId, volume) {
    const participant = this.participants.get(socketId);
    if (participant) {
      participant.setGain(volume);
    }
  }

  /**
   * Отключает участника от микшера
   *
   * @param {string} socketId - ID сокета участника
   */
  disconnectParticipant(socketId) {
    const participant = this.participants.get(socketId);
    if (participant) {
      participant.disconnect();
      this.participants.delete(socketId);
      console.log(`✅ Участник ${socketId} отключён от микшера`);
    }
  }

  /**
   * Устанавливает общую громкость микшера
   *
   * @param {number} volume - Громкость (0.0 - 2.0)
   */
  setMasterVolume(volume) {
    if (this.mixBus) {
      const clamped = Math.max(0, Math.min(2.0, volume));
      this.mixBus.gain.setValueAtTime(this.mixBus.gain.value, this.audioCtx.currentTime);
      this.mixBus.gain.linearRampToValueAtTime(clamped, this.audioCtx.currentTime + 0.1);
    }
  }

  /**
   * Получает статистику микшера
   */
  getStats() {
    return {
      participants: this.participants.size,
      isInitialized: this.isInitialized,
      contextState: this.audioCtx?.state || 'not-initialized'
    };
  }

  /**
   * Очищает ресурсы микшера
   */
  async cleanup() {
    try {
      // Отключаем всех участников
      for (const [socketId, participant] of this.participants) {
        participant.disconnect();
      }
      this.participants.clear();

      // Отключаем узлы микшера
      if (this.mixBus) {
        this.mixBus.disconnect();
      }
      if (this.busComp) {
        this.busComp.disconnect();
      }
      if (this.busLimiter) {
        this.busLimiter.disconnect();
      }

      // Закрываем контекст
      if (this.audioCtx && this.audioCtx.state !== 'closed') {
        await this.audioCtx.close();
      }

      this.isInitialized = false;
      console.log('✅ Аудио-микшер очищен');
    } catch (error) {
      console.error('Ошибка очистки аудио-микшера:', error);
    }
  }
}

// Создаём глобальный экземпляр микшера
const audioMixer = new AudioMixer();

export default audioMixer;
