/*
 * Copyright (C) 2026 Fluxer Contributors
 *
 * This file is part of Fluxer.
 *
 * Fluxer is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Fluxer is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Fluxer. If not, see <https://www.gnu.org/licenses/>.
 */

import type {LocalTrackPublication, Room} from 'livekit-client';
import {Track} from 'livekit-client';
import {Logger} from '~/lib/Logger';
import KeybindStore from '~/stores/KeybindStore';
import LocalVoiceStateStore from '~/stores/LocalVoiceStateStore';
import ParticipantVolumeStore from '~/stores/ParticipantVolumeStore';
import type {VoiceState} from './VoiceStateManager';

const logger = new Logger('VoiceAudioManager');

const extractUserId = (identity: string): string | null => {
	const match = identity.match(/^user_(\d+)(?:_(.+))?$/);
	return match ? match[1] : null;
};

export function applyLocalAudioPreferencesForUser(userId: string, room: Room | null): void {
	if (!room) {
		logger.warn('[applyLocalAudioPreferencesForUser] No room');
		return;
	}

	const selfDeaf = LocalVoiceStateStore.getSelfDeaf();

	room.remoteParticipants.forEach((p) => {
		if (extractUserId(p.identity) !== userId) return;
		ParticipantVolumeStore.applySettingsToParticipant(p, selfDeaf);
	});
}

export function applyAllLocalAudioPreferences(room: Room | null): void {
	if (!room) {
		logger.warn('[applyAllLocalAudioPreferences] No room');
		return;
	}

	const selfDeaf = LocalVoiceStateStore.getSelfDeaf();
	ParticipantVolumeStore.applySettingsToRoom(room, selfDeaf);
}

export function applyPushToTalkHold(
	held: boolean,
	room: Room | null,
	getCurrentUserVoiceState: () => VoiceState | null,
	syncVoiceState: (partial: {self_mute?: boolean}) => void,
): void {
	logger.info('[PTT:applyHold] START', {
		held,
		hasRoom: !!room,
		isPttEnabled: KeybindStore.isPushToTalkEnabled(),
		isPttEffective: KeybindStore.isPushToTalkEffective(),
		hasUserSetMute: LocalVoiceStateStore.getHasUserSetMute(),
		selfMute: LocalVoiceStateStore.getSelfMute(),
		selfDeaf: LocalVoiceStateStore.getSelfDeaf(),
		pttHeld: KeybindStore.pushToTalkHeld,
		pttLatched: KeybindStore.isPushToTalkLatched(),
	});

	KeybindStore.setPushToTalkHeld(held);

	if (!KeybindStore.isPushToTalkEnabled()) {
		logger.info('[PTT:applyHold] SKIP: PTT not enabled');
		return;
	}

	const serverVoiceState = getCurrentUserVoiceState();
	if (serverVoiceState?.mute) {
		logger.info('[PTT:applyHold] SKIP: guild muted', {serverMute: serverVoiceState.mute});
		return;
	}

	const hasUserSetMute = LocalVoiceStateStore.getHasUserSetMute();
	const selfMute = LocalVoiceStateStore.getSelfMute();
	const userMuted = hasUserSetMute && selfMute;
	const shouldMute = userMuted || !held;

	logger.info('[PTT:applyHold] DECISION', {hasUserSetMute, selfMute, userMuted, held, shouldMute});

	applyLocalMuteState(shouldMute, room, syncVoiceState);
}

