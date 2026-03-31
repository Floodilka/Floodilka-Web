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

import {app, autoUpdater, type BrowserWindow, ipcMain} from 'electron';
import log from 'electron-log';
import {BUILD_CHANNEL, IS_CANARY} from '../common/build-channel.js';
import {CANARY_APP_URL, STABLE_APP_URL} from '../common/constants.js';
import {setSplashProgress, setSplashProgressIndeterminate, setSplashStatus} from './splash.js';
import {setQuitting} from './window.js';

export type UpdaterContext = 'user' | 'background' | 'focus';

export type UpdaterEvent =
	| {type: 'checking'; context: UpdaterContext}
	| {type: 'available'; context: UpdaterContext; version?: string | null}
	| {type: 'not-available'; context: UpdaterContext}
	| {type: 'downloaded'; context: UpdaterContext; version?: string | null}
	| {type: 'error'; context: UpdaterContext; message: string};

let lastContext: UpdaterContext = 'background';
let isChecking = false;

function send(win: BrowserWindow | null, event: UpdaterEvent) {
	win?.webContents.send('updater-event', event);
}

interface ReleaseInfo {
	url: string;
	name: string;
	notes?: string;
	pub_date?: string;
}

function getReleasesUrl(): string {
	const appUrl = IS_CANARY ? CANARY_APP_URL : STABLE_APP_URL;
	return `${appUrl}/desktop/updates/${BUILD_CHANNEL}/${process.platform}/${process.arch}/RELEASES.json`;
}

function getFeedConfig(currentVersion: string): Parameters<typeof autoUpdater.setFeedURL>[0] {
	const appUrl = IS_CANARY ? CANARY_APP_URL : STABLE_APP_URL;
	const headers = {'User-Agent': `floodilka-desktop/${currentVersion} (${process.platform}: ${process.arch})`};

	if (process.platform === 'win32') {
		// Squirrel.Windows: point to directory, it appends /RELEASES automatically
		return {url: `${appUrl}/desktop/updates/${BUILD_CHANNEL}/win32/${process.arch}`, headers};
	}

	// macOS (Squirrel.Mac): use JSON feed pointing to ZIP
	return {url: getReleasesUrl(), headers, serverType: 'json'};
}

function isNewerVersion(remote: string, local: string): boolean {
	const r = remote.split('.').map(Number);
	const l = local.split('.').map(Number);
	for (let i = 0; i < Math.max(r.length, l.length); i++) {
		const rv = r[i] ?? 0;
		const lv = l[i] ?? 0;
		if (rv > lv) return true;
		if (rv < lv) return false;
	}
	return false;
}

