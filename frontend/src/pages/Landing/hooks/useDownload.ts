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
			window.open(downloadInfo.link, '_blank');
		}
	}, [downloadInfo]);

	return {downloadInfo, handleDownload};
};
