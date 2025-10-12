import { SOCKET_EVENTS } from '../constants/events';
import { getUserMediaWithFallback, SPEECH_CONTENT_HINT } from './audioConstraints';
import { createProcessingGraph } from './audioProcessing';
import { RemoteAudioPlayer, teardownAllRemoteAudio } from './remoteAudio';
import { AudioLevelMonitor, makeReceiverSampler, makeSenderSampler } from './audioLevelMonitor';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  { urls: 'stun:stun.voiparound.com' },
  { urls: 'stun:stun.voipbuster.com' },
  { urls: 'stun:stun.voipstunt.com' },
  { urls: 'stun:stun.counterpath.com' },
  { urls: 'stun:stun.1und1.de' },
];

const RTC_CONFIGURATION = {
  iceServers: ICE_SERVERS,
  iceCandidatePoolSize: 8,
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
};

const NETWORK_SAMPLE_INTERVAL = 5000;
const SPEAKING_SAMPLE_INTERVAL = 180;
const PEER_RESTART_DELAY = 2500;
const KEEP_ALIVE_INTERVAL = 15000;

const noop = () => {};

export class VoiceEngine {
  constructor({
    socket,
    channel,
    user,
    settings,
    callbacks = {},
  }) {
    this.socket = socket;
    this.channel = channel;
    this.user = user;
    this.settings = { ...settings };
    this.callbacks = {
      onParticipants: callbacks.onParticipants || noop,
      onUserJoined: callbacks.onUserJoined || noop,
      onUserLeft: callbacks.onUserLeft || noop,
      onRemoteSpeaking: callbacks.onRemoteSpeaking || noop,
      onLocalSpeaking: callbacks.onLocalSpeaking || noop,
      onConnectionState: callbacks.onConnectionState || noop,
      onNetworkQuality: callbacks.onNetworkQuality || noop,
      onError: callbacks.onError || noop,
      onUserUpdated: callbacks.onUserUpdated || noop,
    };

    this.peerConnections = new Map();
    this.remotePlayers = new Map();
    this.remoteMonitors = new Map();
    this.localStream = null;
    this.originalStream = null;
    this.processingGraph = null;
    this.localSenderMonitor = null;
    this.networkMonitorTimer = null;
    this.started = false;
    this.destroyed = false;
    this.isMuted = false;
    this.isDeafened = false;
    this.remoteOutputVolume = this.normaliseOutputVolume(this.settings?.outputVolume ?? 100);
    this.userVolumeOverrides = new Map();
    this.keepAliveTimer = null;
    this.peerRestartTimers = new Map();
    this.lastNetworkQuality = 'excellent';
    this.pttActive = false;

    this.visibilityListener = this.handleVisibilityChange.bind(this);
    this.deviceChangeListener = this.handleDeviceChange.bind(this);
    this.handleSocketUsers = this.handleSocketUsers.bind(this);
    this.handleSocketUserJoined = this.handleSocketUserJoined.bind(this);
    this.handleSocketUserLeft = this.handleSocketUserLeft.bind(this);
    this.handleSocketMuted = this.handleSocketMuted.bind(this);
    this.handleSocketDeafened = this.handleSocketDeafened.bind(this);
    this.handleSocketOffer = this.handleSocketOffer.bind(this);
    this.handleSocketAnswer = this.handleSocketAnswer.bind(this);
    this.handleSocketIceCandidate = this.handleSocketIceCandidate.bind(this);
  }

  async start() {
    if (this.started || this.destroyed) return;
    if (!this.socket || !this.channel) {
      throw new Error('VoiceEngine requires socket and channel');
    }

    this.started = true;

    try {
      this.attachSocketHandlers();
      this.attachLifecycleHandlers();
      const prepared = await this.prepareLocalAudio();
      if (this.destroyed || !prepared) {
        return;
      }
      await this.joinVoiceChannel();
      if (this.destroyed) {
        return;
      }
      this.scheduleNetworkMonitoring();
      this.startKeepAlive();
      this.callbacks.onConnectionState('connected');
    } catch (err) {
      this.callbacks.onError(err);
      throw err;
    }
  }

