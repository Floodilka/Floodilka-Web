function getAudioContextClass() {
  return window.AudioContext || window.webkitAudioContext || null;
}

/**
 * Создает профессиональный граф обработки звука для голосового чата.
 *
 * Цепочка обработки (Production-Ready):
 * 1. High-Pass Filter - убирает низкочастотные шумы (грохот, вибрации)
 * 2. Notch Filter - устраняет гудение электросети (50/60 Hz)
 * 3. Noise Gate - умные шумовые ворота для чистого звука
 * 4. De-Esser - убирает шипение на высоких частотах
 * 5. Compressor - выравнивает динамический диапазон
 * 6. Low-Pass Filter - убирает сверхвысокие частоты
 * 7. Input Gain - контроль громкости микрофона
 * 8. Limiter - предотвращает перегрузку и клиппинг
 *
 * @param {MediaStream} stream - Входной поток с микрофона
 * @param {Object} options - Настройки обработки
 * @param {number} options.inputVolume - Громкость входа (0-200%)
 * @param {number} options.micSensitivity - Порог активации голоса (0-50)
 * @returns {Object} Граф обработки с обработанным потоком и управлением
 */
export async function createProcessingGraph(stream, {
  inputVolume = 100,
  micSensitivity = 1
} = {}) {
  const AudioContextClass = getAudioContextClass();
  if (!AudioContextClass) {
    return null;
  }

  // Создаем контекст с оптимальными настройками для голоса
  const context = new AudioContextClass({
    sampleRate: 48000, // Стандарт для качественного аудио
    latencyHint: 'interactive', // Минимальная задержка
  });

  const source = context.createMediaStreamSource(stream);
  const destination = context.createMediaStreamDestination();

  // ========== 1. HIGH-PASS FILTER ==========
  // Убирает низкочастотные шумы (грохот, вибрации, дыхание)
  const highPass = context.createBiquadFilter();
  highPass.type = 'highpass';
  highPass.frequency.value = 100; // Человеческий голос начинается от 85-100 Hz
  highPass.Q.value = 1.0; // Резкость среза

  // ========== 2. NOTCH FILTER ==========
  // Устраняет гудение от электросети (50 Hz в Европе, 60 Hz в США)
  const notchFilter = context.createBiquadFilter();
  notchFilter.type = 'notch';
  notchFilter.frequency.value = 50; // Европейский стандарт
  notchFilter.Q.value = 10; // Узкий срез

  // ========== 3. NOISE GATE (Анализатор + Gain) ==========
  // Создаем анализатор для определения уровня звука
  const noiseGateAnalyser = context.createAnalyser();
  noiseGateAnalyser.fftSize = 2048;
  noiseGateAnalyser.smoothingTimeConstant = 0.3; // Быстрая реакция

  // Gain-узел для Noise Gate
  const noiseGateGain = context.createGain();
  noiseGateGain.gain.value = 0; // Начинаем с закрытых "ворот"

  // Буфер для анализа
  const noiseGateDataArray = new Uint8Array(noiseGateAnalyser.frequencyBinCount);

  // Состояние Noise Gate
  let gateOpen = false;
  let noiseGateTimer = null;
  let currentGateThreshold = 15; // Текущий порог

  // Параметры Noise Gate
  const GATE_ATTACK_TIME = 0.01; // 10ms - время открытия ворот
  const GATE_RELEASE_TIME = 0.1; // 100ms - время закрытия ворот
  const GATE_HYSTERESIS = 0.7; // Гистерезис для предотвращения дребезга
  const GATE_UPDATE_INTERVAL = 20; // 20ms - обновление Noise Gate (50 раз в секунду)

  // ========== 4. DE-ESSER ==========
  // Убирает шипение на высоких частотах (s, sh, ch звуки)
  const deEsser = context.createBiquadFilter();
  deEsser.type = 'peaking';
  deEsser.frequency.value = 7000; // Частота шипения
  deEsser.Q.value = 1.5; // Ширина среза
  deEsser.gain.value = -3; // Ослабление на 3 дБ

  // ========== 5. COMPRESSOR ==========
  // Выравнивает динамический диапазон (тихое становится громче, громкое - тише)
  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -24; // Порог срабатывания
  compressor.knee.value = 30; // Плавность компрессии
  compressor.ratio.value = 12; // Степень сжатия
  compressor.attack.value = 0.003; // 3ms - быстрая атака
  compressor.release.value = 0.25; // 250ms - средний релиз

  // ========== 6. LOW-PASS FILTER ==========
  // Убирает сверхвысокие частоты (шипение, шум)
  const lowPass = context.createBiquadFilter();
  lowPass.type = 'lowpass';
  lowPass.frequency.value = 10000; // Человеческий голос до 8-10 kHz
  lowPass.Q.value = 0.7; // Плавный срез

  // ========== 7. INPUT GAIN ==========
  // Контроль громкости микрофона
  const inputGain = context.createGain();
  inputGain.gain.value = normaliseInputVolume(inputVolume);

  // ========== 8. LIMITER ==========
  // Предотвращает перегрузку и клиппинг
  const limiter = context.createDynamicsCompressor();
  limiter.threshold.value = -1; // Жесткий лимит
  limiter.knee.value = 0; // Без мягкости
  limiter.ratio.value = 20; // Максимальное сжатие
  limiter.attack.value = 0.001; // 1ms - мгновенная атака
  limiter.release.value = 0.01; // 10ms - быстрый релиз

  // ========== 9. ANALYSER ==========
  // Финальный анализатор для визуализации и мониторинга
  const analyser = context.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.4;

  // ========== ПОСТРОЕНИЕ ЦЕПОЧКИ ==========
  source
    .connect(highPass)        // 1. Убираем низкие частоты
    .connect(notchFilter)     // 2. Убираем гудение
    .connect(noiseGateAnalyser); // 3. Анализируем для Noise Gate

  noiseGateAnalyser
    .connect(noiseGateGain)   // 3. Применяем Noise Gate
    .connect(deEsser)         // 4. Убираем шипение
    .connect(compressor)      // 5. Выравниваем громкость
    .connect(lowPass)         // 6. Убираем высокие частоты
    .connect(inputGain)       // 7. Контроль громкости
    .connect(limiter)         // 8. Защита от перегрузки
    .connect(analyser)        // 9. Финальный анализ
    .connect(destination);    // Выход

  const dataArray = new Uint8Array(analyser.frequencyBinCount);

  // ========== NOISE GATE LOGIC ==========
  // Функция обновления Noise Gate в реальном времени
  // Использует setInterval вместо requestAnimationFrame для надежной работы на фоновых вкладках
  const updateNoiseGate = () => {
    if (context.state === 'closed') return;

    // Возобновляем контекст если он suspended (может произойти на фоновых вкладках)
    if (context.state === 'suspended') {
      context.resume().catch(err => {
        console.warn('Failed to resume audio context in noise gate', err);
      });
    }

    noiseGateAnalyser.getByteTimeDomainData(noiseGateDataArray);

    // Вычисляем RMS (Root Mean Square) для точного определения громкости
    let sum = 0;
    for (let i = 0; i < noiseGateDataArray.length; i++) {
      const normalized = (noiseGateDataArray[i] - 128) / 128;
      sum += normalized * normalized;
    }
    const rms = Math.sqrt(sum / noiseGateDataArray.length);
    const level = rms * 255;

    const currentTime = context.currentTime;

    // Логика открытия/закрытия ворот с гистерезисом
    if (level > currentGateThreshold) {
      // Звук выше порога - открываем ворота
      if (!gateOpen) {
        noiseGateGain.gain.cancelScheduledValues(currentTime);
        noiseGateGain.gain.setValueAtTime(noiseGateGain.gain.value, currentTime);
        noiseGateGain.gain.linearRampToValueAtTime(1.0, currentTime + GATE_ATTACK_TIME);
        gateOpen = true;
      }
    } else if (level < currentGateThreshold * GATE_HYSTERESIS) {
      // Звук ниже порога с гистерезисом - закрываем ворота
      if (gateOpen) {
        noiseGateGain.gain.cancelScheduledValues(currentTime);
        noiseGateGain.gain.setValueAtTime(noiseGateGain.gain.value, currentTime);
        noiseGateGain.gain.linearRampToValueAtTime(0.0, currentTime + GATE_RELEASE_TIME);
        gateOpen = false;
      }
    }
  };

  // Вычисляем порог из micSensitivity и запускаем Noise Gate с помощью setInterval
  // setInterval работает надежнее на фоновых вкладках чем requestAnimationFrame
  currentGateThreshold = computeGateThreshold(micSensitivity);
  noiseGateTimer = setInterval(updateNoiseGate, GATE_UPDATE_INTERVAL);

  // ========== API ФУНКЦИИ ==========

  /**
   * Вычисляет текущий уровень звука (0.0 - 1.0)
   */
  const computeVolume = () => {
    analyser.getByteFrequencyData(dataArray);
    let total = 0;
    for (let i = 0; i < dataArray.length; i += 1) {
      total += dataArray[i];
    }
    return total / dataArray.length / 255;
  };

  /**
   * Обновляет громкость микрофона (0-200%)
   */
  const updateInputVolume = (volumePercent) => {
    const newGain = normaliseInputVolume(volumePercent);
    const currentTime = context.currentTime;
    inputGain.gain.cancelScheduledValues(currentTime);
    inputGain.gain.setValueAtTime(inputGain.gain.value, currentTime);
    inputGain.gain.linearRampToValueAtTime(newGain, currentTime + 0.05); // Плавное изменение
  };

  /**
   * Обновляет порог активации голоса (0-50)
   */
  const updateMicSensitivity = (sensitivity) => {
    currentGateThreshold = computeGateThreshold(sensitivity);
    // Порог обновится в следующей итерации updateNoiseGate автоматически
  };

  /**
   * Очистка ресурсов
   */
  const teardown = async () => {
    // Останавливаем Noise Gate
    if (noiseGateTimer !== null) {
      clearInterval(noiseGateTimer);
      noiseGateTimer = null;
    }

    // Отключаем все узлы
    try {
      source.disconnect();
    } catch (err) {
      console.warn('Audio processing cleanup failed (source)', err);
    }

    [
      highPass,
      notchFilter,
      noiseGateAnalyser,
      noiseGateGain,
      deEsser,
      compressor,
      lowPass,
      inputGain,
      limiter,
      analyser,
      destination
    ].forEach((node) => {
      try {
        node.disconnect();
      } catch (err) {
        // ignore disconnection errors
      }
    });

    // Закрываем контекст
    try {
      if (context && context.state !== 'closed') {
        await context.close();
      }
    } catch (err) {
      console.warn('Audio processing cleanup failed (context)', err);
    }
  };

  return {
    stream: destination.stream,
    context,
    analyser,
    computeVolume,
    updateInputVolume,
    updateMicSensitivity,
    teardown,
  };
}

