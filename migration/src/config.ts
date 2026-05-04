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

import 'dotenv/config';

function env(key: string, fallback?: string): string {
	const val = process.env[key] ?? fallback;
	if (val === undefined) {
		throw new Error(`Missing required env var: ${key}`);
	}
	return val;
}

export const config = {
	mongo: {
		uri: env('MONGO_URI', 'mongodb://localhost:27017/floodilka'),
	},
	cassandra: {
		hosts: env('CASSANDRA_HOSTS', 'localhost').split(','),
		port: Number(env('CASSANDRA_PORT', '9042')),
		keyspace: env('CASSANDRA_KEYSPACE', 'floodilka'),
		username: env('CASSANDRA_USERNAME', 'cassandra'),
		password: env('CASSANDRA_PASSWORD', 'cassandra'),
		localDc: env('CASSANDRA_LOCAL_DC', 'datacenter1'),
	},
	s3: {
		endpoint: env('S3_ENDPOINT', 'https://s3.regru.cloud'),
		accessKeyId: env('S3_ACCESS_KEY_ID', ''),
		secretAccessKey: env('S3_SECRET_ACCESS_KEY', ''),
		bucket: env('S3_BUCKET', 'floodilka-bucket'),
		/** Bucket where old files live (messages/...) */
		sourceBucket: env('S3_SOURCE_BUCKET', env('S3_BUCKET', 'floodilka-bucket')),
		/** Bucket where new files go (attachments/...) */
		cdnBucket: env('S3_CDN_BUCKET', env('S3_BUCKET', 'floodilka-bucket')),
	},
	dryRun: env('DRY_RUN', 'false') === 'true',
	skipPhases: new Set(
		env('SKIP_PHASES', '')
			.split(',')
			.filter(Boolean)
			.map(Number),
	),
	startPhase: Number(env('START_PHASE', '1')),
};
