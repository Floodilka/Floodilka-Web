import type {Db} from 'mongodb';
import type cassandra from 'cassandra-driver';
import {getId} from '../id-map.js';
import {snowflakeFromTimestamp} from '../utils/snowflake.js';
import {createProgress} from '../utils/progress.js';
import {config} from '../config.js';

// Status mapping
const STATUS_MAP: Record<string, number> = {
	pending: 0,
	skipped: 1,
	blocked: 2,
};

export async function migrateReports(mongo: Db, cass: cassandra.Client) {
	console.log('\n=== Phase 12: Reports ===');
	const collection = mongo.collection('messagereports');
	const total = await collection.countDocuments();
	console.log(`  Found ${total} reports in MongoDB`);

	if (config.dryRun) return;

	const cursor = collection.find();
	const progress = createProgress('Reports', total);

	for await (const doc of cursor) {
		const createdAt = doc.createdAt ? new Date(doc.createdAt) : doc._id.getTimestamp();
		const reportId = snowflakeFromTimestamp(createdAt);

		const reporterHex = doc.reporterId?.toHexString?.() ?? doc.reporterId?.toString?.();
		const reporterId = reporterHex ? getId(reporterHex) : null;

		const reportedUserHex = doc.reportedUserId?.toHexString?.() ?? doc.reportedUserId?.toString?.();
		const reportedUserId = reportedUserHex ? getId(reportedUserHex) : null;

		const status = STATUS_MAP[doc.status] ?? 0;

		await cass.execute(
			`INSERT INTO iar_submissions (
				report_id, reporter_id, reported_at, status,
				report_type, category, additional_info,
				reported_user_id,
				reported_message_id, reported_channel_id, reported_channel_name,
				resolved_at, resolved_by_admin_id
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				reportId,
				reporterId,
				createdAt,
				status,
				0, // report_type: message
				doc.reason ?? null,
				null,
				reportedUserId,
				null, // reported_message_id (would need mapping)
				null, // reported_channel_id
				null,
				doc.resolvedAt ? new Date(doc.resolvedAt) : null,
				null,
			],
			{prepare: true},
		);

		progress.tick();
	}

	progress.done();
}
