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

import type {HonoApp} from '~/App';
import {WebhookVerificationError} from '~/Errors';
import {DefaultUserOnly, LoginRequired} from '~/middleware/AuthMiddleware';
import {RateLimitMiddleware} from '~/middleware/RateLimitMiddleware';
import {RateLimitConfigs} from '~/RateLimitConfig';
import {createStringType, z} from '~/Schema';
import {ChargeRequest, GiftChargeRequest, mapGiftCodeToMetadataResponse, mapGiftCodeToResponse} from './PaymentModel';
import type {WebhookType} from './services/WebhookService';
import {Validator} from '~/Validator';

export const PaymentController = (app: HonoApp) => {
	// CloudPayments webhooks — separate endpoints per type
	const webhookTypes: WebhookType[] = ['check', 'pay', 'fail', 'recurrent', 'refund'];

	for (const type of webhookTypes) {
		app.post(`/payments/webhook/${type}`, async (ctx) => {
			const signature = ctx.req.header('Content-HMAC') || ctx.req.header('X-Content-HMAC') || '';
			if (!signature) {
				throw new WebhookVerificationError();
			}
			const body = await ctx.req.text();
			let parsedBody;
			const contentType = ctx.req.header('content-type') || '';
			if (contentType.includes('application/json')) {
				try {
					parsedBody = JSON.parse(body);
				} catch {
					parsedBody = {};
				}
			} else {
				const raw = Object.fromEntries(new URLSearchParams(body));
				parsedBody = {
					...raw,
					TransactionId: raw.TransactionId ? Number(raw.TransactionId) : undefined,
					Amount: raw.Amount ? Number(raw.Amount) : undefined,
					StatusCode: raw.StatusCode ? Number(raw.StatusCode) : undefined,
				};
			}
			const result = await ctx.get('paymentService').handleWebhook({type, body, signature, parsedBody});
			return ctx.json({code: result.code});
		});
	}

	// Charge card for subscription
	app.post(
		'/payments/charge',
		RateLimitMiddleware(RateLimitConfigs.PAYMENT_CHARGE),
		LoginRequired,
		DefaultUserOnly,
		Validator('json', ChargeRequest),
		async (ctx) => {
			const {cryptogram, billing_cycle, name} = ctx.req.valid('json');
			const userId = ctx.get('user').id;
			const ipAddress = ctx.req.header('x-forwarded-for') || ctx.req.header('x-real-ip') || '127.0.0.1';
			await ctx.get('paymentService').chargeSubscription({
				userId,
				cryptogram,
				billingCycle: billing_cycle,
				name,
				ipAddress,
			});
			return ctx.json({success: true});
		},
	);

	// Charge card for gift
	app.post(
		'/payments/checkout/gift',
		RateLimitMiddleware(RateLimitConfigs.PAYMENT_CHECKOUT_GIFT),
		LoginRequired,
		DefaultUserOnly,
		Validator('json', GiftChargeRequest),
		async (ctx) => {
			const {cryptogram, duration_months, name} = ctx.req.valid('json');
			const userId = ctx.get('user').id;
			const ipAddress = ctx.req.header('x-forwarded-for') || ctx.req.header('x-real-ip') || '127.0.0.1';
			await ctx.get('paymentService').chargeGift({
				userId,
				cryptogram,
				durationMonths: duration_months,
				name,
				ipAddress,
			});
			return ctx.json({success: true});
		},
	);

	// Gift code routes
	app.get(
		'/gifts/:code',
		RateLimitMiddleware(RateLimitConfigs.GIFT_CODE_GET),
		Validator('param', z.object({code: createStringType()})),
		async (ctx) => {
			const {code} = ctx.req.valid('param');
			const giftCode = await ctx.get('paymentService').getGiftCode(code);
			const response = await mapGiftCodeToResponse({
				giftCode,
				userCacheService: ctx.get('userCacheService'),
				requestCache: ctx.get('requestCache'),
				includeCreator: true,
			});
			return ctx.json(response);
		},
	);

	app.post(
		'/gifts/:code/redeem',
		RateLimitMiddleware(RateLimitConfigs.GIFT_CODE_REDEEM),
		LoginRequired,
		DefaultUserOnly,
		Validator('param', z.object({code: createStringType()})),
		async (ctx) => {
			const {code} = ctx.req.valid('param');
			const userId = ctx.get('user').id;
			await ctx.get('paymentService').redeemGiftCode(userId, code);
			return ctx.body(null, 204);
		},
	);

	app.get(
		'/users/@me/gifts',
		RateLimitMiddleware(RateLimitConfigs.GIFTS_LIST),
		LoginRequired,
		DefaultUserOnly,
		async (ctx) => {
			const userId = ctx.get('user').id;
			const gifts = await ctx.get('paymentService').getUserGifts(userId);
			const responses = await Promise.all(
				gifts.map((gift) =>
					mapGiftCodeToMetadataResponse({
						giftCode: gift,
						userCacheService: ctx.get('userCacheService'),
						requestCache: ctx.get('requestCache'),
					}),
				),
			);
			return ctx.json(responses);
		},
	);

	// Premium prices
	app.get('/premium/prices', RateLimitMiddleware(RateLimitConfigs.PREMIUM_PRICES), async (ctx) => {
		const prices = ctx.get('paymentService').getPrices();
		return ctx.json(prices);
	});

	// Subscription management
	app.post(
		'/premium/cancel-subscription',
		RateLimitMiddleware(RateLimitConfigs.SUBSCRIPTION_CANCEL),
		LoginRequired,
		DefaultUserOnly,
		async (ctx) => {
			const userId = ctx.get('user').id;
			await ctx.get('paymentService').cancelSubscriptionAtPeriodEnd(userId);
			return ctx.body(null, 204);
		},
	);

	app.post(
		'/premium/reactivate-subscription',
		RateLimitMiddleware(RateLimitConfigs.SUBSCRIPTION_REACTIVATE),
		LoginRequired,
		DefaultUserOnly,
		async (ctx) => {
			const userId = ctx.get('user').id;
			await ctx.get('paymentService').reactivateSubscription(userId);
			return ctx.body(null, 204);
		},
	);
};
