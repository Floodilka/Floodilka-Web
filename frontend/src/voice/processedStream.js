import { getUserMediaWithFallback, buildTrackConstraints, SPEECH_CONTENT_HINT } from './audioConstraints';
import { createProcessingGraph } from './audioProcessing';

/**
 * Получает обработанный поток микрофона для WebRTC
 * Применяет полную цепочку обработки звука (как в тестовом режиме)
 *
 * @param {Object} settings - Настройки аудио
 * @returns {Object} { processed, track, proc } - Обработанный поток, трек и граф обработки
 */
export async function getProcessedMicStream(settings) {
  try {
    // 1) Берём микрофон с фолбэками
    const { stream: rawStream } = await getUserMediaWithFallback(settings);

    // 2) Пропускаем через продакшн-цепочку (HPF/Notch/Gate/De-esser/Comp/LPF/Limiter)
    const proc = await createProcessingGraph(rawStream, {
      inputVolume: settings?.inputVolume ?? 100,
      micSensitivity: settings?.micSensitivity ?? 1,
      audioProfile: settings?.audioProfile ?? 'speech',
    });

    if (!proc) {
      throw new Error('Не удалось создать граф обработки звука');
    }

    const processed = proc.stream;

    // 3) Настраиваем трек под речь
    const track = processed.getAudioTracks()[0];
    if (!track) {
      throw new Error('Не найден аудио-трек в обработанном потоке');
    }

    // Устанавливаем contentHint для оптимизации под речь
    try {
      track.contentHint = SPEECH_CONTENT_HINT;
    } catch (err) {
      console.warn('Не удалось установить contentHint:', err);
    }

    // Применяем constraints (echo/noise/agc и выбранный микрофон)
    try {
      await track.applyConstraints(buildTrackConstraints(settings));
    } catch (err) {
      console.warn('Не удалось применить constraints к треку:', err);
    }

    return { processed, track, proc };
  } catch (error) {
    console.error('Ошибка получения обработанного потока микрофона:', error);
    throw error;
  }
}

/**
 * Настраивает параметры кодирования для RTCPeerConnection
 *
 * @param {RTCRtpSender} sender - Отправитель трека
 * @param {Object} settings - Настройки аудио
 */
export async function configureAudioEncoding(sender, settings) {
  try {
    const params = sender.getParameters();
    if (!params.encodings || params.encodings.length === 0) {
      params.encodings = [{}];
    }

    // Настраиваем битрейт для речи (моно)
    const bitrate = Math.max(16000, Math.min(settings?.audioBitrate ?? 64000, 128000));

    params.encodings[0] = {
      ...params.encodings[0],
      maxBitrate: bitrate,
      priority: 'high',
    };

    // networkPriority поддерживается не во всех браузерах
    try {
      params.encodings[0].networkPriority = 'high';
    } catch (error) {
      // Игнорируем ошибку для старых браузеров
    }

    await sender.setParameters(params);
    console.log(`✅ Настроен битрейт аудио: ${bitrate} bps`);
  } catch (error) {
    console.error('Ошибка настройки кодирования аудио:', error);
  }
}

/**
 * Модифицирует SDP для настройки Opus кодека
 * Включает DTX, FEC, ptime 20ms для оптимального качества речи
 *
 * @param {string} sdp - Исходный SDP
 * @param {Object} options - Параметры Opus
 * @returns {string} Модифицированный SDP
 */
export function tuneOpusInOffer(sdp, {
  stereo = 0,
  dtx = 1,
  fec = 1,
  ptime = 20,
  maxAverageBitrate = 64000,
  maxPlaybackRate = 16000,
  cbr = 1,
  audioProfile = 'speech'
} = {}) {
  return sdp
    .replace(/a=fmtp:(\d+) (.*)\r\n/g, (line, pt, params) => {
      if (!/opus/i.test(sdp)) return line;

      const dict = Object.fromEntries(
        params.split(';').map(kv => kv.trim().split('='))
      );

      // Настраиваем параметры Opus в зависимости от профиля
      if (audioProfile === 'music') {
        // Для музыки: стерео, больше битрейт, меньше DTX
        dict.stereo = '1';
        dict.useinbandfec = '0'; // FEC не нужен для музыки
        dict.usedtx = '0'; // DTX отключаем для музыки
        dict.ptime = '10'; // Меньшая задержка для музыки
        dict.maxplaybackrate = '48000'; // Полная частота дискретизации
        dict.maxaveragebitrate = '128000'; // Больше битрейт для музыки
        dict.cbr = '0'; // VBR лучше для музыки
      } else {
        // Для речи: моно, оптимизированный битрейт, DTX+FEC
        dict.stereo = String(stereo);
        dict.useinbandfec = String(fec);
        dict.usedtx = String(dtx);
        dict.ptime = String(ptime);
        dict.maxplaybackrate = String(maxPlaybackRate);
        dict.maxaveragebitrate = String(maxAverageBitrate);
        dict.cbr = String(cbr);
      }

      const rebuilt = Object.entries(dict)
        .map(([k, v]) => `${k}=${v}`)
        .join(';');

      return `a=fmtp:${pt} ${rebuilt}\r\n`;
    })
    .replace(/a=stereo:1/g, 'a=stereo:0'); // Принудительно моно
}

/**
 * Создаёт оптимизированный offer для голосового канала
 *
 * @param {RTCPeerConnection} pc - PeerConnection
 * @param {Object} settings - Настройки аудио
 * @returns {RTCSessionDescriptionInit} Оптимизированный offer
 */
export async function createOptimizedOffer(pc, settings) {
  try {
    let offer = await pc.createOffer({ offerToReceiveAudio: true });

    // Модифицируем SDP для оптимального качества в зависимости от профиля
    const audioProfile = settings?.audioProfile ?? 'speech';

    if (audioProfile === 'music') {
      offer.sdp = tuneOpusInOffer(offer.sdp, {
        maxAverageBitrate: settings?.audioBitrate ?? 128000,
        ptime: 10, // 10ms для музыки
        dtx: 0,    // DTX отключен для музыки
        fec: 0,    // FEC не нужен для музыки
        stereo: 1, // Стерео для музыки
        maxPlaybackRate: 48000, // Полная частота для музыки
        cbr: 0,    // VBR для музыки
        audioProfile: 'music'
      });
    } else {
      offer.sdp = tuneOpusInOffer(offer.sdp, {
        maxAverageBitrate: settings?.audioBitrate ?? 64000,
        ptime: 20, // 20ms для низкой задержки
        dtx: 1,    // DTX для экономии трафика в тишине
        fec: 1,    // FEC для восстановления потерянных пакетов
        stereo: 0, // Моно для речи
        maxPlaybackRate: 16000, // Достаточно для речи
        cbr: 1,    // Постоянный битрейт
        audioProfile: 'speech'
      });
    }

    console.log('✅ Создан оптимизированный offer для речи');
    return offer;
  } catch (error) {
    console.error('Ошибка создания оптимизированного offer:', error);
    throw error;
  }
}
