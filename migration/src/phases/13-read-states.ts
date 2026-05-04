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
import {createProgress} from '../utils/progress.js';
import {config} from '../config.js';

export async function migrateReadStates(mongo: Db, cass: cassandra.Client) {
	console.log('\n=== Phase 13: Read States ===');
	const collection = mongo.collection('channelreadstates');
	const total = await collection.countDocuments();
	console.log(`  Found ${total} read states in MongoDB`);

	if (config.dryRun) return;

	const cursor = collection.find();
	const progress = createProgress('ReadStates', total);

	for await (const doc of cursor) {
		const userIdHex = doc.userId?.toHexString?.() ?? doc.userId?.toString?.();
		const userId = userIdHex ? getId(userIdHex) : null;

		// channelId is stored as a string in the old format
		const channelIdStr: string = doc.channelId?.toString?.() ?? '';
		const channelId = channelIdStr ? getId(channelIdStr) : null;

		if (!userId || !channelId) {
			progress.tick();
			continue;
		}

		// We don't have a message_id for the last read message,
		// but we can set it to 0 and use last_pin_timestamp
		await cass.execute(
			`INSERT INTO read_states (
				user_id, channel_id, message_id, mention_count
			) VALUES (?, ?, ?, ?)`,
			[
				userId,
				channelId,
				0n, // no specific message id available
				0,
			],
			{prepare: true},
		);

		progress.tick();
	}

	progress.done();
}
