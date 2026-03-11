import type {Db} from 'mongodb';
import type cassandra from 'cassandra-driver';
import {mapId, getId} from '../id-map.js';
import {snowflakeFromTimestamp} from '../utils/snowflake.js';
import {createProgress} from '../utils/progress.js';
import {config} from '../config.js';

// Channel types
const GUILD_TEXT = 0;
const GUILD_VOICE = 2;
const GUILD_CATEGORY = 4;

// Channel type mapping: old text/voice → new GUILD_TEXT(0)/GUILD_VOICE(2)
const CHANNEL_TYPE_MAP: Record<string, number> = {
	text: GUILD_TEXT,
	voice: GUILD_VOICE,
};

export async function migrateChannels(mongo: Db, cass: cassandra.Client) {
	console.log('\n=== Phase 3: Channels ===');
	const collection = mongo.collection('channels');
	const total = await collection.countDocuments();
	console.log(`  Found ${total} channels in MongoDB`);

	if (config.dryRun) return;

	// Group channels by guild to create categories per guild
	const channelsByGuild = new Map<string, Array<any>>();
	const cursor = collection.find();

	for await (const doc of cursor) {
		const serverIdHex = doc.serverId?.toHexString?.() ?? doc.serverId?.toString?.();
		if (!serverIdHex) continue;
		let list = channelsByGuild.get(serverIdHex);
		if (!list) {
			list = [];
			channelsByGuild.set(serverIdHex, list);
		}
		list.push(doc);
	}

	// Count: original channels + 2 categories per guild that has channels
	const totalWithCategories = total + channelsByGuild.size * 2;
	const progress = createProgress('Channels', totalWithCategories);

	for (const [serverIdHex, channels] of channelsByGuild) {
		const guildId = getId(serverIdHex);
		if (!guildId) {
			for (const _ of channels) progress.tick();
			progress.tick(); // text category
			progress.tick(); // voice category
			continue;
		}

		// Use the guild's creation timestamp for the categories
		const earliestChannel = channels.reduce((earliest, ch) => {
			const ts = ch.createdAt ?? ch._id.getTimestamp();
			const ets = earliest.createdAt ?? earliest._id.getTimestamp();
			return new Date(ts) < new Date(ets) ? ch : earliest;
		}, channels[0]);
		const categoryTimestamp = earliestChannel.createdAt
			? new Date(earliestChannel.createdAt)
			: earliestChannel._id.getTimestamp();

		// Create "Текстовые каналы" category
		const textCategoryId = snowflakeFromTimestamp(categoryTimestamp);
		await insertCategory(cass, textCategoryId, guildId, 'Текстовые каналы', 0);
		await insertChannelByGuild(cass, guildId, textCategoryId);
		progress.tick();

		// Create "Голосовые каналы" category
		const voiceCategoryId = snowflakeFromTimestamp(new Date(categoryTimestamp.getTime() + 1));
		await insertCategory(cass, voiceCategoryId, guildId, 'Голосовые каналы', 1);
		await insertChannelByGuild(cass, guildId, voiceCategoryId);
		progress.tick();

		// Count text channels so voice positions start after them.
		// Frontend sorts channels flatly by position then by id for default selection.
		// Voice positions must be higher than text to ensure a text channel is picked first.
		const textCount = channels.filter(ch => (CHANNEL_TYPE_MAP[ch.type] ?? GUILD_TEXT) === GUILD_TEXT).length;

		let textPos = 0;
		let voicePos = textCount; // voice positions start after all text channels
		let firstTextChannelId: bigint | null = null;

		for (const doc of channels) {
			const objectId = doc._id.toHexString();
			const createdAt = doc.createdAt ?? doc._id.getTimestamp();
			const channelId = mapId(objectId, createdAt);
			const type = CHANNEL_TYPE_MAP[doc.type] ?? GUILD_TEXT;

			const parentId = type === GUILD_VOICE ? voiceCategoryId : textCategoryId;
			const position = type === GUILD_VOICE ? voicePos++ : textPos++;

			if (type === GUILD_TEXT && firstTextChannelId === null) {
				firstTextChannelId = channelId;
			}

			const permOverwrites = buildPermissionOverwrites(doc);

			const slowModeMap: Record<string, number> = {
				off: 0, '5': 5, '10': 10, '15': 15, '30': 30,
				'60': 60, '120': 120, '300': 300, '600': 600,
			};

			await cass.execute(
				`INSERT INTO channels (
					channel_id, soft_deleted, guild_id, type, name, topic,
					nsfw, rate_limit_per_user, bitrate, user_limit,
					position, parent_id, version
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				[
					channelId,
					false,
					guildId,
					type,
					doc.name ?? 'general',
					doc.topic || null,
					doc.nsfw ?? false,
					slowModeMap[doc.slowMode] ?? 0,
					type === GUILD_VOICE ? (doc.bitrate ?? 64000) : null,
					type === GUILD_VOICE ? (doc.userLimit ?? 0) : null,
					position,
					parentId,
					1, // version
				],
				{prepare: true},
			);

			// Write permission overwrites separately using CQL literal
			// because the cassandra-driver doesn't serialize Map<BigInt, UDT> correctly
			if (permOverwrites && permOverwrites.size > 0) {
				const entries = [...permOverwrites.entries()].map(
					([id, ow]) => `${id}: {type: ${ow.type}, allow_: ${ow.allow_}, deny_: ${ow.deny_}}`,
				);
				await cass.execute(
					`UPDATE channels SET permission_overwrites = {${entries.join(', ')}} WHERE channel_id = ${channelId} AND soft_deleted = false`,
				);
			}

			await insertChannelByGuild(cass, guildId, channelId);
			progress.tick();
		}

		// Set system_channel_id on the guild to the first text channel
		if (firstTextChannelId) {
			await cass.execute(
				'UPDATE guilds SET system_channel_id = ? WHERE guild_id = ?',
				[firstTextChannelId, guildId],
				{prepare: true},
			);
		}
	}

	progress.done();
}

async function insertCategory(
	cass: cassandra.Client,
	categoryId: bigint,
	guildId: bigint,
	name: string,
	position: number,
) {
	await cass.execute(
		`INSERT INTO channels (
			channel_id, soft_deleted, guild_id, type, name, topic,
			nsfw, rate_limit_per_user, bitrate, user_limit,
			permission_overwrites, position, parent_id, version
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			categoryId,
			false,
			guildId,
			GUILD_CATEGORY,
			name,
			null,
			false,
			0,
			null,
			null,
			null,
			position,
			null,
			1, // version
		],
		{prepare: true},
	);
}

async function insertChannelByGuild(cass: cassandra.Client, guildId: bigint, channelId: bigint) {
	await cass.execute(
		'INSERT INTO channels_by_guild_id (guild_id, channel_id) VALUES (?, ?)',
		[guildId, channelId],
		{prepare: true},
	);
}

function buildPermissionOverwrites(doc: Record<string, unknown>): Map<bigint, {type: number; allow_: bigint; deny_: bigint}> | null {
	const result = new Map<bigint, {type: number; allow_: bigint; deny_: bigint}>();

	// New format: rolePermissionOverwrites / memberPermissionOverwrites with {allow, deny} as BigInt strings
	const roleOverwrites = doc.rolePermissionOverwrites as Record<string, {allow?: string; deny?: string}> | undefined;
	if (roleOverwrites) {
		for (const [roleIdHex, overwrite] of Object.entries(roleOverwrites)) {
			const roleId = getId(roleIdHex);
			if (!roleId) {
				console.warn(`\n  WARN: Role overwrite references unknown role ${roleIdHex}, skipping`);
				continue;
			}
			result.set(roleId, {
				type: 0, // role
				allow_: BigInt(overwrite.allow ?? '0'),
				deny_: BigInt(overwrite.deny ?? '0'),
			});
		}
	}

	const memberOverwrites = doc.memberPermissionOverwrites as Record<string, {allow?: string; deny?: string}> | undefined;
	if (memberOverwrites) {
		for (const [memberIdHex, overwrite] of Object.entries(memberOverwrites)) {
			const memberId = getId(memberIdHex);
			if (!memberId) continue;
			result.set(memberId, {
				type: 1, // member
				allow_: BigInt(overwrite.allow ?? '0'),
				deny_: BigInt(overwrite.deny ?? '0'),
			});
		}
	}

	return result.size > 0 ? result : null;
}
