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

import {sources} from '@rspack/core';

function normalizeEndpoint(cdnEndpoint) {
	if (!cdnEndpoint) return '';
	return cdnEndpoint.endsWith('/') ? cdnEndpoint.slice(0, -1) : cdnEndpoint;
}

function generateManifest(cdnEndpointRaw) {
	const cdnEndpoint = normalizeEndpoint(cdnEndpointRaw);

	const manifest = {
		name: 'Флудилка',
		short_name: 'Флудилка',
		description:
			'Флудилка — независимая платформа обмена сообщениями и голосовой связи. Создана для друзей, групп и сообществ.',
		start_url: '/',
		display: 'standalone',
		orientation: 'portrait-primary',
		theme_color: '#4641D9',
		background_color: '#2b2d31',
		categories: ['social', 'communication'],
		lang: 'en',
		scope: '/',
		icons: [
			{
				src: `${cdnEndpoint}/web/android-chrome-192x192.png`,
				sizes: '192x192',
				type: 'image/png',
				purpose: 'maskable any',
			},
			{
				src: `${cdnEndpoint}/web/android-chrome-512x512.png`,
				sizes: '512x512',
				type: 'image/png',
				purpose: 'maskable any',
			},
			{
				src: `${cdnEndpoint}/web/apple-touch-icon.png`,
				sizes: '180x180',
				type: 'image/png',
			},
			{
				src: `${cdnEndpoint}/web/favicon-32x32.png`,
				sizes: '32x32',
				type: 'image/png',
			},
			{
				src: `${cdnEndpoint}/web/favicon-16x16.png`,
				sizes: '16x16',
				type: 'image/png',
			},
		],
	};

	return JSON.stringify(manifest, null, 2);
}

function generateBrowserConfig(cdnEndpointRaw) {
	const cdnEndpoint = normalizeEndpoint(cdnEndpointRaw);

	return `<?xml version="1.0" encoding="utf-8"?>
<browserconfig>
  <msapplication>
    <tile>
      <square150x150logo src="${cdnEndpoint}/web/mstile-150x150.png"/>
      <TileColor>#4641D9</TileColor>
    </tile>
  </msapplication>
</browserconfig>`;
}

function generateRobotsTxt() {
	const disallowPaths = [
		'/channels/',
		'/oauth2/',
		'/verify',
		'/reset',
		'/wasntme',
		'/report',
		'/bookmarks',
		'/mentions',
		'/notifications',
		'/you',
		'/api/',
		'/invite/',
	];

	const disallowBlock = disallowPaths.map((p) => `Disallow: ${p}`).join('\n');

	return [
		'# Флудилка — голосовой чат для геймеров',
		'# https://floodilka.com',
		'',
		'User-agent: *',
		'Allow: /',
		'Allow: /faq',
		'Allow: /download',
		'Allow: /support',
		'Allow: /terms',
		'Allow: /privacy',
		'Allow: /guidelines',
		disallowBlock,
		'',
		'# Googlebot',
		'User-agent: Googlebot',
		'Allow: /',
		disallowBlock,
		'',
		'# Yandex',
		'User-agent: Yandex',
		'Allow: /',
		disallowBlock,
		'Clean-param: ref /',
		'Clean-param: utm_source&utm_medium&utm_campaign /',
		'Crawl-delay: 2',
		'',
		'# Mail.ru',
		'User-agent: Mail.RU_Bot',
		'Allow: /',
		disallowBlock,
		'Crawl-delay: 3',
		'',
		'Host: https://floodilka.com',
		'Sitemap: https://floodilka.com/sitemap.xml',
		'',
	].join('\n');
}

export class StaticFilesPlugin {
	constructor(options) {
		this.cdnEndpoint = options?.cdnEndpoint ?? '';
	}

	apply(compiler) {
		compiler.hooks.thisCompilation.tap('StaticFilesPlugin', (compilation) => {
			compilation.hooks.processAssets.tap(
				{
					name: 'StaticFilesPlugin',
					stage: compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
				},
				() => {
					compilation.emitAsset('manifest.json', new sources.RawSource(generateManifest(this.cdnEndpoint)));
					compilation.emitAsset('browserconfig.xml', new sources.RawSource(generateBrowserConfig(this.cdnEndpoint)));
					compilation.emitAsset('robots.txt', new sources.RawSource(generateRobotsTxt()));
				},
			);
		});
	}
}

export function staticFilesPlugin(options) {
	return new StaticFilesPlugin(options);
}
