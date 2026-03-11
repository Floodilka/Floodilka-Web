import type {Db} from 'mongodb';
import type cassandra from 'cassandra-driver';
import {mapId, getId, setId} from '../id-map.js';
import {convertPermissions} from '../utils/permissions.js';
import {createProgress} from '../utils/progress.js';
import {config} from '../config.js';

export async function migrateRoles(mongo: Db, cass: cassandra.Client) {
	console.log('\n=== Phase 4: Roles ===');
	const collection = mongo.collection('roles');
	const total = await collection.countDocuments();
	console.log(`  Found ${total} roles in MongoDB`);

	if (config.dryRun) return;

	const cursor = collection.find();
	const progress = createProgress('Roles', total);

	for await (const doc of cursor) {
		const objectId = doc._id.toHexString();
		const createdAt = doc.createdAt ?? doc._id.getTimestamp();

		const guildIdHex = doc.guildId?.toHexString?.() ?? doc.guildId?.toString?.();
		const guildId = guildIdHex ? getId(guildIdHex) : null;

		if (!guildId) {
			console.warn(`\n  WARN: Role ${doc.name} has unknown guild ${guildIdHex}, skipping`);
			progress.tick();
			continue;
		}

		// @everyone role must have role_id == guild_id (gateway permission check requirement)
		const isEveryone = doc.isSystem === true || doc.name === '@everyone';
		const roleId = isEveryone ? guildId : mapId(objectId, createdAt);
		// Register @everyone role ObjectId → guildId so channel permission overwrites can find it
		if (isEveryone) setId(objectId, guildId);

		const permissions = convertPermissions(doc.permissions);

		// Parse color: "#FF0000" → int, or null
		let color = 0;
		if (doc.color && typeof doc.color === 'string' && doc.color.startsWith('#')) {
			color = parseInt(doc.color.slice(1), 16) || 0;
		} else if (typeof doc.color === 'number') {
			color = doc.color;
		}

		const isHoisted = doc.isHoisted ?? false;

		await cass.execute(
			`INSERT INTO guild_roles (
				guild_id, role_id, name, permissions, position,
				hoist_position, color, hoist, mentionable, version
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				guildId,
				roleId,
				doc.name ?? 'Role',
				permissions,
				doc.position ?? 0,
				isHoisted ? (doc.position ?? 0) : null,
				color,
				isHoisted,
				doc.isMentionable ?? false,
				1, // version
			],
			{prepare: true},
		);

		progress.tick();
	}

	progress.done();
}
