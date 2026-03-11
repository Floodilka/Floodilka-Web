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
