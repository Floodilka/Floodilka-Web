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

import type {Context} from 'hono';
import type {KlipyCategoryTagResponse, KlipyGifResponse} from '~/klipy/KlipyModel';

export interface IKlipyService {
	search(params: {q: string; locale: string; ctx: Context}): Promise<Array<KlipyGifResponse>>;

	registerShare(params: {id: string; q: string; locale: string; ctx: Context}): Promise<void>;

	getFeatured(params: {locale: string; ctx: Context}): Promise<{
		gifs: Array<KlipyGifResponse>;
		categories: Array<KlipyCategoryTagResponse>;
	}>;

	getTrendingGifs(params: {locale: string; ctx: Context}): Promise<Array<KlipyGifResponse>>;

	suggest(params: {q: string; locale: string; ctx: Context}): Promise<Array<string>>;
}
