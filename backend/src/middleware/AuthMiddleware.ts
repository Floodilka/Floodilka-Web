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

import {createMiddleware} from 'hono/factory';
import type {HonoEnv} from '~/App';
import {AccessDeniedError, AccountSuspiciousActivityError, UnauthorizedError} from '~/Errors';

export const LoginRequired = createMiddleware<HonoEnv>(async (ctx, next) => {
	const user = ctx.get('user');
	if (!user) {
		throw new UnauthorizedError();
	}
	if (user.suspiciousActivityFlags !== null && user.suspiciousActivityFlags !== 0) {
		throw new AccountSuspiciousActivityError(user.suspiciousActivityFlags);
	}

	await next();
});

export const LoginRequiredAllowSuspicious = createMiddleware<HonoEnv>(async (ctx, next) => {
	const user = ctx.get('user');
	if (!user) {
		throw new UnauthorizedError();
	}
	await next();
});

export const DefaultUserOnly = createMiddleware<HonoEnv>(async (ctx, next) => {
	const user = ctx.get('user');
	if (!user) {
		throw new UnauthorizedError();
	}
	if (user.isBot) {
		throw new AccessDeniedError();
	}
	await next();
});
