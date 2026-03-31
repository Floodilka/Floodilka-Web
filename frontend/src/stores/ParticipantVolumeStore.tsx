/*
 * Copyright (C) 2026 Floodilka Contributors
 *
 * This file is part of Floodilka.
 *
 * Floodilka is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Floodilka is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Floodilka. If not, see <https://www.gnu.org/licenses/>.
 */

import type {RemoteAudioTrack, RemoteParticipant, Room} from 'livekit-client';
import {Track} from 'livekit-client';
import {makeAutoObservable} from 'mobx';
import {Logger} from '~/lib/Logger';
import {makePersistent} from '~/lib/MobXPersistence';
import VoiceSettingsStore from '~/stores/VoiceSettingsStore';
import {composeVolumePercent, voiceVolumePercentToTrackVolume} from '~/utils/VoiceVolumeUtils';

const logger = new Logger('ParticipantVolumeStore');

const isRemoteAudioTrack = (track: Track | null | undefined): track is RemoteAudioTrack =>
	track?.kind === Track.Kind.Audio;

const idUser = (identity: string): string | null => {
	const m = identity.match(/^user_(\d+)(?:_(.+))?$/);
	return m ? m[1] : null;
};

class ParticipantVolumeStore {
	volumes: Record<string, number> = {};
	localMutes: Record<string, boolean> = {};

	constructor() {
		makeAutoObservable(this, {}, {autoBind: true});
		void this.initPersistence();
	}

	private async initPersistence(): Promise<void> {
		await makePersistent(this, 'ParticipantVolumeStore', ['volumes', 'localMutes']);
	}

	setVolume(userId: string, volume: number): void {
		const clamped = Math.max(0, Math.min(200, volume));
		this.volumes = {
			...this.volumes,
			[userId]: clamped,
		};
		logger.debug(`Set volume for ${userId}: ${clamped}`);
	}

	setLocalMute(userId: string, muted: boolean): void {
		this.localMutes = {
			...this.localMutes,
			[userId]: muted,
		};
		logger.debug(`Set local mute for ${userId}: ${muted}`);
	}

	getVolume(userId: string): number {
		return this.volumes[userId] ?? 100;
	}

	isLocalMuted(userId: string): boolean {
		return this.localMutes[userId] ?? false;
	}

	resetUserSettings(userId: string): void {
		const newVolumes = {...this.volumes};
		const newLocalMutes = {...this.localMutes};
		delete newVolumes[userId];
		delete newLocalMutes[userId];
		this.volumes = newVolumes;
		this.localMutes = newLocalMutes;
		logger.debug(`Reset settings for ${userId}`);
	}

	applySettingsToRoom(room: Room | null, selfDeaf: boolean): void {
		if (!room) return;

		room.remoteParticipants.forEach((participant) => {
			this.applySettingsToParticipant(participant, selfDeaf);
		});
	}

	applySettingsToParticipant(participant: RemoteParticipant, selfDeaf: boolean): void {
		const userId = idUser(participant.identity);
		if (!userId) return;

		const userVolume = this.getVolume(userId);
		const outputVolume = VoiceSettingsStore.getOutputVolume();
		const locallyMuted = this.isLocalMuted(userId);

		participant.audioTrackPublications.forEach((pub) => {
			try {
				const track = pub.track;
				if (isRemoteAudioTrack(track)) {
					const effectiveVolume = voiceVolumePercentToTrackVolume(composeVolumePercent(userVolume, outputVolume));
					track.setVolume(effectiveVolume);
				}

				const shouldDisable = locallyMuted || selfDeaf;
				pub.setSubscribed(!selfDeaf);
				pub.setEnabled(!shouldDisable);
			} catch (error) {
				logger.warn(`Failed to apply settings to participant ${userId}`, {error});
			}
		});
	}
}

export default new ParticipantVolumeStore();
