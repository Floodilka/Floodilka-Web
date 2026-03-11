import type {Db} from 'mongodb';
import type cassandra from 'cassandra-driver';
import {mapId, getId} from '../id-map.js';
import {createProgress} from '../utils/progress.js';
import {config} from '../config.js';

const BASE_GUILD_FEATURES = new Set([
	'ANIMATED_ICON',
	'ANIMATED_BANNER',
	'BANNER',
	'INVITE_SPLASH',
]);

export async function migrateGuilds(mongo: Db, cass: cassandra.Client) {
	console.log('\n=== Phase 2: Guilds ===');
	const collection = mongo.collection('servers');
	const total = await collection.countDocuments();
	console.log(`  Found ${total} servers in MongoDB`);

	if (config.dryRun) return;

	const cursor = collection.find();
	const progress = createProgress('Guilds', total);

	for await (const doc of cursor) {
		const objectId = doc._id.toHexString();
		const createdAt = doc.createdAt ?? doc._id.getTimestamp();
		const guildId = mapId(objectId, createdAt);

		const ownerIdHex = doc.ownerId?.toHexString?.() ?? doc.ownerId?.toString?.();
		const ownerId = ownerIdHex ? getId(ownerIdHex) : null;

		if (!ownerId) {
			console.warn(`\n  WARN: Guild ${doc.name} has unknown owner ${ownerIdHex}, skipping`);
			progress.tick();
			continue;
		}

		const memberCount = Array.isArray(doc.members) ? doc.members.length : 0;

		// Insert into guilds
		await cass.execute(
			`INSERT INTO guilds (
				guild_id, owner_id, name, icon_hash, member_count,
				verification_level, default_message_notifications,
				explicit_content_filter, mfa_level, nsfw_level,
				features, version
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				guildId,
				ownerId,
				doc.name ?? 'Unnamed Server',
				null, // icon_hash set in phase 14
				memberCount,
				0, // verification_level
				0, // default_message_notifications
				0, // explicit_content_filter
				0, // mfa_level
				0, // nsfw_level
				[...BASE_GUILD_FEATURES],
				1, // version
			],
			{prepare: true},
		);

		// Insert into guilds_by_owner_id
		await cass.execute(
			'INSERT INTO guilds_by_owner_id (owner_id, guild_id) VALUES (?, ?)',
			[ownerId, guildId],
			{prepare: true},
		);

		progress.tick();
	}

	progress.done();
}
