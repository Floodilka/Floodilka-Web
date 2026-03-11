import type {Db} from 'mongodb';
import type cassandra from 'cassandra-driver';
import {getId} from '../id-map.js';
import {createProgress} from '../utils/progress.js';
import {config} from '../config.js';

// Relationship types matching new backend
const FRIEND = 1;
const BLOCKED = 2;
const INCOMING_REQUEST = 3;
const OUTGOING_REQUEST = 4;

export async function migrateRelationships(mongo: Db, cass: cassandra.Client) {
	console.log('\n=== Phase 9: Relationships ===');

	if (config.dryRun) return;

	// Part 1: Friend requests
	const frCollection = mongo.collection('friendrequests');
	const frTotal = await frCollection.countDocuments();
	console.log(`  Found ${frTotal} friend requests`);

	const frCursor = frCollection.find();
	const frProgress = createProgress('FriendRequests', frTotal);

	for await (const doc of frCursor) {
		const fromHex = doc.from?.toHexString?.() ?? doc.from?.toString?.();
		const toHex = doc.to?.toHexString?.() ?? doc.to?.toString?.();
		const fromId = fromHex ? getId(fromHex) : null;
		const toId = toHex ? getId(toHex) : null;

		if (!fromId || !toId) {
			frProgress.tick();
			continue;
		}

		const since = doc.createdAt ? new Date(doc.createdAt) : doc._id.getTimestamp();

		if (doc.status === 'accepted') {
			// Mutual friendship
			await insertRelationship(cass, fromId, toId, FRIEND, since);
			await insertRelationship(cass, toId, fromId, FRIEND, since);
		} else if (doc.status === 'pending') {
			await insertRelationship(cass, fromId, toId, OUTGOING_REQUEST, since);
			await insertRelationship(cass, toId, fromId, INCOMING_REQUEST, since);
		}
		// declined/cancelled → skip

		frProgress.tick();
	}
	frProgress.done();

	// Part 2: Blocked users from user documents
	const usersCollection = mongo.collection('users');
	const usersWithBlocks = await usersCollection.countDocuments({
		'blockedUsers.0': {$exists: true},
	});
	console.log(`  Found ${usersWithBlocks} users with blocked users`);

	const blockCursor = usersCollection.find({'blockedUsers.0': {$exists: true}});
	const blockProgress = createProgress('BlockedUsers', usersWithBlocks);
	let blockCount = 0;

	for await (const doc of blockCursor) {
		const sourceHex = doc._id.toHexString();
		const sourceId = getId(sourceHex);
		if (!sourceId) {
			blockProgress.tick();
			continue;
		}

		for (const blocked of doc.blockedUsers ?? []) {
			const targetHex = blocked.userId?.toHexString?.() ?? blocked.userId?.toString?.();
			const targetId = targetHex ? getId(targetHex) : null;
			if (!targetId) continue;

			const since = blocked.blockedAt ? new Date(blocked.blockedAt) : new Date();
			await insertRelationship(cass, sourceId, targetId, BLOCKED, since);
			blockCount++;
		}

		blockProgress.tick();
	}
	blockProgress.done();
	console.log(`  Total blocks migrated: ${blockCount}`);
}

async function insertRelationship(
	cass: cassandra.Client,
	sourceUserId: bigint,
	targetUserId: bigint,
	type: number,
	since: Date,
) {
	await cass.execute(
		`INSERT INTO relationships (source_user_id, target_user_id, type, since, version) VALUES (?, ?, ?, ?, ?)`,
		[sourceUserId, targetUserId, type, since, 1],
		{prepare: true},
	);
}