export function handlePushToTalkModeChange(
	room: Room | null,
	getCurrentUserVoiceState: () => VoiceState | null,
	syncVoiceState: (partial: {self_mute?: boolean}) => void,
): void {
	logger.info('[PTT:modeChange] START', {
		hasRoom: !!room,
		transmitMode: KeybindStore.transmitMode,
		isPttEnabled: KeybindStore.isPushToTalkEnabled(),
		isPttEffective: KeybindStore.isPushToTalkEffective(),
		hasPttKeybind: KeybindStore.hasPushToTalkKeybind(),
		hasUserSetMute: LocalVoiceStateStore.getHasUserSetMute(),
		selfMute: LocalVoiceStateStore.getSelfMute(),
		selfDeaf: LocalVoiceStateStore.getSelfDeaf(),
	});

	const serverVoiceState = getCurrentUserVoiceState();
	if (serverVoiceState?.mute) {
		logger.info('[PTT:modeChange] SKIP: guild muted');
		return;
	}

	if (KeybindStore.isPushToTalkEffective()) {
		logger.info('[PTT:modeChange] PTT effective → resetting state and applying initial mute');
		KeybindStore.setPushToTalkHeld(false);
		KeybindStore.resetPushToTalkState();
		LocalVoiceStateStore.clearHasUserSetMute();
		applyLocalMuteState(true, room, syncVoiceState);
	} else if (!LocalVoiceStateStore.getHasUserSetMute()) {
		logger.info('[PTT:modeChange] PTT not effective, user has not set mute → unmuting');
		applyLocalMuteState(false, room, syncVoiceState);
	} else {
		logger.info('[PTT:modeChange] PTT not effective, user has set mute → keeping current state');
	}
}

export function getMuteReason(voiceState: VoiceState | null): 'guild' | 'push_to_talk' | 'self' | null {
	const isGuildMuted = voiceState?.mute ?? false;
	if (isGuildMuted) return 'guild';

	const selfMuted = voiceState?.self_mute ?? LocalVoiceStateStore.getSelfMute();
	if (KeybindStore.isPushToTalkEffective() && KeybindStore.isPushToTalkMuted(selfMuted)) return 'push_to_talk';
	if (selfMuted) return 'self';
	return null;
}

export function applyLocalMuteState(
	muted: boolean,
	room: Room | null,
	syncVoiceState: (partial: {self_mute?: boolean}) => void,
): void {
	const selfDeaf = LocalVoiceStateStore.getSelfDeaf();
	const targetMute = selfDeaf ? true : muted;
	const currentMute = LocalVoiceStateStore.getSelfMute();

	logger.info('[PTT:applyMuteState] START', {
		requestedMute: muted,
		selfDeaf,
		targetMute,
		currentMute,
		hasRoom: !!room,
		hasLocalParticipant: !!room?.localParticipant,
		audioTrackCount: room?.localParticipant?.audioTrackPublications.size ?? 0,
	});

	if (currentMute === targetMute) {
		logger.info('[PTT:applyMuteState] SKIP: no change needed (current === target)', {targetMute});
		return;
	}

	if (room?.localParticipant) {
		const hasAudioTracks = room.localParticipant.audioTrackPublications.size > 0;

		if (!targetMute && !hasAudioTracks) {
			logger.warn('[PTT:applyMuteState] SKIP unmute: no audio tracks exist. Enable microphone first.');
			syncVoiceState({self_mute: true});
			return;
		}

		logger.info('[PTT:applyMuteState] Applying to LiveKit publications', {
			targetMute,
			publicationCount: room.localParticipant.audioTrackPublications.size,
		});

		room.localParticipant.audioTrackPublications.forEach((publication: LocalTrackPublication) => {
			if (publication.source === Track.Source.ScreenShareAudio) return;
			logger.info('[PTT:applyMuteState] Muting/unmuting publication', {
				trackSid: publication.trackSid,
				source: publication.source,
				targetMute,
				currentlyMuted: publication.isMuted,
			});
			const operation = targetMute ? publication.mute() : publication.unmute();
			operation.catch((error) =>
				logger.error(targetMute ? 'Failed to mute publication' : 'Failed to unmute publication', {error}),
			);
		});
	} else {
		logger.info('[PTT:applyMuteState] No room/participant, only updating local state');
	}

	LocalVoiceStateStore.updateSelfMute(targetMute);
	syncVoiceState({self_mute: targetMute});
	logger.info('[PTT:applyMuteState] DONE', {targetMute});
}
