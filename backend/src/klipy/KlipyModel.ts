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

import {z} from '~/Schema';

export const KlipyGifResponse = z.object({
	id: z.string(),
	title: z.string(),
	url: z.string(),
	src: z.string(),
	proxy_src: z.string(),
	width: z.number().int(),
	height: z.number().int(),
});

export type KlipyGifResponse = z.infer<typeof KlipyGifResponse>;

export const KlipyCategoryTagResponse = z.object({
	name: z.string(),
	src: z.string(),
	proxy_src: z.string(),
});

export type KlipyCategoryTagResponse = z.infer<typeof KlipyCategoryTagResponse>;
