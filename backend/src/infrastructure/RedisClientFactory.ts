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

import {Redis, type RedisOptions} from 'ioredis';
import {Config} from '~/Config';

function isSentinelMode(): boolean {
	return !!(
		Config.redis.sentinels &&
		Config.redis.sentinels.length > 0 &&
		Config.redis.sentinelMasterName
	);
}

function buildSentinelOptions(extra: RedisOptions = {}): RedisOptions {
	return {
		sentinels: Config.redis.sentinels,
		name: Config.redis.sentinelMasterName,
		password: Config.redis.password,
		sentinelPassword: Config.redis.password,
		...extra,
	};
}

function requireUrl(): string {
	if (!Config.redis.url) {
		throw new Error('Redis configuration missing: set VALKEY_SENTINELS or REDIS_URL');
	}
	return Config.redis.url;
}

function buildUrlOptions(extra: RedisOptions = {}): {url: string; opts: RedisOptions} {
	const rawUrl = requireUrl();
	const url = new URL(rawUrl);
	const decoded: RedisOptions = {
		password: url.password ? decodeURIComponent(url.password) : undefined,
		username: url.username ? decodeURIComponent(url.username) : undefined,
	};
	return {url: rawUrl, opts: {...decoded, ...extra}};
}

export function createRedisClient(extra: RedisOptions = {}): Redis {
	if (isSentinelMode()) {
		return new Redis(buildSentinelOptions(extra));
	}
	const {url, opts} = buildUrlOptions(extra);
	return new Redis(url, opts);
}

export function buildBullMQConnectionOptions(): RedisOptions {
	const base: RedisOptions = {
		maxRetriesPerRequest: null,
		enableReadyCheck: false,
	};
	if (isSentinelMode()) {
		return buildSentinelOptions(base);
	}
	const url = new URL(requireUrl());
	return {
		host: url.hostname,
		port: Number(url.port || 6379),
		username: url.username ? decodeURIComponent(url.username) : undefined,
		password: url.password ? decodeURIComponent(url.password) : undefined,
		db: url.pathname.length > 1 ? Number(url.pathname.slice(1)) : 0,
		...base,
	};
}
