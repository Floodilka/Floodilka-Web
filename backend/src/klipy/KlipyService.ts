/*
 * Copyright (C) 2026 Fluxer Contributors
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

import type {Context} from 'hono';
import {Config} from '~/Config';
import {FLOODILKA_USER_AGENT} from '~/Constants';
import type {ICacheService} from '~/infrastructure/ICacheService';
import type {IMediaService} from '~/infrastructure/IMediaService';
import type {IKlipyService} from '~/infrastructure/IKlipyService';
import {Logger} from '~/Logger';
import type {KlipyCategoryTagResponse, KlipyGifResponse} from '~/klipy/KlipyModel';

const KLIPY_BASE_URL = 'https://api.klipy.com/v2';
const DEFAULT_MEDIA_FILTER = 'webm';
const DEFAULT_CONTENT_FILTER = 'low';
const CLIENT_KEY = 'floodilka';
const MAX_RETRIES = 3;
const BACKOFF_BASE_DELAY = 1000;
const CACHE_EXPIRATION_TIME = 300 * 1000;
const SEARCH_CACHE_TTL = 60;

interface KlipyGif {
	id: string;
	title: string;
	media_formats: {
		webm: {
			url: string;
			dims: [number, number];
		};
	};
	itemurl: string;
}

interface KlipyCategoryTag {
	searchterm: string;
	image?: string;
}

type CacheEntry<T> = {
	data: T;
	timestamp: number;
};

export class KlipyService implements IKlipyService {
	private readonly FEATURED_CACHE_KEY = 'klipy:featured';
	private readonly TRENDING_CACHE_KEY = 'klipy:trending';

	private refreshingKeys: Map<string, boolean> = new Map();

	constructor(
		private cacheService: ICacheService,
		private mediaService: IMediaService,
	) {}

	private createURL({endpoint, params}: {endpoint: string; params: Record<string, string | number | undefined>}): URL {
		const url = new URL(`${KLIPY_BASE_URL}/${endpoint}`);
		const defaultParams = {
			client_key: CLIENT_KEY,
			contentfilter: DEFAULT_CONTENT_FILTER,
			media_filter: DEFAULT_MEDIA_FILTER,
			...params,
		};

		for (const [key, value] of Object.entries(defaultParams)) {
			if (value !== undefined) {
				url.searchParams.append(key, value.toString());
			}
		}

		return url;
	}

	private async fetchData<T>(url: URL): Promise<T> {
		for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
			try {
				const response = await fetch(url.toString(), {headers: {'User-Agent': FLOODILKA_USER_AGENT}});
				if (!response.ok) {
					throw new Error(`Failed to fetch Klipy data: ${response.statusText}`);
				}
				return response.json() as Promise<T>;
			} catch (error) {
				if (attempt < MAX_RETRIES - 1) {
					const delay = BACKOFF_BASE_DELAY * 2 ** attempt;
					await new Promise((resolve) => setTimeout(resolve, delay));
				} else {
					throw error;
				}
			}
		}
		throw new Error('Exceeded maximum retries');
	}

	private async fetchAndTransformGifs(url: URL): Promise<Array<KlipyGifResponse>> {
		const {results} = await this.fetchData<{results: Array<KlipyGif>}>(url);
		return results.map((gif) => this.transformGif(gif));
	}

	private async getCache<T>(key: string): Promise<{data: T; isStale: boolean} | null> {
		const cached = await this.cacheService.get<CacheEntry<T>>(key);
		if (!cached) return null;
		const age = Date.now() - cached.timestamp;
		const isStale = age > CACHE_EXPIRATION_TIME;
		return {data: cached.data, isStale};
	}

	private async setCache<T>(key: string, data: T): Promise<void> {
		const cacheEntry: CacheEntry<T> = {
			data,
			timestamp: Date.now(),
		};
		await this.cacheService.set(key, cacheEntry);
	}

	private triggerBackgroundRefresh<T>(key: string, refreshFn: () => Promise<T>): void {
		if (this.refreshingKeys.get(key)) {
			return;
		}
		this.refreshingKeys.set(key, true);
		setImmediate(async () => {
			try {
				const freshData = await refreshFn();
				await this.setCache(key, freshData);
			} catch (error) {
				Logger.debug({key, error}, `Background refresh failed for key ${key}`);
			} finally {
				this.refreshingKeys.delete(key);
			}
		});
	}

	async search(params: {q: string; locale: string; ctx: Context}): Promise<Array<KlipyGifResponse>> {
		const cacheKey = `klipy:search:${params.locale}:${params.q.trim().toLowerCase()}`;
		const cached = await this.cacheService.get<Array<KlipyGifResponse>>(cacheKey);
		if (cached) return cached;

		const url = this.createURL({
			endpoint: 'search',
			params: {
				key: Config.klipy.apiKey,
				q: params.q,
				country: params.ctx.req.header('CF-IPCountry') || 'US',
				locale: params.locale,
				limit: 50,
			},
		});
		const results = await this.fetchAndTransformGifs(url);
		await this.cacheService.set(cacheKey, results, SEARCH_CACHE_TTL);
		return results;
	}

	async registerShare(params: {id: string; q: string; locale: string; ctx: Context}): Promise<void> {
		const url = this.createURL({
			endpoint: 'registershare',
			params: {
				key: Config.klipy.apiKey,
				id: params.id,
				country: params.ctx.req.header('CF-IPCountry') || 'US',
				locale: params.locale,
				q: params.q,
			},
		});
		await fetch(url.toString(), {headers: {'User-Agent': FLOODILKA_USER_AGENT}});
	}

	async getFeatured(params: {locale: string; ctx: Context}): Promise<{
		gifs: Array<KlipyGifResponse>;
		categories: Array<KlipyCategoryTagResponse>;
	}> {
		const cached = await this.getCache<{
			gifs: Array<KlipyGifResponse>;
			categories: Array<KlipyCategoryTagResponse>;
		}>(this.FEATURED_CACHE_KEY);
		if (cached) {
			if (cached.isStale) {
				this.triggerBackgroundRefresh(this.FEATURED_CACHE_KEY, () => this.fetchFeaturedData(params));
			}
			return cached.data;
		}
		const data = await this.fetchFeaturedData(params);
		await this.setCache(this.FEATURED_CACHE_KEY, data);
		return data;
	}

	private async fetchFeaturedData(params: {locale: string; ctx: Context}): Promise<{
		gifs: Array<KlipyGifResponse>;
		categories: Array<KlipyCategoryTagResponse>;
	}> {
		const [gifs, categories] = await Promise.all([this.getFeaturedGifs(params), this.getFeaturedCategories(params)]);
		return {gifs, categories};
	}

	async getTrendingGifs(params: {locale: string; ctx: Context}): Promise<Array<KlipyGifResponse>> {
		const cached = await this.getCache<Array<KlipyGifResponse>>(this.TRENDING_CACHE_KEY);
		if (cached) {
			if (cached.isStale) {
				this.triggerBackgroundRefresh(this.TRENDING_CACHE_KEY, () => this.fetchTrendingGifs(params));
			}
			return cached.data;
		}
		const gifs = await this.fetchTrendingGifs(params);
		await this.setCache(this.TRENDING_CACHE_KEY, gifs);
		return gifs;
	}

	private async fetchTrendingGifs(params: {locale: string; ctx: Context}): Promise<Array<KlipyGifResponse>> {
		const url = this.createURL({
			endpoint: 'featured',
			params: {
				key: Config.klipy.apiKey,
				country: params.ctx.req.header('CF-IPCountry') || 'US',
				locale: params.locale,
				limit: 50,
			},
		});
		return this.fetchAndTransformGifs(url);
	}

	async suggest(params: {q: string; locale: string; ctx: Context}): Promise<Array<string>> {
		const cacheKey = `klipy:suggest:${params.locale}:${params.q.trim().toLowerCase()}`;
		const cached = await this.cacheService.get<Array<string>>(cacheKey);
		if (cached) return cached;

		const url = this.createURL({
			endpoint: 'autocomplete',
			params: {
				key: Config.klipy.apiKey,
				q: params.q,
				locale: params.locale,
			},
		});
		const {results} = await this.fetchData<{results: Array<string>}>(url);
		await this.cacheService.set(cacheKey, results, SEARCH_CACHE_TTL);
		return results;
	}

	private async getFeaturedGifs(params: {locale: string; ctx: Context}): Promise<Array<KlipyGifResponse>> {
		const url = this.createURL({
			endpoint: 'featured',
			params: {
				key: Config.klipy.apiKey,
				country: params.ctx.req.header('CF-IPCountry') || 'US',
				locale: params.locale,
				limit: 1,
			},
		});
		return this.fetchAndTransformGifs(url);
	}

	private async getFeaturedCategories(params: {
		locale: string;
		ctx: Context;
	}): Promise<Array<KlipyCategoryTagResponse>> {
		const url = this.createURL({
			endpoint: 'categories',
			params: {
				key: Config.klipy.apiKey,
				country: params.ctx.req.header('CF-IPCountry') || 'US',
				locale: params.locale,
				type: 'featured',
			},
		});
		const {tags} = await this.fetchData<{tags: Array<KlipyCategoryTag>}>(url);
		return tags
			.filter((tag) => tag.image)
			.map((tag) => ({
				name: tag.searchterm,
				src: tag.image!,
				proxy_src: this.mediaService.getExternalMediaProxyURL(tag.image!),
			}));
	}

	private transformGif(input: KlipyGif): KlipyGifResponse {
		return {
			id: input.id,
			title: input.title,
			url: input.itemurl,
			src: input.media_formats.webm.url,
			proxy_src: this.mediaService.getExternalMediaProxyURL(input.media_formats.webm.url),
			width: input.media_formats.webm.dims[0],
			height: input.media_formats.webm.dims[1],
		};
	}
}
