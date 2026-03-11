import type {Db} from 'mongodb';
import type cassandra from 'cassandra-driver';
import {ObjectId} from 'mongodb';
import {getId} from '../id-map.js';
import {createProgress} from '../utils/progress.js';
import {config} from '../config.js';

export async function migrateMembers(mongo: Db, cass: cassandra.Client) {
	console.log('\n=== Phase 5: Members ===');

	// Source of truth is servers.members array, not the members collection.
	// The old backend uses servers.members to determine guild membership.
	// The members collection may have orphaned records.
	const servers = mongo.collection('servers');
	const members = mongo.collection('members');

	const serverDocs = await servers.find({}, {projection: {_id: 1, members: 1, ownerId: 1}}).toArray();

	// Count total members across all servers
	let total = 0;
	for (const server of serverDocs) {
		total += (server.members?.length ?? 0);
		// Owner is always a member even if not in the array
		if (server.ownerId) {
			const ownerStr = server.ownerId.toString();
			const inArray = (server.members || []).some((m: any) => m?.toString() === ownerStr);
			if (!inArray) total++;
		}
	}
	console.log(`  Found ${total} members across ${serverDocs.length} servers`);

	if (config.dryRun) return;

	const progress = createProgress('Members', total);

	for (const server of serverDocs) {
		const guildIdHex = server._id.toHexString();
		const guildId = getId(guildIdHex);
		if (!guildId) {
			const memberCount = (server.members?.length ?? 0) + (server.ownerId ? 1 : 0);
			for (let i = 0; i < memberCount; i++) progress.tick();
			continue;
		}

		// Collect all member user IDs (from array + owner)
		const memberUserIds = new Set<string>();
		for (const ref of server.members ?? []) {
			const hex = ref?.toHexString?.() ?? ref?.toString?.();
			if (hex) memberUserIds.add(hex);
		}
		if (server.ownerId) {
			memberUserIds.add(server.ownerId.toHexString?.() ?? server.ownerId.toString());
		}

		// Fetch member details from members collection for this guild
		const memberDocs = await members
			.find({guildId: server._id})
			.toArray();
		const memberDetailsMap = new Map<string, any>();
		for (const doc of memberDocs) {
			const uid = doc.userId?.toHexString?.() ?? doc.userId?.toString?.();
			if (uid) memberDetailsMap.set(uid, doc);
		}

		for (const userIdHex of memberUserIds) {
			const userId = getId(userIdHex);
			if (!userId) {
				progress.tick();
				continue;
			}

			// Get extra details from members collection (roles, nickname, etc.)
			const detail = memberDetailsMap.get(userIdHex);

			// Convert role IDs
			const roleIds: bigint[] = [];
			if (detail && Array.isArray(detail.roleIds)) {
				for (const roleRef of detail.roleIds) {
					const hex = roleRef?.toHexString?.() ?? roleRef?.toString?.();
					const roleId = hex ? getId(hex) : null;
					if (roleId) roleIds.push(roleId);
				}
			}

			const joinedAt = detail?.joinedAt
				? new Date(detail.joinedAt)
				: detail?._id?.getTimestamp?.() ?? new Date();

			await cass.execute(
				`INSERT INTO guild_members (
					guild_id, user_id, joined_at, nick, avatar_hash,
					deaf, mute, role_ids, version
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				[
					guildId,
					userId,
					joinedAt,
					detail?.nickname || null,
					null,
					detail?.isDeaf ?? false,
					detail?.isMuted ?? false,
					roleIds.length > 0 ? roleIds : null,
					1, // version
				],
				{prepare: true},
			);

			await cass.execute(
				'INSERT INTO guild_members_by_user_id (user_id, guild_id) VALUES (?, ?)',
				[userId, guildId],
				{prepare: true},
			);

			progress.tick();
		}
	}

	progress.done();
}
