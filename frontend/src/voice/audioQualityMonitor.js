/**
 * Мониторинг качества звука для голосового чата
 * Отслеживает статистику WebRTC и предоставляет рекомендации по улучшению
 */

class AudioQualityMonitor {
  constructor() {
    this.stats = {
      // Статистика отправки
      outgoing: {
        bitrate: 0,
        packetsLost: 0,
        packetsSent: 0,
        jitter: 0,
        rtt: 0,
        concealedSamples: 0,
        totalAudioEnergy: 0,
        audioLevel: 0
      },
      // Статистика приёма
      incoming: {
        bitrate: 0,
        packetsLost: 0,
        packetsReceived: 0,
        jitter: 0,
        concealedSamples: 0,
        audioLevel: 0
      },
      // Общее качество
      quality: 'excellent', // excellent, good, fair, poor
      recommendations: []
    };

    this.monitoringInterval = null;
    this.isMonitoring = false;
    this.callbacks = {
      onQualityChange: null,
      onRecommendation: null
    };
  }

  /**
   * Начинает мониторинг качества
   *
   * @param {RTCPeerConnection} pc - PeerConnection для мониторинга
   * @param {Object} options - Опции мониторинга
   */
  startMonitoring(pc, options = {}) {
    if (this.isMonitoring) {
      this.stopMonitoring();
    }

    this.pc = pc;
    this.monitoringInterval = setInterval(() => {
      this.collectStats();
    }, options.interval || 5000); // Каждые 5 секунд

    this.isMonitoring = true;
    console.log('✅ Мониторинг качества звука запущен');
  }

