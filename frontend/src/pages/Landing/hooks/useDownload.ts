/*
 * Copyright (C) 2020-2026 Fluxer Contributors
 * Copyright (C) 2026 Floodilka Contributors
 *
 * This file is part of Floodilka, a fork of Fluxer
 * (https://github.com/fluxerapp/fluxer).
 * Modified by Floodilka Contributors starting March 2026.
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

import {useCallback, useMemo} from 'react';

interface DownloadInfo {
	platform: string;
	label: string;
	arch: string | null;
	icon: string;
	iconAlt: string;
	link: string;
}

export const useDownload = () => {
	const downloadInfo = useMemo<DownloadInfo>(() => {
		const ua = navigator.userAgent;
		const platform = navigator.platform || '';

		if (platform.includes('Mac') || ua.includes('Macintosh')) {
			const isAppleSilicon =
				((navigator as any).userAgentData?.platform === 'macOS' &&
					(navigator as any).userAgentData?.architecture === 'arm') ||
				(() => {
					try {
						const canvas = document.createElement('canvas');
						const gl = canvas.getContext('webgl');
						const debugInfo = gl?.getExtension('WEBGL_debug_renderer_info');
						const renderer = gl?.getParameter(debugInfo?.UNMASKED_RENDERER_WEBGL ?? 0) || '';
						return renderer.includes('Apple M') || renderer.includes('Apple GPU');
					} catch {
						return false;
					}
				})();

			return {
				platform: 'macos',
				label: 'Скачать для Mac',
				arch: isAppleSilicon ? 'arm64' : 'x64',
				icon: '/icons/mac_icon.png',
				iconAlt: 'macOS',
				link: isAppleSilicon
					? '/desktop/updates/latest-arm64-mac.dmg'
					: '/desktop/updates/latest-mac.dmg',
			};
		}

		if (platform.includes('Win') || ua.includes('Windows') || ua.includes('Win64') || ua.includes('Win32')) {
			return {
				platform: 'windows',
				label: 'Скачать для Windows',
				arch: 'x64',
				icon: '/icons/windows_icon.svg',
				iconAlt: 'Windows',
				link: '/desktop/updates/Floodilka.exe',
			};
		}

		if (/iPhone|iPad|iPod/.test(ua)) {
			return {
				platform: 'ios',
				label: 'Скачать из App Store',
				arch: null,
				icon: '/icons/mac_icon.png',
				iconAlt: 'App Store',
				link: 'https://apps.apple.com/app/id6755156241',
			};
		}

		if (/Android/.test(ua)) {
			return {
				platform: 'android',
				label: 'Скачать из Google Play',
				arch: null,
				icon: '/icons/google_play_icon.png',
				iconAlt: 'Google Play',
				link: 'https://play.google.com/store/apps/details?id=com.floodilka.android',
			};
		}

		const isMobile = /Mobile|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);

		if (isMobile) {
			return {
				platform: 'ios',
				label: 'Скачать из App Store',
				arch: null,
				icon: '/icons/mac_icon.png',
				iconAlt: 'App Store',
				link: 'https://apps.apple.com/app/id6755156241',
			};
		}

		return {
			platform: 'desktop',
			label: 'Скачать для Windows',
			arch: 'x64',
			icon: '/icons/windows_icon.svg',
			iconAlt: 'Windows',
			link: '/desktop/updates/Floodilka.exe',
		};
	}, []);

	const handleDownload = useCallback(() => {
		if (downloadInfo.link) {
			const a = document.createElement('a');
			a.href = downloadInfo.link;
			if (!downloadInfo.link.startsWith('http')) {
				a.download = '';
			}
			document.body.appendChild(a);
			a.click();
			a.remove();
		}
	}, [downloadInfo]);

	return {downloadInfo, handleDownload};
};
