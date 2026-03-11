import type {Db} from 'mongodb';
import type cassandra from 'cassandra-driver';
import {mapId} from '../id-map.js';
import {createProgress} from '../utils/progress.js';
import {config} from '../config.js';
import {reuploadAsset} from '../utils/attachments.js';

export async function migrateUsers(mongo: Db, cass: cassandra.Client) {
	console.log('\n=== Phase 1: Users ===');
	const collection = mongo.collection('users');
	const total = await collection.countDocuments();
	console.log(`  Found ${total} users in MongoDB`);

	if (config.dryRun) return;

	const cursor = collection.find();
	const progress = createProgress('Users', total);

	for await (const doc of cursor) {
		const objectId = doc._id.toHexString();
		const createdAt = doc.createdAt ?? doc._id.getTimestamp();
		const snowflake = mapId(objectId, createdAt);

		const email: string = (doc.email ?? '').toLowerCase().trim();
		const username: string = doc.username ?? '';
		const flags = computeFlags(doc);
		const avatarHash = await processAvatar(doc.avatar, snowflake);

		// Insert into users table
		await cass.execute(
			`INSERT INTO users (
				user_id, username, global_name, bio, bot, system, email, email_verified,
				password_hash, avatar_hash, locale, flags,
				last_active_at, version
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				snowflake,
				username,
				doc.displayName || null,
				doc.aboutMe || null,
				false,
				false,
				email || null,
				doc.emailVerified ?? false,
				doc.password ?? null,
				avatarHash,
				'ru',
				flags,
				doc.createdAt ? new Date(doc.createdAt) : null,
				1, // version
			],
			{prepare: true},
		);

		// Insert default user_settings
		await cass.execute(
			`INSERT INTO user_settings (
				user_id, locale, theme, status,
				developer_mode, message_display_compact,
				animate_emoji, animate_stickers, gif_auto_play,
				render_embeds, render_reactions, render_spoilers,
				inline_attachment_media, inline_embed_media,
				explicit_content_filter, friend_source_flags,
				incoming_call_flags, group_dm_add_permission_flags,
				default_guilds_restricted, afk_timeout, time_format,
				version
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				snowflake,
				'ru',                // locale
				'dark',              // theme
				'online',            // status
				false,               // developer_mode
				false,               // message_display_compact
				true,                // animate_emoji
				0,                   // animate_stickers (ALWAYS_ANIMATE)
				true,                // gif_auto_play
				true,                // render_embeds
				true,                // render_reactions
				1,                   // render_spoilers (ON_CLICK)
				true,                // inline_attachment_media
				true,                // inline_embed_media
				2,                   // explicit_content_filter (FRIENDS_AND_NON_FRIENDS)
				7,                   // friend_source_flags (MUTUAL_FRIENDS | MUTUAL_GUILDS | NO_RELATION)
				0,                   // incoming_call_flags
				0,                   // group_dm_add_permission_flags
				false,               // default_guilds_restricted
				600,                 // afk_timeout
				0,                   // time_format
				1,                   // version
			],
			{prepare: true},
		);

		// Insert into users_by_email lookup
		if (email) {
			await cass.execute(
				'INSERT INTO users_by_email (email_lower, user_id) VALUES (?, ?)',
				[email, snowflake],
				{prepare: true},
			);
		}

		// Insert into users_by_username lookup
		if (username) {
			await cass.execute(
				'INSERT INTO users_by_username (username, user_id) VALUES (?, ?)',
				[username.toLowerCase(), snowflake],
				{prepare: true},
			);
		}

		progress.tick();
	}

	progress.done();
}

function computeFlags(doc: Record<string, unknown>): bigint {
	let flags = 0n;
	// Bit 0: STAFF
	if (doc.role === 'admin') flags |= 1n;
	// Bit 17: VERIFIED_EMAIL
	if (doc.emailVerified) flags |= 1n << 17n;
	// Bit 20: DISABLED
	if (doc.isDeleted) flags |= 1n << 20n;
	return flags;
}

async function processAvatar(avatar: string | null | undefined, userId: bigint): Promise<string | null> {
	if (!avatar) return null;

	// S3 key like "avatars/xxx.jpg"
	if (avatar.startsWith('avatars/')) {
		const hash = await reuploadAsset(avatar, 'avatars', userId);
		if (hash) return hash;
		// Fallback: extract old hash from path (won't work with media-proxy)
		const match = avatar.match(/avatars\/([^/.]+)/);
		return match ? match[1] : null;
	}

	// HTTP URL — can't migrate
	return null;
}
