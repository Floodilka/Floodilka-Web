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
