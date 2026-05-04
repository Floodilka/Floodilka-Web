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

export async function migrateInvites(mongo: Db, cass: cassandra.Client) {
	console.log('\n=== Phase 10: Invites ===');
	const collection = mongo.collection('invites');
	const total = await collection.countDocuments();
	console.log(`  Found ${total} invites in MongoDB`);

	if (config.dryRun) return;

	const cursor = collection.find();
	const progress = createProgress('Invites', total);

	for await (const doc of cursor) {
		const code: string = doc.code;
		if (!code) {
			progress.tick();
			continue;
		}

		const serverIdHex = doc.serverId?.toHexString?.() ?? doc.serverId?.toString?.();
		const guildId = serverIdHex ? getId(serverIdHex) : null;

		if (!guildId) {
			progress.tick();
			continue;
		}

		const createdByHex = doc.createdBy?.toHexString?.() ?? doc.createdBy?.toString?.();
		const inviterId = createdByHex ? getId(createdByHex) : null;

		const createdAt = doc.createdAt ? new Date(doc.createdAt) : doc._id.getTimestamp();

		// Calculate max_age from expiresAt
		let maxAge = 0; // 0 = never expires
		if (doc.expiresAt) {
			const expiresAt = new Date(doc.expiresAt).getTime();
			const created = createdAt.getTime();
			maxAge = Math.max(0, Math.floor((expiresAt - created) / 1000));
		}

		// We don't have channelId in old invites, so we need to find first text channel of guild
		// For now we'll set channelId to null and fix in a post-migration step if needed
		const channelId: bigint | null = null;

		await cass.execute(
			`INSERT INTO invites (
				code, type, guild_id, channel_id, inviter_id,
				created_at, uses, max_uses, max_age, temporary,
				version
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				code,
				0, // type 0 = guild invite
				guildId,
				channelId,
				inviterId,
				createdAt,
				doc.uses ?? 0,
				doc.maxUses ?? 0,
				maxAge,
				false,
				1, // version
			],
			{prepare: true},
		);

		// Insert into invites_by_guild_id
		await cass.execute(
			'INSERT INTO invites_by_guild_id (guild_id, code) VALUES (?, ?)',
			[guildId, code],
			{prepare: true},
		);

		// Insert into invites_by_channel_id if we have one
		if (channelId) {
			await cass.execute(
				'INSERT INTO invites_by_channel_id (channel_id, code) VALUES (?, ?)',
				[channelId, code],
				{prepare: true},
			);
		}

		progress.tick();
	}

	progress.done();
}
