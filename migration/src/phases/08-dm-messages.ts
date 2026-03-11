import type {Db} from 'mongodb';
import type cassandra from 'cassandra-driver';
import {getId, mapId} from '../id-map.js';
import {snowflakeFromTimestamp, bucketFromSnowflake} from '../utils/snowflake.js';
import {getDmChannelId} from './07-dm-channels.js';
import {createProgress} from '../utils/progress.js';
import {processAttachment} from '../utils/attachments.js';
import {config} from '../config.js';
import {trackMessage} from '../utils/channel-state-tracker.js';

export async function migrateDmMessages(mongo: Db, cass: cassandra.Client) {
	console.log('\n=== Phase 8: DM Messages ===');
	const collection = mongo.collection('directmessages');
	const total = await collection.countDocuments();
	console.log(`  Migrating ${total} DM messages`);

	if (config.dryRun) return;

	const cursor = collection.find().sort({createdAt: 1});
	const progress = createProgress('DM Messages', total);

	for await (const doc of cursor) {
		const senderHex = doc.sender?.toHexString?.() ?? doc.sender?.toString?.();
		const receiverHex = doc.receiver?.toHexString?.() ?? doc.receiver?.toString?.();

		const senderId = senderHex ? getId(senderHex) : null;
		const receiverId = receiverHex ? getId(receiverHex) : null;

		if (!senderId || !receiverId) {
			progress.tick();
			continue;
		}

		const channelId = getDmChannelId(senderId, receiverId);
		if (!channelId) {
			progress.tick();
			continue;
		}

		const createdAt = doc.createdAt ? new Date(doc.createdAt) : doc._id.getTimestamp();
		const messageId = mapId(doc._id.toHexString(), createdAt);
		const bucket = bucketFromSnowflake(messageId);

		// Attachments
		const attachments = await buildDmAttachments(doc.attachments, createdAt, channelId);

		// Reply
		const messageReference = buildDmReply(doc.replyTo, channelId);
		const type = messageReference ? 19 : 0;

		// Edited
		const editedTimestamp = doc.edited && doc.editedAt ? new Date(doc.editedAt) : null;

		await cass.execute(
			`INSERT INTO messages (
				channel_id, bucket, message_id, author_id, type,
				content, edited_timestamp, flags,
				attachments, message_reference, version
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				channelId,
				bucket,
				messageId,
				senderId,
				type,
				doc.deleted ? null : (doc.content || null),
				editedTimestamp,
				doc.deleted ? 1 : 0, // flag 1 = deleted (content cleared)
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
			[senderId, channelId, messageId],
			{prepare: true},
		);

		progress.tick();
	}

	progress.done();
}

async function buildDmAttachments(
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

function buildDmReply(
	replyTo: {messageId?: string} | undefined,
	currentChannelId: bigint,
) {
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
