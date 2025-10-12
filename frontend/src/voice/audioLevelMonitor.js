const DEFAULT_INTERVAL = 200;
const SPEAKING_THRESHOLD = 0.02;
const SPEAKING_HYSTERESIS = 0.01;
const MINIMUM_SPEAKING_MS = 200;
const SILENCE_HOLD_MS = 400;

export class AudioLevelMonitor {
  constructor({ interval = DEFAULT_INTERVAL, onChange }) {
    this.interval = interval;
    this.onChange = onChange;
    this.timer = null;
    this.active = false;
    this.lastSpokeAt = null;
    this.lastSilenceAt = null;
    this.lastEmittedState = false;
  }

  start(sourceFactory) {
    if (this.active) {
      return;
    }
    this.active = true;
    this.timer = setInterval(async () => {
      if (!this.active) {
        return;
      }
      try {
        const level = await sourceFactory();
        this.handleLevel(level);
      } catch (err) {
        console.warn('AudioLevelMonitor sample failed', err);
      }
    }, this.interval);
  }

  handleLevel(level) {
    const now = Date.now();
    const currentlySpeaking = this.lastEmittedState;

    if (level > SPEAKING_THRESHOLD) {
      this.lastSpokeAt = now;
      if (!currentlySpeaking) {
        if (!this.lastSilenceAt || now - this.lastSilenceAt > MINIMUM_SPEAKING_MS) {
          this.lastEmittedState = true;
          this.onChange?.(true, level);
        }
      } else {
        this.onChange?.(true, level);
      }
      return;
    }

    if (level < SPEAKING_HYSTERESIS) {
      this.lastSilenceAt = now;
      if (currentlySpeaking && (!this.lastSpokeAt || now - this.lastSpokeAt > SILENCE_HOLD_MS)) {
        this.lastEmittedState = false;
        this.onChange?.(false, level);
      } else if (currentlySpeaking) {
        this.onChange?.(true, level);
      } else {
        this.onChange?.(false, level);
      }
    }
  }

  stop() {
    this.active = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

export function makeReceiverSampler(receiver) {
  return async () => {
    const sources = receiver.getSynchronizationSources?.();
    if (!sources || sources.length === 0) {
      return 0;
    }
    return sources[0].audioLevel ?? 0;
  };
}

export function makeSenderSampler(sender) {
  return async () => {
    const stats = await sender.getStats();
    let level = 0;
    stats.forEach((report) => {
      if (report.type === 'outbound-rtp' && report.kind === 'audio' && typeof report.audioLevel === 'number') {
        level = Math.max(level, report.audioLevel);
      }
    });
    return level;
  };
}

