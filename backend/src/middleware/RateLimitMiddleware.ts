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

import {createHmac, timingSafeEqual} from 'node:crypto';
import type {Context, MiddlewareHandler} from 'hono';
import {createMiddleware} from 'hono/factory';
import type {HonoEnv} from '~/App';
import {Config} from '~/Config';
import {UserFlags} from '~/Constants';
import {RateLimitError} from '~/Errors';
import type {BucketConfig} from '~/infrastructure/IRateLimitService';
import {getMetricsService} from '~/infrastructure/MetricsService';
import {extractClientIp} from '~/utils/IpUtils';

const LOAD_TEST_HEADER = 'x-load-test-token';
const LOAD_TEST_MAX_SKEW_SECONDS = 300;

function isLoadTestBypass(ctx: Context<HonoEnv>): boolean {
	const secret = Config.dev.loadTestBypassSecret;
	if (!secret) return false;

	const header = ctx.req.header(LOAD_TEST_HEADER);
	if (!header) return false;

	const dot = header.indexOf('.');
	if (dot <= 0 || dot === header.length - 1) return false;

	const tsPart = header.slice(0, dot);
	const sigPart = header.slice(dot + 1);

	const ts = Number(tsPart);
	if (!Number.isInteger(ts)) return false;

	const now = Math.floor(Date.now() / 1000);
	if (Math.abs(now - ts) > LOAD_TEST_MAX_SKEW_SECONDS) return false;

	const expected = createHmac('sha256', secret).update(tsPart).digest('hex');
	if (sigPart.length !== expected.length) return false;

	const a = Buffer.from(sigPart, 'utf8');
	const b = Buffer.from(expected, 'utf8');
	try {
		return timingSafeEqual(a, b);
	} catch {
		return false;
	}
}

export interface RouteRateLimitConfig {
	bucket: string;
	config: BucketConfig;
}

function getClientIdentifier(ctx: Context<HonoEnv>): string {
	const user = ctx.get('user');
	if (user?.id) {
		return `user:${user.id}`;
	}
	const ip = extractClientIp(ctx.req.raw);
	if (!ip) return 'internal';
	return `ip:${ip}`;
}

function getGlobalRateLimit(ctx: Context<HonoEnv>): number {
	const user = ctx.get('user');
	if (user?.flags && (user.flags & UserFlags.HIGH_GLOBAL_RATE_LIMIT) !== 0n) {
		return 1200;
	}
	return 50;
}

function resolveBucket(bucket: string, ctx: Context<HonoEnv>): string {
	let resolved = bucket;

	const params = ctx.req.param();
	for (const [key, value] of Object.entries(params)) {
		resolved = resolved.replace(`:${key}`, String(value));
	}

	const clientId = getClientIdentifier(ctx);
	return `${clientId}:${resolved}`;
}

function setRateLimitHeaders(ctx: Context<HonoEnv>, limit: number, remaining: number, resetTime: Date): void {
	ctx.header('X-RateLimit-Limit', limit.toString());
	ctx.header('X-RateLimit-Remaining', remaining.toString());
	ctx.header('X-RateLimit-Reset', Math.floor(resetTime.getTime() / 1000).toString());
}

export function RateLimitMiddleware(routeConfig: RouteRateLimitConfig): MiddlewareHandler<HonoEnv> {
	return createMiddleware<HonoEnv>(async (ctx, next) => {
		if (Config.dev.disableRateLimits || Config.dev.testModeEnabled || process.env.CI === 'true') {
			await next();
			return;
		}

		if (isLoadTestBypass(ctx)) {
			getMetricsService().counter({
				name: 'api.ratelimit.bypass',
				dimensions: {reason: 'load_test'},
			});
			await next();
			return;
		}

		const user = ctx.get('user');

		if (user?.flags && (user.flags & UserFlags.RATE_LIMIT_BYPASS) !== 0n) {
			await next();
			return;
		}

		const rateLimitService = ctx.get('rateLimitService');
		if (!rateLimitService) {
			await next();
			return;
		}

		const metrics = getMetricsService();
		const clientId = getClientIdentifier(ctx);

		if (!routeConfig.config.exemptFromGlobal) {
			const globalLimit = getGlobalRateLimit(ctx);
			const globalResult = await rateLimitService.checkGlobalLimit(clientId, globalLimit);

			metrics.counter({
				name: 'api.ratelimit.check',
				dimensions: {bucket: 'global'},
			});

			if (!globalResult.allowed) {
				metrics.counter({
					name: 'api.ratelimit.blocked',
					dimensions: {bucket: 'global'},
				});
				throw new RateLimitError({
					global: true,
					retryAfter: globalResult.retryAfter!,
					retryAfterDecimal: globalResult.retryAfterDecimal,
					limit: globalResult.limit,
					resetTime: globalResult.resetTime,
				});
			}

			metrics.counter({
				name: 'api.ratelimit.allowed',
				dimensions: {bucket: 'global'},
			});
		}

		const bucket = resolveBucket(routeConfig.bucket, ctx);
		const bucketResult = await rateLimitService.checkBucketLimit(bucket, routeConfig.config);

		metrics.counter({
			name: 'api.ratelimit.check',
			dimensions: {bucket: routeConfig.bucket},
		});

		if (!bucketResult.allowed) {
			metrics.counter({
				name: 'api.ratelimit.blocked',
				dimensions: {bucket: routeConfig.bucket},
			});
			throw new RateLimitError({
				global: false,
				retryAfter: bucketResult.retryAfter!,
				retryAfterDecimal: bucketResult.retryAfterDecimal,
				limit: bucketResult.limit,
				resetTime: bucketResult.resetTime,
			});
		}

		metrics.counter({
			name: 'api.ratelimit.allowed',
			dimensions: {bucket: routeConfig.bucket},
		});

		setRateLimitHeaders(ctx, bucketResult.limit, bucketResult.remaining, bucketResult.resetTime);

		await next();
	});
}
