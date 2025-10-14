const REMOTE_AUDIO_CLASS = 'voice-remote-audio';

export class RemoteAudioPlayer {
  constructor({ id, stream, initialVolume = 1, sinkId }) {
    this.id = id;
    this.stream = stream;
    this.element = this.createAudioElement(id);
    this.setStream(stream);
    this.setVolume(initialVolume);
    if (sinkId && sinkId !== 'default') {
      this.setSinkId(sinkId);
    }
  }

  createAudioElement(id) {
    const existing = document.getElementById(`voice-remote-${id}`);
    if (existing) {
      existing.srcObject = null;
      existing.remove();
    }

    const el = document.createElement('audio');
    el.id = `voice-remote-${id}`;
    el.dataset.socketId = id;
    el.autoplay = true;
    el.playsInline = true;
    el.classList.add(REMOTE_AUDIO_CLASS);
    el.setAttribute('aria-hidden', 'true');
    document.body.appendChild(el);
    return el;
  }

  setStream(stream) {
    if (!stream) return;
    this.stream = stream;
    this.element.srcObject = stream;
  }

  setVolume(volume) {
    if (Number.isFinite(volume)) {
      this.element.volume = Math.min(1, Math.max(0, volume));
    }
  }

  setMuted(muted) {
    this.element.muted = Boolean(muted);
  }

  async setSinkId(sinkId) {
    if (!this.element.setSinkId || !sinkId || sinkId === 'default') return;
    try {
      await this.element.setSinkId(sinkId);
    } catch (err) {
      console.warn('Failed to set sinkId for remote audio element', sinkId, err);
    }
  }

  destroy() {
    try {
      this.element.pause();
      this.element.srcObject = null;
      this.element.remove();
    } catch (err) {
      console.warn('Failed to cleanup remote audio element', err);
    }
  }
}

export function teardownAllRemoteAudio() {
  document.querySelectorAll(`.${REMOTE_AUDIO_CLASS}`).forEach((el) => {
    try {
      el.pause();
      el.srcObject = null;
      el.remove();
    } catch (err) {
      console.warn('Failed to teardown remote audio element', err);
    }
  });
}

