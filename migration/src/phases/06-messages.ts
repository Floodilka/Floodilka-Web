import type {Db} from 'mongodb';
import type cassandra from 'cassandra-driver';
import {getId, mapId} from '../id-map.js';
import {snowflakeFromTimestamp, bucketFromSnowflake} from '../utils/snowflake.js';
import {createProgress} from '../utils/progress.js';
import {processAttachment} from '../utils/attachments.js';
import {config} from '../config.js';
import {trackMessage} from '../utils/channel-state-tracker.js';

export async function migrateMessages(mongo: Db, cass: cassandra.Client) {
	console.log('\n=== Phase 6: Channel Messages ===');
	const collection = mongo.collection('messages');
	const total = await collection.countDocuments();
	console.log(`  Found ${total} messages in MongoDB`);

	if (config.dryRun) return;

	const cursor = collection.find().sort({createdAt: 1});
	const progress = createProgress('Messages', total);

	for await (const doc of cursor) {
		const createdAt = doc.createdAt ? new Date(doc.createdAt) : doc._id.getTimestamp();
		const messageId = mapId(doc._id.toHexString(), createdAt);
		const bucket = bucketFromSnowflake(messageId);

		// channelId in messages collection is stored as a string (ObjectId hex)
		const channelIdStr: string = doc.channelId?.toString?.() ?? '';
		const channelId = channelIdStr ? getId(channelIdStr) : null;

		if (!channelId) {
			progress.tick();
			continue;
		}

		// Author
		const authorIdHex = doc.userId?.toHexString?.() ?? doc.userId?.toString?.();
		const authorId = authorIdHex ? getId(authorIdHex) : null;

		if (!authorId) {
			progress.tick();
			continue;
		}

		// Mentions
		const mentionUsers = new Set<bigint>();
		let mentionEveryone = false;
		if (Array.isArray(doc.mentions)) {
			for (const m of doc.mentions) {
				if (m.type === 'everyone') {
					mentionEveryone = true;
				} else {
					const uid = m.userId?.toString?.();
					if (uid) {
						const mapped = getId(uid);
						if (mapped) mentionUsers.add(mapped);
					}
				}
			}
		}

		// Attachments
		const attachments = await buildAttachments(doc.attachments, createdAt, channelId);

		// Message reference (reply)
		const messageReference = buildMessageReference(doc.replyTo, channelId);

		// Pinned
		const pinned = doc.pinned ?? false;
		const pinnedTimestamp = pinned ? createdAt : null;

		// Type: 0 = DEFAULT, 19 = REPLY
		const type = messageReference ? 19 : 0;

		await cass.execute(
			`INSERT INTO messages (
				channel_id, bucket, message_id, author_id, type,
				content, edited_timestamp, pinned_timestamp,
				flags, mention_everyone, mention_users,
				attachments, message_reference, version
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				channelId,
				bucket,
				messageId,
				authorId,
				type,
				doc.content || null,
				doc.editedAt ? new Date(doc.editedAt) : null,
				pinnedTimestamp,
				0,
				mentionEveryone,
				mentionUsers.size > 0 ? [...mentionUsers] : null,
				attachments.length > 0 ? attachments : null,
				messageReference,
				1, // version
			],
			{prepare: true},
		);

		trackMessage(channelId, messageId, bucket);

		// Insert into messages_by_author_id
		await cass.execute(
			'INSERT INTO messages_by_author_id (author_id, channel_id, message_id) VALUES (?, ?, ?)',
			[authorId, channelId, messageId],
			{prepare: true},
		);

		// Insert pin record
		if (pinnedTimestamp) {
			await cass.execute(
				'INSERT INTO channel_pins (channel_id, message_id, pinned_timestamp) VALUES (?, ?, ?)',
				[channelId, messageId, pinnedTimestamp],
				{prepare: true},
			);
		}

		progress.tick();
	}

	progress.done();
}

async function buildAttachments(
	attachments: Array<{filename?: string; originalName?: string; size?: number; mimetype?: string; path?: string}> | undefined,
	messageCreatedAt: Date,
	channelId: bigint,
) {
	if (!Array.isArray(attachments) || attachments.length === 0) return [];

	const results = [];
	for (let i = 0; i < attachments.length; i++) {
		const att = attachments[i];
		const attId = snowflakeFromTimestamp(new Date(messageCreatedAt.getTime() + i));
		const filename = att.originalName ?? att.filename ?? 'file';

		const processed = await processAttachment(att, channelId, attId, filename);

		results.push({
			attachment_id: attId,
			filename,
			size: BigInt(att.size ?? 0),
			content_type: att.mimetype ?? null,
			content_hash: processed.content_hash ?? att.path ?? null,
			title: null,
			description: null,
			width: processed.width,
			height: processed.height,
			duration: null,
			placeholder: processed.placeholder,
			flags: processed.flags,
			nsfw: null,
		});
	}
	return results;
}

function buildMessageReference(
	replyTo: {messageId?: string; channelId?: string} | undefined,
	currentChannelId: bigint,
): {channel_id: bigint; message_id: bigint | null; guild_id: bigint | null; type: number} | null {
	if (!replyTo?.messageId) return null;

	const refMessageId = getId(replyTo.messageId);
	if (!refMessageId) return null;

	return {
		channel_id: currentChannelId,
		message_id: refMessageId,
		guild_id: null,
		type: 0,
	};
}
