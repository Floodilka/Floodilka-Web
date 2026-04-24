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

import {Logger} from '~/lib/Logger';

const logger = new Logger('VoiceAudioContextManager');

type AudioContextCtor = typeof AudioContext;

function resolveAudioContextCtor(): AudioContextCtor | null {
	if (typeof window === 'undefined') return null;
	const w = window as typeof window & {webkitAudioContext?: AudioContextCtor};
	return w.AudioContext ?? w.webkitAudioContext ?? null;
}

export class VoiceAudioContextManager {
	private ctx: AudioContext | null = null;
	private creationAttempted = false;
	private gestureListenerAttached = false;

	get(): AudioContext | null {
		if (this.ctx) return this.ctx;
		if (this.creationAttempted) return null;
		this.creationAttempted = true;

		const Ctor = resolveAudioContextCtor();
		if (!Ctor) {
			logger.warn('AudioContext not supported — volume boost disabled');
			return null;
		}
		try {
			this.ctx = new Ctor({latencyHint: 'interactive'});
		} catch (error) {
			logger.warn('Failed to create AudioContext — volume boost disabled', {error});
			return null;
		}
		this.attachGestureResumeListener();
		return this.ctx;
	}

	isAvailable(): boolean {
		return this.get() !== null;
	}

	async resumeIfNeeded(): Promise<void> {
		const ctx = this.ctx;
		if (!ctx) return;
		if (ctx.state === 'running' || ctx.state === 'closed') return;
		try {
			await ctx.resume();
		} catch (error) {
			logger.debug('AudioContext resume deferred until user gesture', {error});
		}
	}

	private attachGestureResumeListener(): void {
		if (this.gestureListenerAttached) return;
		if (typeof document === 'undefined') return;
		this.gestureListenerAttached = true;
		const handler = (): void => {
			void this.resumeIfNeeded();
		};
		document.addEventListener('pointerdown', handler, {capture: true, passive: true});
		document.addEventListener('keydown', handler, {capture: true, passive: true});
	}
}

export default new VoiceAudioContextManager();
