import type {Db} from 'mongodb';
import type cassandra from 'cassandra-driver';
import {getId} from '../id-map.js';
import {getS3} from '../connections.js';
import {createProgress} from '../utils/progress.js';
import {config} from '../config.js';
import {reuploadAsset, uploadAssetBuffer} from '../utils/attachments.js';

export async function migrateIcons(mongo: Db, cass: cassandra.Client) {
	console.log('\n=== Phase 14: Server Icons ===');
	const collection = mongo.collection('servers');

	const withBase64 = await collection.countDocuments({icon: {$regex: '^data:'}});
	const withS3Key = await collection.countDocuments({
		icon: {$nin: [null, ''], $not: {$regex: '^data:'}},
	});
	const withoutIcon = await collection.countDocuments({
		$or: [{icon: null}, {icon: ''}, {icon: {$exists: false}}],
	});

	console.log(`  Icons: ${withBase64} base64, ${withS3Key} S3 keys, ${withoutIcon} none`);

	if (config.dryRun) return;

	const s3 = getS3();

	// Process servers with S3 keys — re-upload to icons/{guildId}/{md5}
	const s3Cursor = collection.find({
		icon: {$nin: [null, ''], $not: {$regex: '^data:'}},
	});
	const s3Progress = createProgress('S3 Icons', withS3Key);

	for await (const doc of s3Cursor) {
		const guildId = getId(doc._id.toHexString());
		if (!guildId) {
			s3Progress.tick();
			continue;
		}

		const icon: string = doc.icon;
		if (!icon || icon.startsWith('data:')) {
			s3Progress.tick();
			continue;
		}

		if (s3) {
			// Re-upload from old path to icons/{guildId}/{md5_8chars}
			const hash = await reuploadAsset(icon, 'icons', guildId);
			if (hash) {
				await cass.execute(
					'UPDATE guilds SET icon_hash = ? WHERE guild_id = ?',
					[hash, guildId],
					{prepare: true},
				);
				s3Progress.tick();
				continue;
			}
		}

		// Fallback: extract hash from path (won't match media-proxy format)
		const match = icon.match(/([a-f0-9]+)\.\w+$/i);
		if (match) {
			await cass.execute(
				'UPDATE guilds SET icon_hash = ? WHERE guild_id = ?',
				[match[1], guildId],
				{prepare: true},
			);
		}

		s3Progress.tick();
	}
	s3Progress.done();

	// Process servers with base64 icons — decode → upload to icons/{guildId}/{md5}
	if (!s3) {
		console.log('  Skipping base64 icon upload (no S3 credentials)');
		return;
	}

	const b64Cursor = collection.find({icon: {$regex: '^data:'}});
	const b64Progress = createProgress('Base64 Icons', withBase64);

	for await (const doc of b64Cursor) {
		const guildId = getId(doc._id.toHexString());
		if (!guildId) {
			b64Progress.tick();
			continue;
		}

		const icon: string = doc.icon;
		const dataUriMatch = icon.match(/^data:([^;]+);base64,(.+)$/);
		if (!dataUriMatch) {
			console.warn(`\n  WARN: Invalid data URI for guild ${guildId}`);
			b64Progress.tick();
			continue;
		}

		const mimeType = dataUriMatch[1];
		const buffer = Buffer.from(dataUriMatch[2], 'base64');
		const hash = await uploadAssetBuffer(buffer, mimeType, 'icons', guildId);

		if (hash) {
			await cass.execute(
				'UPDATE guilds SET icon_hash = ? WHERE guild_id = ?',
				[hash, guildId],
				{prepare: true},
			);
		}

		b64Progress.tick();
	}
	b64Progress.done();
}
