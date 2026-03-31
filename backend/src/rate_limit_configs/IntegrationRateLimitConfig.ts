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

import type {RouteRateLimitConfig} from '~/middleware/RateLimitMiddleware';

export const IntegrationRateLimitConfigs = {
	KLIPY_SEARCH: {
		bucket: 'klipy:search',
		config: {limit: 40, windowMs: 10000},
	} as RouteRateLimitConfig,

	KLIPY_FEATURED: {
		bucket: 'klipy:featured',
		config: {limit: 40, windowMs: 10000},
	} as RouteRateLimitConfig,

	KLIPY_TRENDING: {
		bucket: 'klipy:trending',
		config: {limit: 40, windowMs: 10000},
	} as RouteRateLimitConfig,

	KLIPY_SUGGEST: {
		bucket: 'klipy:suggest',
		config: {limit: 40, windowMs: 10000},
	} as RouteRateLimitConfig,

	KLIPY_REGISTER_SHARE: {
		bucket: 'klipy:register_share',
		config: {limit: 60, windowMs: 10000},
	} as RouteRateLimitConfig,

	PREMIUM_PRICES: {
		bucket: 'premium:prices',
		config: {limit: 40, windowMs: 10000},
	} as RouteRateLimitConfig,

	PAYMENT_CHARGE: {
		bucket: 'payment:charge',
		config: {limit: 3, windowMs: 60000},
	} as RouteRateLimitConfig,

	PAYMENT_CHECKOUT_GIFT: {
		bucket: 'payment:checkout:gift',
		config: {limit: 3, windowMs: 60000},
	} as RouteRateLimitConfig,

	SUBSCRIPTION_CANCEL: {
		bucket: 'subscription:cancel',
		config: {limit: 5, windowMs: 60000},
	} as RouteRateLimitConfig,

	SUBSCRIPTION_REACTIVATE: {
		bucket: 'subscription:reactivate',
		config: {limit: 5, windowMs: 60000},
	} as RouteRateLimitConfig,

	GIFT_CODE_GET: {
		bucket: 'gift:get',
		config: {limit: 60, windowMs: 10000},
	} as RouteRateLimitConfig,

	GIFT_CODE_REDEEM: {
		bucket: 'gift:redeem',
		config: {limit: 10, windowMs: 60000},
	} as RouteRateLimitConfig,

	GIFTS_LIST: {
		bucket: 'gifts:list',
		config: {limit: 40, windowMs: 10000},
	} as RouteRateLimitConfig,
} as const;
