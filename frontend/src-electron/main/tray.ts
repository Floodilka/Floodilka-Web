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

import fs from 'node:fs';
import path from 'node:path';
import {app, Menu, nativeImage, Tray} from 'electron';
import log from 'electron-log';
import {showWindow} from './window.js';

let tray: Tray | null = null;

function getTrayIcon(): Electron.NativeImage {
	const iconPath = path.join(process.resourcesPath, '512x512.png');

	if (!fs.existsSync(iconPath)) {
		log.warn('[Tray] Icon not found at', iconPath, '— using empty image');
		return nativeImage.createEmpty();
	}

	const icon = nativeImage.createFromPath(iconPath);
	return icon.resize({width: 16, height: 16});
}

export function createTray(): void {
	if (process.platform === 'darwin') {
		return;
	}

	if (tray) {
		return;
	}

	const icon = getTrayIcon();
	tray = new Tray(icon);
	tray.setToolTip('Флудилка');

	const contextMenu = Menu.buildFromTemplate([
		{
			label: 'Показать',
			click: () => {
				showWindow();
			},
		},
		{type: 'separator'},
		{
			label: 'Выход',
			click: () => {
				app.quit();
			},
		},
	]);

	tray.setContextMenu(contextMenu);

	tray.on('double-click', () => {
		showWindow();
	});

	log.info('[Tray] System tray created');
}

export function destroyTray(): void {
	if (tray) {
		tray.destroy();
		tray = null;
	}
}
