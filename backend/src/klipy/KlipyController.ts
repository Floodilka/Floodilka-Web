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

import {createMiddleware} from 'hono/factory';
import type {HonoApp, HonoEnv} from '~/App';
import {Config} from '~/Config';
import {Locales} from '~/Constants';
import {MissingAccessError} from '~/Errors';
import {Logger} from '~/Logger';
import {DefaultUserOnly, LoginRequired} from '~/middleware/AuthMiddleware';
import {RateLimitMiddleware} from '~/middleware/RateLimitMiddleware';
import {RateLimitConfigs} from '~/RateLimitConfig';
import {createStringType, z} from '~/Schema';
import {Validator} from '~/Validator';

const klipyApiKeyRequiredMiddleware = createMiddleware<HonoEnv>(async (_ctx, next) => {
	if (!Config.klipy.apiKey) {
		Logger.debug('Klipy API key is missing');
		throw new MissingAccessError();
	}
	await next();
});

const LocaleType = z
	.enum(Object.values(Locales))
	.default('en-US')
	.transform((v) => v.replace('-', '_'));

export const KlipyController = (app: HonoApp) => {
	app.get(
		'/klipy/search',
		RateLimitMiddleware(RateLimitConfigs.KLIPY_SEARCH),
		klipyApiKeyRequiredMiddleware,
		LoginRequired,
		DefaultUserOnly,
		Validator('query', z.object({q: createStringType(), locale: LocaleType})),
		async (ctx) => {
			const {q, locale} = ctx.req.valid('query');
			return ctx.json(await ctx.get('klipyService').search({q, locale, ctx}));
		},
	);

	app.get(
		'/klipy/featured',
		RateLimitMiddleware(RateLimitConfigs.KLIPY_FEATURED),
		klipyApiKeyRequiredMiddleware,
		LoginRequired,
		DefaultUserOnly,
		Validator('query', z.object({locale: LocaleType})),
		async (ctx) => {
			return ctx.json(await ctx.get('klipyService').getFeatured({locale: ctx.req.valid('query').locale, ctx}));
		},
	);

	app.get(
		'/klipy/trending-gifs',
		RateLimitMiddleware(RateLimitConfigs.KLIPY_TRENDING),
		klipyApiKeyRequiredMiddleware,
		LoginRequired,
		DefaultUserOnly,
		Validator('query', z.object({locale: LocaleType})),
		async (ctx) => {
			return ctx.json(await ctx.get('klipyService').getTrendingGifs({locale: ctx.req.valid('query').locale, ctx}));
		},
	);

	app.post(
		'/klipy/register-share',
		RateLimitMiddleware(RateLimitConfigs.KLIPY_REGISTER_SHARE),
		klipyApiKeyRequiredMiddleware,
		LoginRequired,
		DefaultUserOnly,
		Validator('json', z.object({id: createStringType(), q: createStringType(0).nullish(), locale: LocaleType})),
		async (ctx) => {
			const {id, q, locale} = ctx.req.valid('json');
			await ctx.get('klipyService').registerShare({id, q: q ?? '', locale, ctx});
			return ctx.body(null, 204);
		},
	);

	app.get(
		'/klipy/suggest',
		RateLimitMiddleware(RateLimitConfigs.KLIPY_SUGGEST),
		klipyApiKeyRequiredMiddleware,
		LoginRequired,
		DefaultUserOnly,
		Validator('query', z.object({q: createStringType(), locale: LocaleType})),
		async (ctx) => {
			const {q, locale} = ctx.req.valid('query');
			return ctx.json(await ctx.get('klipyService').suggest({q, locale, ctx}));
		},
	);
};
