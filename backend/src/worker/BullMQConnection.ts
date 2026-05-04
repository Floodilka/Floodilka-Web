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
 */

import {Queue, type ConnectionOptions} from 'bullmq';
import {Redis} from 'ioredis';
import {Config} from '~/Config';

export const FLOODILKA_QUEUE_NAME = 'floodilka';

const redisUrl = new URL(Config.redis.url);

export const bullmqConnection: ConnectionOptions = {
	host: redisUrl.hostname,
	port: Number(redisUrl.port || 6379),
	password: redisUrl.password || undefined,
	db: redisUrl.pathname.length > 1 ? Number(redisUrl.pathname.slice(1)) : 0,
	maxRetriesPerRequest: null,
	enableReadyCheck: false,
};

let queueSingleton: Queue | null = null;

export function getQueue(): Queue {
	if (!queueSingleton) {
		queueSingleton = new Queue(FLOODILKA_QUEUE_NAME, {
			connection: bullmqConnection,
			defaultJobOptions: {
				removeOnComplete: {
					age: 60 * 60,
					count: 1000,
				},
				removeOnFail: {
					age: 24 * 60 * 60,
					count: 5000,
				},
			},
		});
	}
	return queueSingleton;
}

export async function shutdownQueue(): Promise<void> {
	if (queueSingleton) {
		await queueSingleton.close();
		queueSingleton = null;
	}
}

export function createBullMQRedis(): Redis {
	return new Redis(Config.redis.url, {
		maxRetriesPerRequest: null,
		enableReadyCheck: false,
	});
}
