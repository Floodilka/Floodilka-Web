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

const logger = new Logger('YandexMetrika');

const TAG_SCRIPT_URL = 'https://mc.yandex.ru/metrika/tag.js';

type YmMethod =
	| 'init'
	| 'hit'
	| 'reachGoal'
	| 'setUserID'
	| 'userParams'
	| 'params'
	| 'extLink'
	| 'file'
	| 'notBounce'
	| 'getClientID';

type YmFn = (counterId: number, method: YmMethod, ...args: unknown[]) => void;
type YmStub = YmFn & {a?: unknown[][]; l?: number};

declare global {
	interface Window {
		ym?: YmStub;
	}
}

let counterId: number | null = null;
let bootstrapped = false;

function bootstrap(): void {
	if (bootstrapped) return;
	bootstrapped = true;

	if (!window.ym) {
		const stub: YmStub = function (...args: unknown[]) {
			(stub.a = stub.a || []).push(args);
		} as YmStub;
		stub.l = Date.now();
		window.ym = stub;
	}

	if (document.querySelector(`script[src="${TAG_SCRIPT_URL}"]`)) return;

	const script = document.createElement('script');
	script.src = TAG_SCRIPT_URL;
	script.async = true;
	script.onerror = () => {
		logger.warn('Failed to load Yandex Metrika tag.js');
	};

	const firstScript = document.getElementsByTagName('script')[0];
	if (firstScript?.parentNode) {
		firstScript.parentNode.insertBefore(script, firstScript);
	} else {
		document.head.appendChild(script);
	}
}

export function initYandexMetrika(id: string): void {
	const parsed = Number(id);
	if (!parsed || !Number.isFinite(parsed)) {
		logger.warn('Invalid Yandex Metrika counter ID:', id);
		return;
	}

	counterId = parsed;
	bootstrap();

	window.ym!(parsed, 'init', {
		defer: true,
		clickmap: true,
		trackLinks: true,
		accurateTrackBounce: true,
		webvisor: true,
	});

	logger.info('Yandex Metrika queued, counter:', parsed);
}

export function trackPageView(url: string, title?: string): void {
	if (counterId == null || !window.ym) return;
	window.ym(counterId, 'hit', url, {title});
}

export function reachGoal(target: string, params?: Record<string, unknown>): void {
	if (counterId == null || !window.ym) return;
	window.ym(counterId, 'reachGoal', target, params);
}
