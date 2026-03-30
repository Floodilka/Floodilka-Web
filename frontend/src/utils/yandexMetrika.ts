/*
 * Copyright (C) 2026 Floodilka Contributors
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

import {Logger} from '~/lib/Logger';

const logger = new Logger('YandexMetrika');

const TAG_SCRIPT_URL = 'https://mc.yandex.ru/metrika/tag.js';

type YmMethod = 'init' | 'hit' | 'reachGoal' | 'setUserID' | 'userParams';

declare global {
	interface Window {
		ym?: (counterId: number, method: YmMethod, ...args: unknown[]) => void;
	}
}

let counterId: number | null = null;
let scriptLoadPromise: Promise<void> | null = null;

function loadTagScript(): Promise<void> {
	if (scriptLoadPromise) return scriptLoadPromise;

	scriptLoadPromise = new Promise<void>((resolve, reject) => {
		if (window.ym) {
			resolve();
			return;
		}

		const script = document.createElement('script');
		script.src = TAG_SCRIPT_URL;
		script.async = true;
		script.onload = () => {
			logger.info('Yandex Metrika tag.js loaded');
			resolve();
		};
		script.onerror = () => {
			scriptLoadPromise = null;
			reject(new Error('Failed to load Yandex Metrika tag.js'));
		};
		document.head.appendChild(script);
	});

	return scriptLoadPromise;
}

export async function initYandexMetrika(id: string): Promise<void> {
	const parsed = Number(id);
	if (!parsed || !Number.isFinite(parsed)) {
		logger.warn('Invalid Yandex Metrika counter ID:', id);
		return;
	}

	counterId = parsed;

	try {
		await loadTagScript();
	} catch (error) {
		logger.warn('Failed to initialize Yandex Metrika', error);
		return;
	}

	if (!window.ym) {
		logger.warn('window.ym not available after script load');
		return;
	}

	window.ym(counterId, 'init', {
		defer: true,
		clickmap: true,
		trackLinks: true,
		accurateTrackBounce: true,
		webvisor: true,
	});

	logger.info('Yandex Metrika initialized, counter:', counterId);
}

export function trackPageView(url: string, title?: string): void {
	if (!counterId || !window.ym) return;
	window.ym(counterId, 'hit', url, {title});
}

export function reachGoal(target: string, params?: Record<string, unknown>): void {
	if (!counterId || !window.ym) return;
	window.ym(counterId, 'reachGoal', target, params);
}
