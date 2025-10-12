# Voice Engine Overview

This directory contains the new voice stack that powers real‑time audio in the Floodilka client. The goal of the rewrite is to deliver Discord‑class stability with predictable behaviour across browsers and when the tab loses focus.

## Modules

- `VoiceEngine.js` – orchestrates audio capture, peer connections, resiliency, and lifecycle. It owns:
  - Capture negotiation with tiered constraint fallbacks (`audioConstraints.js`)
  - Web Audio post‑processing and gain control (`audioProcessing.js`)
  - RTCPeerConnection management, ICE restarts, and jitter tolerance
  - VAD via RTP stats (`audioLevelMonitor.js`) with hysteresis
  - Visibility + device change handlers to resume streams when the browser throttles the tab
  - Unified volume pipeline with per‑account overrides and global mute/deafen

- `audioConstraints.js` – builds modern constraint objects (with Chrome advanced hints) and retries with downgraded profiles to guarantee microphone access.

- `audioProcessing.js` – lightweight Web Audio graph (high/low pass filters, compressor, limiter) plus analyser hooks for local talking detection, all wrapped for safe teardown.

- `audioLevelMonitor.js` – polling helper that reads RTP stats/synchronisation sources so speech detection keeps working while the page is hidden.

- `remoteAudio.js` – encapsulates dynamic `HTMLAudioElement` creation for remote peers, with `setSinkId` support and deterministic cleanup.

## React integration

`hooks/useVoiceEngine.js` wraps `VoiceEngine` into a React‑friendly API (participants, speaking state, network quality, control methods). The `VoiceChannel` component now becomes a thin orchestrator that:

- Reacts to user settings/UI events, and persists them.
- Bridges global mute/deafen/PTT state to the engine.
- Applies per‑user volumes to all of a member's sockets.
- Keeps ScreenShare wired without re‑render churn.

This layout splits the delicate WebRTC logic from UI code while making recovery paths (visibility changes, device switches, reconnects) automatic.

## Runtime safeguards

- Foreground/background resilience: visibility changes suspend/resume the Web Audio graph and trigger track re-acquisition when browsers kill capture in hidden tabs.
- Connection keep-alive: the engine pings the backend over `voice:ping` every 15 s so long-lived background tabs stay authorised and socket.io does not garbage-collect rooms.
- Adaptive restart logic: packet-loss sampling downgrades quality tiers and schedules targeted ICE restarts or full peer rebuilds when a link stalls.
- Push-to-talk aware muting: the engine tracks real PTT state so reconnects, device swaps, or mute toggles never leave the microphone permanently enabled.

## Server-side mixing roadmap

The current iteration still relies on peer-to-peer forwarding but the backend now maintains a consolidated channel snapshot and a keep-alive contract, paving the way for a selective forwarding/mixing layer. Next milestones:

1. Land an SFU worker (e.g. mediasoup) behind the existing socket signalling so clients can publish once and subscribe to a mixed stream per channel.
2. Introduce a mixer pipeline (Opus decode → PCM mix → Opus encode) with loudness normalisation and tone-mapped recording/export.
3. Extend `VoiceEngine` with a transport abstraction so clients can switch between direct peers and the SFU without UI churn.

Until then, all latency/bandwidth-critical logic remains client-side, but the scaffolding for server-managed audio is in place.
