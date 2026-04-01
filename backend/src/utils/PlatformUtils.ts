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

export type ClientPlatform = 'web' | 'desktop' | 'android' | 'ios';

export function resolveClientPlatform(request: Request): ClientPlatform {
	const header = request.headers.get('x-floodilka-platform')?.trim().toLowerCase();
	if (header === 'desktop') return 'desktop';
	if (header === 'ios') return 'ios';
	if (header === 'android') return 'android';
	if (header === 'web') return 'web';

	const ua = request.headers.get('user-agent') ?? '';
	if (ua.includes('Electron/') || ua.includes('floodilka-desktop/')) return 'desktop';
	if (ua.includes('okhttp/')) return 'android';
	if (/^Floodilka\//.test(ua) && (ua.includes('CFNetwork') || ua.includes('Darwin'))) return 'ios';
	return 'web';
}
