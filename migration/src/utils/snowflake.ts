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
