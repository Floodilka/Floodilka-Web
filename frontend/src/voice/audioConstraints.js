const BASE_AUDIO_CONSTRAINT = {
  channelCount: { ideal: 1, min: 1 },
  sampleRate: { ideal: 48000, min: 44100 },
  sampleSize: { ideal: 16 },
  echoCancellation: { ideal: true },
  noiseSuppression: { ideal: true },
  autoGainControl: { ideal: true },
  latency: { ideal: 0.01, max: 0.2 },
};

const ADVANCED_CHROME_PARAMS = {
  googEchoCancellation: true,
  googEchoCancellation2: true,
  googAutoGainControl: true,
  googAutoGainControl2: true,
  googNoiseSuppression: true,
  googNoiseSuppression2: true,
  googHighpassFilter: true,
  googTypingNoiseDetection: true,
  googAudioMirroring: false,
};

const tieredConstraintBuilders = [
  (settings) => ({
    audio: {
      ...BASE_AUDIO_CONSTRAINT,
      echoCancellation: settings?.echoCancellation ?? true,
      noiseSuppression: settings?.noiseSuppression ?? true,
      autoGainControl: settings?.autoGainControl ?? true,
      advanced: [
        {
          ...ADVANCED_CHROME_PARAMS,
        },
      ],
      deviceId:
        settings?.selectedMicrophone && settings.selectedMicrophone !== 'default'
          ? { exact: settings.selectedMicrophone }
          : undefined,
    },
    video: false,
  }),
  (settings) => ({
    audio: {
      ...BASE_AUDIO_CONSTRAINT,
      echoCancellation: settings?.echoCancellation ?? true,
      noiseSuppression: settings?.noiseSuppression ?? true,
      autoGainControl: settings?.autoGainControl ?? true,
      deviceId:
        settings?.selectedMicrophone && settings.selectedMicrophone !== 'default'
          ? { exact: settings.selectedMicrophone }
          : undefined,
    },
    video: false,
  }),
  (settings) => ({
    audio:
      settings?.selectedMicrophone && settings.selectedMicrophone !== 'default'
        ? { deviceId: { exact: settings.selectedMicrophone } }
        : true,
    video: false,
  }),
];

export const SPEECH_CONTENT_HINT = 'speech';

export async function getUserMediaWithFallback(settings = {}) {
  const errors = [];

  for (const build of tieredConstraintBuilders) {
    const constraints = build(settings);
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      return { stream, constraints };
    } catch (err) {
      errors.push({ constraints, error: err });
    }
  }

  const aggregate = new Error('Unable to acquire audio input with any constraint set');
  aggregate.name = 'AudioAcquisitionError';
  aggregate.failures = errors;
  throw aggregate;
}

export function buildTrackConstraints(settings = {}) {
  const base = {
    echoCancellation: settings?.echoCancellation ?? true,
    noiseSuppression: settings?.noiseSuppression ?? true,
    autoGainControl: settings?.autoGainControl ?? true,
  };

  if (settings?.selectedMicrophone && settings.selectedMicrophone !== 'default') {
    base.deviceId = settings.selectedMicrophone;
  }

  return base;
}