async function checkForUpdate(getMainWindow: () => BrowserWindow | null): Promise<void> {
	if (isChecking) return;
	isChecking = true;

	const currentVersion = app.getVersion();
	const releasesUrl = getReleasesUrl();

	log.info(`[updater] Checking ${releasesUrl} (current: ${currentVersion})`);
	send(getMainWindow(), {type: 'checking', context: lastContext});

	try {
		const response = await fetch(releasesUrl);
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`);
		}

		const release: ReleaseInfo = await response.json();
		log.info(`[updater] Remote version: ${release.name}`);

		if (!isNewerVersion(release.name, currentVersion)) {
			log.info('[updater] No update available');
			send(getMainWindow(), {type: 'not-available', context: lastContext});
			isChecking = false;
			return;
		}

		log.info(`[updater] Update available: ${release.name}`);
		send(getMainWindow(), {type: 'available', context: lastContext, version: release.name});

		autoUpdater.setFeedURL(getFeedConfig(currentVersion));
		autoUpdater.checkForUpdates();
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : String(err);
		log.error(`[updater] Error: ${message}`);
		send(getMainWindow(), {type: 'error', context: lastContext, message});
		isChecking = false;
	}
}

/**
 * Startup update check with splash screen integration.
 * Returns a promise that resolves when the app should proceed to the main window.
 * If an update is found, it downloads and installs (app restarts, promise never resolves).
 */
export function checkForUpdateOnStartup(): Promise<void> {
	if (!app.isPackaged) {
		log.info('[updater] Skipping startup update check in dev mode');
		setSplashStatus('Режим разработки...');
		return new Promise((resolve) => setTimeout(resolve, 800));
	}

	return new Promise((resolve) => {
		const currentVersion = app.getVersion();
		const releasesUrl = getReleasesUrl();

		setSplashStatus('Проверка обновлений...');
		setSplashProgressIndeterminate();
		log.info(`[updater] Startup check: ${releasesUrl} (current: ${currentVersion})`);

		let resolved = false;
		let timeoutId: ReturnType<typeof setTimeout> | null = null;

		const removeStartupListeners = () => {
			autoUpdater.removeListener('update-downloaded', onDownloaded);
			autoUpdater.removeListener('error', onError);
		};

		const cleanup = () => {
			if (timeoutId) clearTimeout(timeoutId);
			removeStartupListeners();
		};

		const proceed = () => {
			if (resolved) return;
			resolved = true;
			cleanup();
			setSplashStatus('Запуск приложения...');
			setTimeout(resolve, 400);
		};

		const onDownloaded = (_event: unknown, _releaseNotes: string, releaseName: string) => {
			cleanup();
			log.info(`[updater] Downloaded on startup: ${releaseName}`);
			setSplashStatus('Установка обновления...');
			setSplashProgress(100);
			setTimeout(() => {
				setQuitting(true);
				autoUpdater.quitAndInstall();
			}, 1500);
		};

		const onError = (err: Error) => {
			log.error(`[updater] Startup update error: ${err.message}`);
			proceed();
		};

		autoUpdater.on('update-downloaded', onDownloaded);
		autoUpdater.on('error', onError);

		// Timeout — proceed if version check hangs (not the download)
		timeoutId = setTimeout(() => {
			log.warn('[updater] Startup version check timed out');
			proceed();
		}, 15000);

		void (async () => {
			try {
				const response = await fetch(releasesUrl);
				if (!response.ok) {
					throw new Error(`HTTP ${response.status}`);
				}

				const release: ReleaseInfo = await response.json();
				log.info(`[updater] Startup remote version: ${release.name}`);

				if (!isNewerVersion(release.name, currentVersion)) {
					log.info('[updater] No update available on startup');
					cleanup();
					proceed();
					return;
				}

				// Update found — cancel timeout, let it download without time limit
				if (timeoutId) {
					clearTimeout(timeoutId);
					timeoutId = null;
				}

				log.info(`[updater] Update available on startup: ${release.name}`);
				setSplashStatus(`Загрузка обновления ${release.name}...`);
				setSplashProgressIndeterminate();

				autoUpdater.setFeedURL(getFeedConfig(currentVersion));
				autoUpdater.checkForUpdates();
			} catch (err: unknown) {
				const message = err instanceof Error ? err.message : String(err);
				log.error(`[updater] Startup check failed: ${message}`);
				cleanup();
				proceed();
			}
		})();
	});
}

export function registerUpdater(getMainWindow: () => BrowserWindow | null) {
	if (!app.isPackaged) {
		log.info('[updater] Skipping updates in dev mode');
		return;
	}

	autoUpdater.on('update-downloaded', (_event, _releaseNotes, releaseName) => {
		log.info(`[updater] Downloaded: ${releaseName}`);
		send(getMainWindow(), {type: 'downloaded', context: lastContext, version: releaseName ?? null});
		isChecking = false;
	});

	autoUpdater.on('error', (err: Error) => {
		log.error(`[updater] Squirrel error: ${err.message}`);
		send(getMainWindow(), {type: 'error', context: lastContext, message: err?.message ?? String(err)});
		isChecking = false;
	});

	// Background checks every 5 minutes
	setInterval(() => {
		lastContext = 'background';
		void checkForUpdate(getMainWindow);
	}, 5 * 60 * 1000);

	ipcMain.handle('updater-check', async (_e, context: UpdaterContext) => {
		lastContext = context;
		await checkForUpdate(getMainWindow);
	});

	ipcMain.handle('updater-install', async () => {
		setQuitting(true);
		autoUpdater.quitAndInstall();
	});
}
