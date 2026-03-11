import type cassandra from 'cassandra-driver';
import {getTrackedChannels} from '../utils/channel-state-tracker.js';
import {createProgress} from '../utils/progress.js';
import {config} from '../config.js';

export async function migrateChannelState(cass: cassandra.Client) {
	console.log('\n=== Phase 15: Channel State ===');

	const channels = getTrackedChannels();
	console.log(`  Writing state for ${channels.size} channels`);

	if (config.dryRun) return;

	const progress = createProgress('ChannelState', channels.size);

	for (const [channelId, info] of channels) {
		// Write channel_state
		await cass.execute(
			`INSERT INTO channel_state (
				channel_id, created_bucket, has_messages,
				last_message_id, last_message_bucket, updated_at
			) VALUES (?, ?, ?, ?, ?, ?)`,
			[
				channelId,
				info.createdBucket,
				true,
				info.lastMessageId,
				info.lastMessageBucket,
				new Date(),
			],
			{prepare: true},
		);

		// Update channels.last_message_id (used by REST API for DM list)
		await cass.execute(
			`UPDATE channels SET last_message_id = ? WHERE channel_id = ? AND soft_deleted = false`,
			[info.lastMessageId, channelId],
			{prepare: true},
		);

		// Write channel_message_buckets for each bucket
		for (const bucket of info.buckets) {
			await cass.execute(
				`INSERT INTO channel_message_buckets (channel_id, bucket, updated_at) VALUES (?, ?, ?)`,
				[channelId, bucket, new Date()],
				{prepare: true},
			);
		}

		progress.tick();
	}

	progress.done();
}
