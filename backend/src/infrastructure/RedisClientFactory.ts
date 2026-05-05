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
import {Logger} from '~/Logger';

function buildOptions(extra: RedisOptions = {}): RedisOptions {
	return {
		sentinels: Config.redis.sentinels,
		name: Config.redis.sentinelMasterName,
		password: Config.redis.password,
		sentinelPassword: Config.redis.password,
		...extra,
	};
}

function attachErrorLogger(client: Redis): Redis {
	client.on('error', (err) => {
		Logger.warn({err: err.message}, 'ioredis client error');
	});
	return client;
}

export function createRedisClient(extra: RedisOptions = {}): Redis {
	return attachErrorLogger(new Redis(buildOptions(extra)));
}

let healthClient: Redis | null = null;

export async function pingRedis(): Promise<void> {
	if (!healthClient) {
		healthClient = createRedisClient();
	}
	await healthClient.ping();
}

export async function shutdownHealthClient(): Promise<void> {
	if (healthClient) {
		await healthClient.quit();
		healthClient = null;
	}
}

export function buildBullMQConnectionOptions(): RedisOptions {
	return buildOptions({
		maxRetriesPerRequest: null,
		enableReadyCheck: false,
	});
}
