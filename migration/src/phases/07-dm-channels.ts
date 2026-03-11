import type {Db} from 'mongodb';
import type cassandra from 'cassandra-driver';
import {getId} from '../id-map.js';
import {snowflakeFromTimestamp} from '../utils/snowflake.js';
import {createProgress} from '../utils/progress.js';
import {config} from '../config.js';

// Cache of DM channels: "loUserId-hiUserId" → channelSnowflake
export const dmChannelMap = new Map<string, bigint>();

function dmKey(user1: bigint, user2: bigint): string {
	const lo = user1 < user2 ? user1 : user2;
	const hi = user1 < user2 ? user2 : user1;
	return `${lo}-${hi}`;
}

export function getDmChannelId(user1: bigint, user2: bigint): bigint | undefined {
	return dmChannelMap.get(dmKey(user1, user2));
}

export function getOrCreateDmChannelId(user1: bigint, user2: bigint, timestamp: Date): bigint {
	const key = dmKey(user1, user2);
	const existing = dmChannelMap.get(key);
	if (existing) return existing;

	const channelId = snowflakeFromTimestamp(timestamp);
	dmChannelMap.set(key, channelId);
	return channelId;
}

export async function migrateDmChannels(mongo: Db, cass: cassandra.Client) {
	console.log('\n=== Phase 7: DM Channels ===');
	const collection = mongo.collection('directmessages');
	const total = await collection.countDocuments();
	console.log(`  Found ${total} DMs in MongoDB, extracting unique pairs...`);

	if (config.dryRun) return;

	// First pass: find unique sender-receiver pairs and earliest non-deleted timestamp
	const pairTimestamps = new Map<string, Date>();

	const cursor = collection.find({deleted: {$ne: true}}).sort({createdAt: 1});
	for await (const doc of cursor) {
		const senderHex = doc.sender?.toHexString?.() ?? doc.sender?.toString?.();
		const receiverHex = doc.receiver?.toHexString?.() ?? doc.receiver?.toString?.();

		const senderId = senderHex ? getId(senderHex) : null;
		const receiverId = receiverHex ? getId(receiverHex) : null;

		if (!senderId || !receiverId || senderId === receiverId) continue;

		const key = dmKey(senderId, receiverId);
		if (!pairTimestamps.has(key)) {
			const ts = doc.createdAt ? new Date(doc.createdAt) : doc._id.getTimestamp();
			pairTimestamps.set(key, ts);
		}
	}

	console.log(`  Found ${pairTimestamps.size} unique DM pairs`);
	const progress = createProgress('DM Channels', pairTimestamps.size);

	for (const [key, timestamp] of pairTimestamps) {
		const [loStr, hiStr] = key.split('-');
		const loUserId = BigInt(loStr);
		const hiUserId = BigInt(hiStr);

		const channelId = getOrCreateDmChannelId(loUserId, hiUserId, timestamp);
		const recipientIds = [loUserId, hiUserId];

		// Insert channel (type=1 = DM)
		await cass.execute(
			`INSERT INTO channels (
				channel_id, soft_deleted, type, recipient_ids
			) VALUES (?, ?, ?, ?)`,
			[channelId, false, 1, recipientIds],
			{prepare: true},
		);

		// Insert dm_states
		await cass.execute(
			'INSERT INTO dm_states (hi_user_id, lo_user_id, channel_id) VALUES (?, ?, ?)',
			[hiUserId, loUserId, channelId],
			{prepare: true},
		);

		// Insert private_channels for both users
		await cass.execute(
			'INSERT INTO private_channels (user_id, channel_id, is_gdm) VALUES (?, ?, ?)',
			[loUserId, channelId, false],
			{prepare: true},
		);
		await cass.execute(
			'INSERT INTO private_channels (user_id, channel_id, is_gdm) VALUES (?, ?, ?)',
			[hiUserId, channelId, false],
			{prepare: true},
		);

		progress.tick();
	}

	progress.done();
}
