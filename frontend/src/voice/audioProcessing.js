function getAudioContextClass() {
  return window.AudioContext || window.webkitAudioContext || null;
}

export async function createProcessingGraph(stream, { inputVolume = 100 } = {}) {
  const AudioContextClass = getAudioContextClass();
  if (!AudioContextClass) {
    return null;
  }

  const context = new AudioContextClass({
    sampleRate: 48000,
    latencyHint: 'interactive',
  });

  const source = context.createMediaStreamSource(stream);
  const destination = context.createMediaStreamDestination();

  const highPass = context.createBiquadFilter();
  highPass.type = 'highpass';
  highPass.frequency.value = 80;
  highPass.Q.value = 0.8;

  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -28;
  compressor.knee.value = 30;
  compressor.ratio.value = 12;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.25;

  const lowPass = context.createBiquadFilter();
  lowPass.type = 'lowpass';
  lowPass.frequency.value = 12000;
  lowPass.Q.value = 0.7;

  const inputGain = context.createGain();
  inputGain.gain.value = normaliseInputVolume(inputVolume);

  const limiter = context.createDynamicsCompressor();
  limiter.threshold.value = -2;
  limiter.knee.value = 1;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.05;

  const analyser = context.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.4;

  source
    .connect(highPass)
    .connect(compressor)
    .connect(lowPass)
    .connect(inputGain)
    .connect(limiter)
    .connect(analyser)
    .connect(destination);

  const dataArray = new Uint8Array(analyser.frequencyBinCount);

  const computeVolume = () => {
    analyser.getByteFrequencyData(dataArray);
    let total = 0;
    for (let i = 0; i < dataArray.length; i += 1) {
      total += dataArray[i];
    }
    return total / dataArray.length / 255;
  };

  const updateInputVolume = (volumePercent) => {
    inputGain.gain.value = normaliseInputVolume(volumePercent);
  };

  const teardown = async () => {
    try {
      source.disconnect();
    } catch (err) {
      console.warn('Audio processing cleanup failed (source)', err);
    }

    [highPass, compressor, lowPass, inputGain, limiter, analyser, destination].forEach((node) => {
      try {
        node.disconnect();
      } catch (err) {
        // ignore disconnection errors
      }
    });

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
    teardown,
  };
}

function normaliseInputVolume(percent) {
  if (!Number.isFinite(percent)) {
    return 1;
  }
  const clamped = Math.max(0, Math.min(200, percent));
  if (clamped <= 100) {
    return clamped / 100;
  }
  // Soft knee ramp for >100%
  return 1 + ((clamped - 100) / 100) * 1.5;
}