  /**
   * Останавливает мониторинг
   */
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
    console.log('✅ Мониторинг качества звука остановлен');
  }

  /**
   * Собирает статистику WebRTC
   */
  async collectStats() {
    if (!this.pc) return;

    try {
      const stats = await this.pc.getStats();
      const newStats = this.parseStats(stats);

      // Обновляем статистику
      this.stats = { ...this.stats, ...newStats };

      // Анализируем качество
      this.analyzeQuality();

      // Вызываем колбэки
      if (this.callbacks.onQualityChange) {
        this.callbacks.onQualityChange(this.stats);
      }

      if (this.stats.recommendations.length > 0 && this.callbacks.onRecommendation) {
        this.callbacks.onRecommendation(this.stats.recommendations);
      }
    } catch (error) {
      console.warn('Ошибка сбора статистики WebRTC:', error);
    }
  }

  /**
   * Парсит статистику WebRTC
   *
   * @param {RTCStatsReport} stats - Статистика WebRTC
   * @returns {Object} Обработанная статистика
   */
  parseStats(stats) {
    const result = {
      outgoing: { ...this.stats.outgoing },
      incoming: { ...this.stats.incoming },
      quality: 'excellent',
      recommendations: []
    };

    stats.forEach((report) => {
      if (report.type === 'outbound-rtp' && report.mediaType === 'audio') {
        // Статистика отправки
        result.outgoing.bitrate = report.bytesSent * 8 / 5; // Примерный битрейт за 5 сек
        result.outgoing.packetsSent = report.packetsSent || 0;
        result.outgoing.packetsLost = report.packetsLost || 0;
        result.outgoing.jitter = report.jitter || 0;
        result.outgoing.rtt = report.roundTripTime || 0;
      }

      if (report.type === 'inbound-rtp' && report.mediaType === 'audio') {
        // Статистика приёма
        result.incoming.bitrate = report.bytesReceived * 8 / 5;
        result.incoming.packetsReceived = report.packetsReceived || 0;
        result.incoming.packetsLost = report.packetsLost || 0;
        result.incoming.jitter = report.jitter || 0;
      }

      if (report.type === 'media-source' && report.kind === 'audio') {
        // Уровень аудио
        result.outgoing.audioLevel = report.audioLevel || 0;
        result.outgoing.totalAudioEnergy = report.totalAudioEnergy || 0;
      }

      if (report.type === 'remote-inbound-rtp' && report.mediaType === 'audio') {
        // Удалённая статистика
        result.outgoing.concealedSamples = report.concealedSamples || 0;
      }
    });

    return result;
  }

  /**
   * Анализирует качество соединения
   */
  analyzeQuality() {
    const { outgoing, incoming } = this.stats;
    const recommendations = [];

    // Анализ потери пакетов
    const outgoingLossRate = outgoing.packetsLost / Math.max(outgoing.packetsSent, 1);
    const incomingLossRate = incoming.packetsLost / Math.max(incoming.packetsReceived, 1);

    if (outgoingLossRate > 0.05) { // >5% потерь
      recommendations.push({
        type: 'network',
        severity: 'high',
        message: 'Высокая потеря пакетов при отправке. Проверьте интернет-соединение.',
        action: 'Попробуйте снизить битрейт или переподключиться'
      });
    }

    if (incomingLossRate > 0.05) {
      recommendations.push({
        type: 'network',
        severity: 'high',
        message: 'Высокая потеря пакетов при приёме. Проблемы с сетью собеседника.',
        action: 'Попросите собеседника проверить соединение'
      });
    }

    // Анализ джиттера
    if (outgoing.jitter > 50) { // >50ms джиттер
      recommendations.push({
        type: 'network',
        severity: 'medium',
        message: 'Высокий джиттер. Нестабильное соединение.',
        action: 'Попробуйте переподключиться или сменить сеть'
      });
    }

    // Анализ RTT
    if (outgoing.rtt > 300) { // >300ms задержка
      recommendations.push({
        type: 'network',
        severity: 'medium',
        message: 'Высокая задержка соединения.',
        action: 'Проверьте интернет-соединение или выберите ближайший сервер'
      });
    }

    // Анализ битрейта
    if (outgoing.bitrate < 16000) { // <16kbps
      recommendations.push({
        type: 'audio',
        severity: 'low',
        message: 'Низкий битрейт аудио.',
        action: 'Попробуйте увеличить битрейт в настройках'
      });
    }

    // Анализ уровня аудио
    if (outgoing.audioLevel < 0.01) { // Очень тихий микрофон
      recommendations.push({
        type: 'audio',
        severity: 'medium',
        message: 'Очень низкий уровень микрофона.',
        action: 'Увеличьте громкость микрофона или говорите ближе к микрофону'
      });
    }

    // Определяем общее качество
    let quality = 'excellent';
    if (recommendations.some(r => r.severity === 'high')) {
      quality = 'poor';
    } else if (recommendations.some(r => r.severity === 'medium')) {
      quality = 'fair';
    } else if (recommendations.some(r => r.severity === 'low')) {
      quality = 'good';
    }

    this.stats.quality = quality;
    this.stats.recommendations = recommendations;
  }

  /**
   * Получает текущую статистику
   *
   * @returns {Object} Текущая статистика
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Устанавливает колбэк для изменений качества
   *
   * @param {Function} callback - Колбэк (stats) => {}
   */
  onQualityChange(callback) {
    this.callbacks.onQualityChange = callback;
  }

  /**
   * Устанавливает колбэк для рекомендаций
   *
   * @param {Function} callback - Колбэк (recommendations) => {}
   */
  onRecommendation(callback) {
    this.callbacks.onRecommendation = callback;
  }

  /**
   * Получает текстовое описание качества
   *
   * @returns {string} Описание качества
   */
  getQualityDescription() {
    const descriptions = {
      excellent: 'Отличное качество',
      good: 'Хорошее качество',
      fair: 'Удовлетворительное качество',
      poor: 'Плохое качество'
    };
    return descriptions[this.stats.quality] || 'Неизвестно';
  }

  /**
   * Получает цвет индикатора качества
   *
   * @returns {string} CSS цвет
   */
  getQualityColor() {
    const colors = {
      excellent: '#00ff00',
      good: '#ffff00',
      fair: '#ff8800',
      poor: '#ff0000'
    };
    return colors[this.stats.quality] || '#888888';
  }

  /**
   * Очищает ресурсы
   */
  destroy() {
    this.stopMonitoring();
    this.pc = null;
    this.callbacks = {
      onQualityChange: null,
      onRecommendation: null
    };
  }
}

export default AudioQualityMonitor;