/**
 * Нормализует громкость микрофона (0-200%) в коэффициент усиления
 * Линейная шкала для предсказуемости и отсутствия искажений
 */
function normaliseInputVolume(percent) {
  if (!Number.isFinite(percent)) {
    return 1;
  }
  const clamped = Math.max(0, Math.min(200, percent));
  // Линейная шкала: 0% = 0.0, 100% = 1.0, 200% = 2.0
  return clamped / 100;
}

/**
 * Вычисляет порог Noise Gate из значения micSensitivity (0-50)
 *
 * Логика:
 * - 0 = максимальная чувствительность (порог 5)
 * - 1-5 = оптимальный диапазон (порог 10-30)
 * - 50 = минимальная чувствительность (порог 128)
 */
function computeGateThreshold(sensitivity) {
  if (!Number.isFinite(sensitivity)) {
    return 15; // Значение по умолчанию
  }

  const clamped = Math.max(0, Math.min(50, sensitivity));

  // Логарифмическая шкала для более естественного восприятия
  // 0 -> 5 (очень чувствительный)
  // 1 -> 10 (чувствительный)
  // 5 -> 30 (оптимально)
  // 25 -> 80 (средне)
  // 50 -> 128 (минимум чувствительности)

  if (clamped === 0) return 5;
  if (clamped <= 5) return 10 + (clamped * 4);
  return 30 + ((clamped - 5) / 45) * 98;
}

