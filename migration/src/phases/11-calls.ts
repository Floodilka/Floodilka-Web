import type {Db} from 'mongodb';
import type cassandra from 'cassandra-driver';
import {getId} from '../id-map.js';
import {snowflakeFromTimestamp, bucketFromSnowflake} from '../utils/snowflake.js';
import {getOrCreateDmChannelId} from './07-dm-channels.js';
import {createProgress} from '../utils/progress.js';
import {config} from '../config.js';
import {trackMessage} from '../utils/channel-state-tracker.js';

// Message type for calls
const MESSAGE_TYPE_CALL = 3;

export async function migrateCalls(mongo: Db, cass: cassandra.Client) {
	console.log('\n=== Phase 11: Calls ===');
	const collection = mongo.collection('calls');
	const total = await collection.countDocuments();
	console.log(`  Found ${total} calls in MongoDB`);

	if (config.dryRun) return;

	const cursor = collection.find().sort({createdAt: 1});
	const progress = createProgress('Calls', total);

	for await (const doc of cursor) {
		const callerHex = doc.callerId?.toHexString?.() ?? doc.callerId?.toString?.();
		const calleeHex = doc.calleeId?.toHexString?.() ?? doc.calleeId?.toString?.();

		const callerId = callerHex ? getId(callerHex) : null;
		const calleeId = calleeHex ? getId(calleeHex) : null;

		if (!callerId || !calleeId) {
			progress.tick();
			continue;
		}

		const createdAt = doc.createdAt ? new Date(doc.createdAt) : doc._id.getTimestamp();
		const channelId = getOrCreateDmChannelId(callerId, calleeId, createdAt);

		const messageId = snowflakeFromTimestamp(createdAt);
		const bucket = bucketFromSnowflake(messageId);

		const participantIds = [callerId, calleeId];
		const endedTimestamp = doc.endedAt ? new Date(doc.endedAt) : null;

		await cass.execute(
			`INSERT INTO messages (
				channel_id, bucket, message_id, author_id, type,
				call, version
			) VALUES (?, ?, ?, ?, ?, ?, ?)`,
			[
				channelId,
				bucket,
				messageId,
				callerId,
				MESSAGE_TYPE_CALL,
				{participant_ids: participantIds, ended_timestamp: endedTimestamp},
				1, // version
			],
			{prepare: true},
		);

		trackMessage(channelId, messageId, bucket);

		// Ensure DM channel exists in channels table
		const recipientIds = [callerId, calleeId];
		await cass.execute(
			`INSERT INTO channels (channel_id, soft_deleted, type, recipient_ids) VALUES (?, ?, ?, ?) IF NOT EXISTS`,
			[channelId, false, 1, recipientIds],
			{prepare: true},
		);

		progress.tick();
	}

	progress.done();
}
