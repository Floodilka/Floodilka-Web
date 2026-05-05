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

import fs from 'node:fs';
import path from 'node:path';
import {app, protocol} from 'electron';
import log from 'electron-log';

const WEB_HOSTS = new Set(['floodilka.com', 'stage.floodilka.com']);
const NETWORK_PREFIXES = ['/api', '/media', '/s3', '/desktop/updates', '/error-reporting-proxy'];

const MIME_TYPES = new Map<string, string>([
	['.html', 'text/html; charset=utf-8'],
	['.js', 'text/javascript; charset=utf-8'],
	['.css', 'text/css; charset=utf-8'],
	['.json', 'application/json; charset=utf-8'],
	['.wasm', 'application/wasm'],
	['.svg', 'image/svg+xml'],
	['.png', 'image/png'],
	['.jpg', 'image/jpeg'],
	['.jpeg', 'image/jpeg'],
	['.gif', 'image/gif'],
	['.webp', 'image/webp'],
	['.ico', 'image/x-icon'],
	['.woff', 'font/woff'],
	['.woff2', 'font/woff2'],
	['.ttf', 'font/ttf'],
	['.mp3', 'audio/mpeg'],
	['.mp4', 'video/mp4'],
	['.webm', 'video/webm'],
]);

let registered = false;

const getWebRoot = (): string | null => {
	if (!app.isPackaged) {
		return null;
	}

	return path.resolve(process.resourcesPath, 'web');
};

const getPackagedIndexPath = (): string | null => {
	const webRoot = getWebRoot();
	if (!webRoot) return null;

	const indexPath = path.join(webRoot, 'index.html');
	return fs.existsSync(indexPath) ? indexPath : null;
};

const shouldServeFromBundle = (url: URL, method: string): boolean => {
	if (method !== 'GET' && method !== 'HEAD') return false;
	if (!WEB_HOSTS.has(url.hostname)) return false;
	return !NETWORK_PREFIXES.some((prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`));
};

const resolveRequestPath = (root: string, requestPath: string): string | null => {
	let decodedPath = '/';
	try {
		decodedPath = decodeURIComponent(requestPath);
	} catch {
		return null;
	}

	const normalized = path.normalize(decodedPath).replace(/^[/\\]+/, '');
	const candidate = path.resolve(root, normalized || 'index.html');
	const relative = path.relative(root, candidate);

	if (relative.startsWith('..') || path.isAbsolute(relative)) {
		return null;
	}

	return candidate;
};

const getUploadData = (request: Electron.ProtocolRequest): Electron.ProtocolResponseUploadData | undefined => {
	const chunks = request.uploadData?.map((entry) => entry.bytes).filter(Boolean);
	if (!chunks?.length) return undefined;

	return {
		contentType: request.headers['content-type'] ?? '',
		data: Buffer.concat(chunks),
	};
};

export function registerLocalWebBundleInterceptor(): void {
	if (registered) return;

	const indexPath = getPackagedIndexPath();
	if (!indexPath) {
		return;
	}

	const webRoot = path.dirname(indexPath);

	const ok = protocol.interceptFileProtocol('https', (request, callback) => {
		let requestUrl: URL;
		try {
			requestUrl = new URL(request.url);
		} catch {
			callback({error: -300});
			return;
		}

		if (!shouldServeFromBundle(requestUrl, request.method)) {
			callback({
				url: request.url,
				method: request.method,
				referrer: request.referrer,
				headers: request.headers,
				uploadData: getUploadData(request),
			});
			return;
		}

		const requestedFile = resolveRequestPath(webRoot, requestUrl.pathname);
		const filePath =
			requestedFile && fs.existsSync(requestedFile) && fs.statSync(requestedFile).isFile()
				? requestedFile
				: indexPath;
		const ext = path.extname(filePath).toLowerCase();

		callback({
			path: filePath,
			mimeType: MIME_TYPES.get(ext) ?? 'application/octet-stream',
			headers: {
				'Cache-Control': filePath === indexPath ? 'no-store' : 'public, max-age=31536000, immutable',
			},
		});
	});

	if (!ok) {
		throw new Error('Failed to intercept https protocol for packaged web bundle');
	}

	registered = true;
	log.info('[Local Web Bundle] Serving packaged renderer for floodilka.com');
}
