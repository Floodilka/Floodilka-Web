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

// Discord epoch: 2015-01-01T00:00:00.000Z
const EPOCH = 1420070400000n;

// Per-timestamp counters to avoid collisions when timestamps are interleaved
const counters = new Map<bigint, bigint>();

export function snowflakeFromTimestamp(timestamp: number | Date): bigint {
	const ts = typeof timestamp === 'number' ? BigInt(timestamp) : BigInt(timestamp.getTime());
	const shifted = (ts - EPOCH) << 22n;

	const counter = counters.get(ts) ?? 0n;
	counters.set(ts, counter + 1n);

	return shifted | (counter & 0x3FFFFFn);
}

export function timestampFromSnowflake(snowflake: bigint): number {
	return Number((snowflake >> 22n) + EPOCH);
}

export function bucketFromSnowflake(snowflake: bigint): number {
	// 10-day buckets (864000000ms = 10 days in ms)
	return Math.floor(Number(snowflake >> 22n) / 864000000);
}

export function resetCounter() {
	counters.clear();
}