  async stop() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.started = false;

    await this.leaveVoiceChannel();

    this.detachSocketHandlers();
    this.detachLifecycleHandlers();
    this.clearNetworkMonitoring();
    this.stopLocalMonitor();
    this.stopKeepAlive();
    this.clearPeerRestartTimers();

    this.peerConnections.forEach((pc) => {
      try {
        pc.close();
      } catch (err) {
        console.warn('Failed to close peer connection', err);
      }
    });
    this.peerConnections.clear();

    this.remoteMonitors.forEach((monitor) => monitor.stop());
    this.remoteMonitors.clear();

    this.remotePlayers.forEach((player) => player.destroy());
    this.remotePlayers.clear();
    teardownAllRemoteAudio();

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
    if (this.originalStream) {
      this.originalStream.getTracks().forEach((track) => track.stop());
      this.originalStream = null;
    }
    if (this.processingGraph) {
      this.processingGraph.teardown().catch((err) => console.warn('Failed to teardown processing graph', err));
      this.processingGraph = null;
    }

    this.callbacks.onConnectionState('disconnected');
  }

  attachSocketHandlers() {
    this.socket.on(SOCKET_EVENTS.VOICE_USERS, this.handleSocketUsers);
    this.socket.on(SOCKET_EVENTS.VOICE_USER_JOINED, this.handleSocketUserJoined);
    this.socket.on(SOCKET_EVENTS.VOICE_USER_LEFT, this.handleSocketUserLeft);
    this.socket.on(SOCKET_EVENTS.VOICE_USER_MUTED, this.handleSocketMuted);
    this.socket.on(SOCKET_EVENTS.VOICE_USER_DEAFENED, this.handleSocketDeafened);
    this.socket.on(SOCKET_EVENTS.VOICE_OFFER, this.handleSocketOffer);
    this.socket.on(SOCKET_EVENTS.VOICE_ANSWER, this.handleSocketAnswer);
    this.socket.on(SOCKET_EVENTS.VOICE_ICE_CANDIDATE, this.handleSocketIceCandidate);
  }

  detachSocketHandlers() {
    this.socket.off(SOCKET_EVENTS.VOICE_USERS, this.handleSocketUsers);
    this.socket.off(SOCKET_EVENTS.VOICE_USER_JOINED, this.handleSocketUserJoined);
    this.socket.off(SOCKET_EVENTS.VOICE_USER_LEFT, this.handleSocketUserLeft);
    this.socket.off(SOCKET_EVENTS.VOICE_USER_MUTED, this.handleSocketMuted);
    this.socket.off(SOCKET_EVENTS.VOICE_USER_DEAFENED, this.handleSocketDeafened);
    this.socket.off(SOCKET_EVENTS.VOICE_OFFER, this.handleSocketOffer);
    this.socket.off(SOCKET_EVENTS.VOICE_ANSWER, this.handleSocketAnswer);
    this.socket.off(SOCKET_EVENTS.VOICE_ICE_CANDIDATE, this.handleSocketIceCandidate);
  }

  attachLifecycleHandlers() {
    document.addEventListener('visibilitychange', this.visibilityListener);
    if (navigator?.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', this.deviceChangeListener);
    }
  }

  detachLifecycleHandlers() {
    document.removeEventListener('visibilitychange', this.visibilityListener);
    if (navigator?.mediaDevices?.removeEventListener) {
      navigator.mediaDevices.removeEventListener('devicechange', this.deviceChangeListener);
    }
  }

  async prepareLocalAudio() {
    const { stream } = await getUserMediaWithFallback(this.settings);
    if (this.destroyed) {
      stream.getTracks().forEach((track) => track.stop());
      return false;
    }

    this.originalStream = stream;
    const [audioTrack] = stream.getAudioTracks();
    if (!audioTrack) {
      throw new Error('Microphone capture did not provide an audio track');
    }
    audioTrack.contentHint = SPEECH_CONTENT_HINT;
    audioTrack.enabled = this.settings.voiceMode === 'ptt' ? false : true;
    audioTrack.addEventListener('ended', () => {
      if (this.destroyed) return;
      this.handleLocalTrackEnded();
    });

    this.processingGraph = await createProcessingGraph(stream, this.settings);
    if (this.destroyed) {
      stream.getTracks().forEach((track) => track.stop());
      if (this.processingGraph?.teardown) {
        this.processingGraph.teardown().catch(() => {});
      }
      this.processingGraph = null;
      this.originalStream = null;
      this.localStream = null;
      return false;
    }

    if (this.processingGraph?.stream) {
      this.localStream = this.processingGraph.stream;
    } else {
      this.localStream = stream;
    }

    this.startLocalMonitor();
    return true;
  }

  startLocalMonitor() {
    this.stopLocalMonitor();
    const threshold = this.computeMicThreshold();

    if (this.processingGraph?.computeVolume) {
      this.localMonitorTimer = setInterval(() => {
        if (this.destroyed) {
          return;
        }
        const level = this.processingGraph.computeVolume();
        const speaking = level >= threshold;
        this.callbacks.onLocalSpeaking(speaking, level);
      }, SPEAKING_SAMPLE_INTERVAL);
    }
  }

  stopLocalMonitor() {
    if (this.localMonitorTimer) {
      clearInterval(this.localMonitorTimer);
      this.localMonitorTimer = null;
    }
    if (this.localSenderMonitor) {
      this.localSenderMonitor.stop();
      this.localSenderMonitor = null;
    }
  }

  computeMicThreshold() {
    const sensitivity = Number(this.settings?.micSensitivity);
    if (!Number.isFinite(sensitivity)) {
      return 0.15;
    }
    const normalised = Math.max(0, Math.min(100, sensitivity)) / 100;
    return 0.05 + normalised * 0.2;
  }

  async joinVoiceChannel() {
    if (this.destroyed) return;
    const payload = {
      channelId: this.channel.id,
      username: this.user?.username,
      avatar: this.user?.avatar,
      badge: this.user?.badge,
      badgeTooltip: this.user?.badgeTooltip,
      displayName: this.user?.displayName,
      userId: this.user?._id || this.user?.id,
    };
    this.socket.emit(SOCKET_EVENTS.VOICE_JOIN, payload);
  }

  async leaveVoiceChannel() {
    if (!this.channel || !this.socket) return;
    this.socket.emit(SOCKET_EVENTS.VOICE_LEAVE, { channelId: this.channel.id });
  }

  async handleSocketUsers(users) {
    this.callbacks.onParticipants(users);
    users.forEach((u) => {
      this.ensurePeerConnection(u.id, { makeOffer: true });
    });
  }

  async handleSocketUserJoined(userInfo) {
    this.callbacks.onUserJoined(userInfo);
    this.ensurePeerConnection(userInfo.id, { makeOffer: false });
  }

  handleSocketUserLeft({ id }) {
    this.callbacks.onUserLeft(id);
    this.teardownPeer(id);
  }

  handleSocketMuted({ id, isMuted }) {
    this.callbacks.onUserUpdated({ id, isMuted });
    const player = this.remotePlayers.get(id);
    if (player) {
      player.setVolume(isMuted ? 0 : this.remoteOutputVolume || 1);
    }
  }

  handleSocketDeafened(event) {
    // Notification handled by callbacks consumer
    this.callbacks.onUserUpdated(event);
  }

  async handleSocketOffer({ offer, from }) {
    const pc = this.ensurePeerConnection(from, { makeOffer: false });
    if (!pc) return;
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer({ iceRestart: false });
      await pc.setLocalDescription(answer);
      this.socket.emit(SOCKET_EVENTS.VOICE_ANSWER, {
        answer: pc.localDescription,
        to: from,
      });
    } catch (err) {
      console.error('Failed to handle voice offer', err);
      this.callbacks.onError(err);
    }
  }

  async handleSocketAnswer({ answer, from }) {
    const pc = this.peerConnections.get(from);
    if (!pc) return;
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (err) {
      console.error('Failed to handle voice answer', err);
      this.callbacks.onError(err);
    }
  }

  async handleSocketIceCandidate({ candidate, from }) {
    const pc = this.peerConnections.get(from);
    if (!pc || !candidate) return;
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error('Failed to add ICE candidate', err);
    }
  }

  ensurePeerConnection(remoteId, { makeOffer }) {
    if (!remoteId || remoteId === this.socket.id) {
      return null;
    }

    let pc = this.peerConnections.get(remoteId);
    if (pc) {
      if (makeOffer) {
        this.createOffer(pc, remoteId);
      }
      return pc;
    }

    pc = new RTCPeerConnection(RTC_CONFIGURATION);
    this.peerConnections.set(remoteId, pc);

    this.monitorPeerConnection(remoteId, pc);

    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      this.attachRemoteStream(remoteId, remoteStream, event.receiver);
    };

    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      this.socket.emit(SOCKET_EVENTS.VOICE_ICE_CANDIDATE, {
        candidate: event.candidate,
        to: remoteId,
      });
    };

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        const sender = pc.addTrack(track, this.localStream);
        this.configureSender(sender);

        if (!this.localSenderMonitor) {
          this.localSenderMonitor = new AudioLevelMonitor({
            interval: SPEAKING_SAMPLE_INTERVAL,
            onChange: (speaking, level) => {
              this.callbacks.onLocalSpeaking(speaking, level);
            },
          });
          this.localSenderMonitor.start(makeSenderSampler(sender));
        }
      });
    }

    if (makeOffer) {
      this.createOffer(pc, remoteId);
    }

    return pc;
  }

  monitorPeerConnection(remoteId, pc) {
    const evaluateConnection = () => {
      const state = pc.connectionState;
      if (state === 'connected') {
        this.cancelPeerRestart(remoteId);
      } else if (state === 'failed' || state === 'disconnected') {
        this.schedulePeerRestart(remoteId);
      }
    };

    const evaluateIce = () => {
      const iceState = pc.iceConnectionState;
      if (iceState === 'connected' || iceState === 'completed') {
        this.cancelPeerRestart(remoteId);
      } else if (iceState === 'disconnected' || iceState === 'failed') {
        this.schedulePeerRestart(remoteId);
      }
    };

    pc.onconnectionstatechange = evaluateConnection;
    pc.oniceconnectionstatechange = evaluateIce;
    evaluateConnection();
    evaluateIce();
  }

  schedulePeerRestart(remoteId) {
    if (this.destroyed) return;
    if (this.peerRestartTimers.has(remoteId)) {
      return;
    }

    const timer = setTimeout(() => {
      this.peerRestartTimers.delete(remoteId);
      if (this.destroyed) {
        return;
      }

      const pc = this.peerConnections.get(remoteId);
      if (pc && typeof pc.restartIce === 'function' && pc.connectionState !== 'closed') {
        try {
          pc.restartIce();
          return;
        } catch (err) {
          console.warn('restartIce failed, rebuilding peer', err);
        }
      }
      this.restartPeer(remoteId);
    }, PEER_RESTART_DELAY);

    this.peerRestartTimers.set(remoteId, timer);
  }

  cancelPeerRestart(remoteId) {
    const timer = this.peerRestartTimers.get(remoteId);
    if (timer) {
      clearTimeout(timer);
      this.peerRestartTimers.delete(remoteId);
    }
  }

  restartPeer(remoteId) {
    if (this.destroyed) return;
    this.teardownPeer(remoteId);
    this.ensurePeerConnection(remoteId, { makeOffer: true });
  }

  configureSender(sender) {
    if (!sender) return;
    const params = sender.getParameters();
    if (!params.encodings) {
      params.encodings = [{}];
    }
    params.encodings.forEach((encoding) => {
      encoding.maxBitrate = this.resolveBitrate();
      encoding.priority = 'high';
    });
    params.degradationPreference = 'maintain-framerate';
    sender
      .setParameters(params)
      .catch((err) => console.warn('Failed to apply sender parameters', err));
  }

  resolveBitrate() {
    if (this.settings?.audioBitrate) {
      return Number(this.settings.audioBitrate);
    }
    return 192000;
  }

  async createOffer(pc, remoteId) {
    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
        voiceActivityDetection: false,
      });
      await pc.setLocalDescription(offer);

      this.socket.emit(SOCKET_EVENTS.VOICE_OFFER, {
        offer: pc.localDescription,
        to: remoteId,
      });
    } catch (err) {
      console.error('Failed to create voice offer', err);
      this.callbacks.onError(err);
    }
  }

  attachRemoteStream(remoteId, stream, receiver) {
    const player = this.remotePlayers.get(remoteId);
    if (player) {
      player.setStream(stream);
    } else {
      const newPlayer = new RemoteAudioPlayer({
        id: remoteId,
        stream,
        initialVolume: this.remoteOutputVolume ?? 1,
        sinkId: this.settings?.selectedSpeaker,
      });
      this.remotePlayers.set(remoteId, newPlayer);
    }

    this.reapplyVolume(remoteId);

    if (receiver) {
      const monitor = new AudioLevelMonitor({
        interval: SPEAKING_SAMPLE_INTERVAL,
        onChange: (speaking, level) => this.callbacks.onRemoteSpeaking(remoteId, speaking, level),
      });
      monitor.start(makeReceiverSampler(receiver));
      const prevMonitor = this.remoteMonitors.get(remoteId);
      prevMonitor?.stop();
      this.remoteMonitors.set(remoteId, monitor);
    }
  }

  teardownPeer(remoteId) {
    this.cancelPeerRestart(remoteId);

    const pc = this.peerConnections.get(remoteId);
    if (pc) {
      try {
        pc.close();
      } catch (err) {
        console.warn('Failed to close peer', err);
      }
      this.peerConnections.delete(remoteId);
    }

    const monitor = this.remoteMonitors.get(remoteId);
    if (monitor) {
      monitor.stop();
      this.remoteMonitors.delete(remoteId);
    }

    const player = this.remotePlayers.get(remoteId);
    if (player) {
      player.destroy();
      this.remotePlayers.delete(remoteId);
    }
    this.userVolumeOverrides.delete(remoteId);
  }

  scheduleNetworkMonitoring() {
    this.clearNetworkMonitoring();
    this.networkMonitorTimer = setInterval(() => {
      this.sampleNetworkStats();
    }, NETWORK_SAMPLE_INTERVAL);
  }

  clearNetworkMonitoring() {
    if (this.networkMonitorTimer) {
      clearInterval(this.networkMonitorTimer);
      this.networkMonitorTimer = null;
    }
  }

  startKeepAlive() {
    this.stopKeepAlive();
    if (!this.socket || !this.channel) return;
    this.keepAliveTimer = setInterval(() => {
      if (this.destroyed) {
        return;
      }
      this.socket.emit(SOCKET_EVENTS.VOICE_PING, {
        channelId: this.channel.id,
        timestamp: Date.now(),
      });
    }, KEEP_ALIVE_INTERVAL);
  }

  stopKeepAlive() {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  }

  clearPeerRestartTimers() {
    this.peerRestartTimers.forEach((timer) => clearTimeout(timer));
    this.peerRestartTimers.clear();
  }

  async sampleNetworkStats() {
    const peerEntries = Array.from(this.peerConnections.values());
    if (peerEntries.length === 0) {
      return;
    }

    try {
      const stats = await peerEntries[0].getStats();
      let packetsLost = 0;
      let packetsSent = 0;
      stats.forEach((report) => {
        if (report.type === 'outbound-rtp' && report.kind === 'audio') {
          packetsLost += report.packetsLost || 0;
          packetsSent += report.packetsSent || 0;
        }
      });
      const lossRate = packetsSent > 0 ? packetsLost / packetsSent : 0;
      let quality = 'excellent';
      if (lossRate > 0.07) {
        quality = 'poor';
      } else if (lossRate > 0.03) {
        quality = 'degraded';
      } else if (lossRate > 0.01) {
        quality = 'good';
      }
      if (quality !== this.lastNetworkQuality) {
        if (quality === 'degraded') {
          this.peerConnections.forEach((_, remoteId) => this.schedulePeerRestart(remoteId));
        }
        if (quality === 'poor') {
          this.peerConnections.forEach((_, remoteId) => this.restartPeer(remoteId));
        }
        this.lastNetworkQuality = quality;
      }
      this.callbacks.onNetworkQuality(quality, lossRate);
    } catch (err) {
      console.warn('Failed to sample network stats', err);
    }
  }

  async updateSettings(nextSettings = {}) {
    const prevSettings = this.settings || {};
    const merged = { ...prevSettings, ...nextSettings };
    const needsDeviceSwitch =
      merged.selectedMicrophone !== prevSettings.selectedMicrophone ||
      merged.echoCancellation !== prevSettings.echoCancellation ||
      merged.noiseSuppression !== prevSettings.noiseSuppression ||
      merged.autoGainControl !== prevSettings.autoGainControl;

    this.settings = merged;

    if (needsDeviceSwitch) {
      await this.resetLocalAudio();
      this.peerConnections.forEach((pc) => {
        pc.getSenders()
          .filter((sender) => sender.track?.kind === 'audio')
          .forEach((sender) => {
            sender.replaceTrack(this.localStream?.getAudioTracks()[0] || null);
            this.configureSender(sender);
          });
      });
    }

    if (this.processingGraph?.updateInputVolume && merged.inputVolume !== undefined && merged.inputVolume !== prevSettings.inputVolume) {
      this.processingGraph.updateInputVolume(merged.inputVolume);
    }

    if (merged.voiceMode && merged.voiceMode !== prevSettings.voiceMode) {
      const track = this.localStream?.getAudioTracks()[0];
      if (track) {
        if (merged.voiceMode === 'ptt') {
          this.pttActive = false;
          track.enabled = false;
        } else if (!this.isMuted) {
          track.enabled = true;
        }
      }
    }

    if (merged.selectedSpeaker && merged.selectedSpeaker !== prevSettings.selectedSpeaker) {
      this.remotePlayers.forEach((player) => player.setSinkId(merged.selectedSpeaker));
    }

    if (merged.outputVolume !== undefined && merged.outputVolume !== prevSettings.outputVolume) {
      this.remoteOutputVolume = this.normaliseOutputVolume(merged.outputVolume);
      this.remotePlayers.forEach((_, id) => this.reapplyVolume(id));
    }
  }

  async resetLocalAudio() {
    if (this.processingGraph) {
      await this.processingGraph.teardown();
      this.processingGraph = null;
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
    if (this.originalStream) {
      this.originalStream.getTracks().forEach((track) => track.stop());
      this.originalStream = null;
    }

    const prepared = await this.prepareLocalAudio();
    if (!prepared) {
      return;
    }
    const track = this.localStream?.getAudioTracks()[0];
    if (track) {
      const shouldEnable =
        !this.isMuted && (this.settings?.voiceMode === 'ptt' ? this.pttActive : true);
      track.enabled = shouldEnable;
    }
  }

  handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
      this.resumeIfNeeded();
    } else {
      this.suspendAudioContext();
    }
  }

  async resumeIfNeeded() {
    if (this.processingGraph?.context?.state === 'suspended') {
      try {
        await this.processingGraph.context.resume();
      } catch (err) {
        console.warn('Failed to resume audio context', err);
      }
    }

    let track = this.localStream?.getAudioTracks()[0];
    if (track && track.readyState === 'ended') {
      await this.resetLocalAudio();
      track = this.localStream?.getAudioTracks()[0] || null;
      this.peerConnections.forEach((pc) => {
        pc.getSenders()
          .filter((sender) => sender.track?.kind === 'audio')
          .forEach((sender) => sender.replaceTrack(track));
      });
    }

    this.peerConnections.forEach((pc) => {
      if (pc.connectionState === 'failed' || pc.iceConnectionState === 'failed') {
        pc.restartIce?.();
      }
    });
  }

  suspendAudioContext() {
    if (this.processingGraph?.context?.state === 'running') {
      this.processingGraph.context.suspend().catch((err) => {
        console.warn('Failed to suspend audio context', err);
      });
    }
  }

  async handleDeviceChange() {
    if (this.destroyed) return;
    const devices = await navigator.mediaDevices.enumerateDevices();
    const hasSelectedMic =
      devices.some((device) => device.deviceId === this.settings.selectedMicrophone);
    if (!hasSelectedMic && this.settings.selectedMicrophone && this.settings.selectedMicrophone !== 'default') {
      await this.updateSettings({ selectedMicrophone: 'default' });
    }
  }

  async handleLocalTrackEnded() {
    if (this.destroyed) return;
    await this.resetLocalAudio();
    this.peerConnections.forEach((pc) => {
      pc.getSenders()
        .filter((sender) => sender.track?.kind === 'audio')
        .forEach((sender) => sender.replaceTrack(this.localStream?.getAudioTracks()[0] || null));
    });
  }

  setMuted(isMuted) {
    const track = this.localStream?.getAudioTracks()[0];
    if (!track) return;
    this.isMuted = isMuted;
    const shouldEnable =
      !isMuted && (this.settings?.voiceMode === 'ptt' ? this.pttActive : true);
    track.enabled = shouldEnable;
    this.socket.emit(SOCKET_EVENTS.VOICE_MUTE_TOGGLE, {
      channelId: this.channel.id,
      isMuted,
    });
  }

  setPTTActive(active) {
    if (this.isMuted) return;
    if (this.settings?.voiceMode !== 'ptt') return;
    this.pttActive = Boolean(active);
    const track = this.localStream?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = active;
  }

  setDeafened(isDeafened) {
    this.isDeafened = isDeafened;
    if (isDeafened) {
      this.remotePlayers.forEach((player) => player.setVolume(0));
    } else {
      this.remotePlayers.forEach((_, id) => this.reapplyVolume(id));
    }
    this.socket.emit(SOCKET_EVENTS.VOICE_DEAFEN_TOGGLE, {
      channelId: this.channel.id,
      isDeafened,
    });
  }

  normaliseOutputVolume(volumePercent) {
    if (!Number.isFinite(volumePercent)) {
      return 1;
    }
    const clamped = Math.max(0, Math.min(200, volumePercent));
    if (clamped <= 100) {
      return clamped / 100;
    }
    return 1 + ((clamped - 100) / 100);
  }

  applyUserVolume(remoteId, volumePercent) {
    if (volumePercent === undefined || volumePercent === null) {
      this.userVolumeOverrides.delete(remoteId);
    } else {
      this.userVolumeOverrides.set(remoteId, volumePercent);
    }
    this.reapplyVolume(remoteId);
  }

  reapplyVolume(remoteId) {
    const player = this.remotePlayers.get(remoteId);
    if (!player) return;
    if (this.isDeafened) {
      player.setVolume(0);
      return;
    }
    const overridePercent = this.userVolumeOverrides.get(remoteId);
    const overrideMultiplier =
      overridePercent !== undefined ? this.normaliseOutputVolume(overridePercent) : 1;
    const finalVolume = Math.min(2, (this.remoteOutputVolume || 1) * overrideMultiplier);
    player.setVolume(finalVolume);
  }
}
