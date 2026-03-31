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

/** @type {import('electron-builder').Configuration} */
const config = (() => {
	const channel = process.env.BUILD_CHANNEL === 'canary' ? 'canary' : 'stable';
	const isCanary = channel === 'canary';

	const appId = isCanary ? 'com.floodilka.desktop.canary' : 'com.floodilka.desktop';
	const productName = isCanary ? 'Floodilka Canary' : 'Floodilka';
	const displayName = isCanary ? 'Флудилка Canary' : 'Флудилка';
	const iconsDir = isCanary ? 'electron-build-resources/icons-canary' : 'electron-build-resources/icons-stable';

	const macEntitlements = isCanary
		? 'electron-build-resources/entitlements.mac.canary.plist'
		: 'electron-build-resources/entitlements.mac.stable.plist';

	const macProfile = isCanary
		? 'electron-build-resources/profiles/Floodilka_Canary.provisionprofile'
		: 'electron-build-resources/profiles/Floodilka.provisionprofile';

	const winIconUrl = isCanary
		? 'https://static.floodilka.com/web/icons/desktop/canary/icon.ico'
		: 'https://static.floodilka.com/web/icons/desktop/stable/icon.ico';

	const linuxExecutableName = isCanary ? 'floodilkacanary' : 'floodilka';
	const linuxSynopsis = productName;
	const linuxDescription = productName;

	return {
		appId,
		productName,
		copyright: 'Copyright (C) 2026 Floodilka',

		artifactName: `floodilka-${channel}-\${version}-\${arch}.\${ext}`,

		directories: {
			output: 'dist-electron',
			buildResources: 'electron-build-resources',
		},

		files: [
			'src-electron/dist/**/*',
			'!**/*.map',
			'!**/*.md',
			'!**/README*',
			'!**/readme*',
			'!**/CHANGELOG*',
			'!**/LICENSE*',
			'!**/.github/**',
			'!**/docs/**',
			'!**/doc/**',
			'!**/example/**',
			'!**/examples/**',
			'!**/test/**',
			'!**/tests/**',
			'!**/__tests__/**',
			'!**/*.ts',
			'!**/tsconfig*.json',
		],

		extraMetadata: {
			main: 'src-electron/dist/main/index.js',
			type: 'module',
		},

		asar: true,
		compression: 'normal',

		asarUnpack: [
			'**/*.node',
			'**/node_modules/uiohook-napi/**',
			'**/node_modules/input-monitoring-check/**',
			'**/src-electron/dist/preload/**',
		],

		extraResources: [
			{from: `${iconsDir}/512x512.png`, to: '512x512.png'},
			{from: `${iconsDir}/badges`, to: 'badges'},
			{from: `${iconsDir}/_compiled/Assets.car`, to: 'Assets.car'},
			{from: 'src-electron/assets/splash.html', to: 'splash.html'},
			{from: 'public/icons/logo_nobg.png', to: 'logo_nobg.png'},
		],

		mac: {
			category: 'public.app-category.social-networking',
			icon: `${iconsDir}/_compiled/AppIcon.icns`,
			identity: 'Eldar Tengizov (4K3W3NBQTP)',
			hardenedRuntime: true,
			gatekeeperAssess: false,
			entitlements: macEntitlements,
			entitlementsInherit: 'electron-build-resources/entitlements.mac.inherit.plist',
			provisioningProfile: macProfile,
			extendInfo: {
				CFBundleIconName: 'AppIcon',
				CFBundleDisplayName: displayName,
				NSMicrophoneUsageDescription: 'Флудилка needs access to your microphone for voice chat.',
				NSCameraUsageDescription: 'Флудилка needs access to your camera for video chat.',
				NSInputMonitoringUsageDescription: 'Флудилка needs Input Monitoring access for global shortcuts and hotkeys.',
			},
			notarize: true,
			target: [
				{target: 'dmg', arch: ['x64', 'arm64']},
				{target: 'zip', arch: ['x64', 'arm64']},
			],
		},

		dmg: {
			sign: false,
			icon: `${iconsDir}/_compiled/AppIcon.icns`,
			format: 'UDZO',
			contents: [
				{x: 130, y: 220},
				{x: 410, y: 220, type: 'link', path: '/Applications'},
			],
		},

		win: {
			icon: `${iconsDir}/icon.ico`,
			target: [{target: 'squirrel', arch: ['x64']}],
		},

		squirrelWindows: {
			iconUrl: winIconUrl,
		},

		linux: {
			icon: iconsDir,
			category: 'Network',
			maintainer: 'Floodilka Team',
			synopsis: linuxSynopsis,
			description: linuxDescription,
			executableName: linuxExecutableName,
			target: ['dir', 'AppImage', 'deb', 'rpm', 'tar.gz'],
			mimeTypes: ['x-scheme-handler/floodilka'],
		},

		protocols: [{name: 'Floodilka', schemes: ['floodilka']}],
	};
})();

module.exports = config;
