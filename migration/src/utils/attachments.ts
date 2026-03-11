import {createHash} from 'node:crypto';
import {GetObjectCommand, PutObjectCommand, HeadObjectCommand} from '@aws-sdk/client-s3';
import sharp from 'sharp';
import {getS3} from '../connections.js';
import {config} from '../config.js';

interface OldAttachment {
	filename?: string;
	originalName?: string;
	size?: number;
	mimetype?: string;
	path?: string;
}

interface ProcessedAttachment {
	width: number | null;
	height: number | null;
	placeholder: string | null;
	content_hash: string | null;
	flags: number | null;
}

/**
 * Process an attachment: download from old S3 path, probe dimensions,
 * copy to new S3 path, return metadata.
 */
export async function processAttachment(
	att: OldAttachment,
	channelId: bigint,
	attachmentId: bigint,
	filename: string,
): Promise<ProcessedAttachment> {
	const s3 = getS3();
	if (!s3 || !att.path) {
		return {width: null, height: null, placeholder: null, content_hash: null, flags: null};
	}

	const oldKey = att.path;
	const newKey = `attachments/${channelId}/${attachmentId}/${filename}`;

	try {
		// Check if already copied (idempotent re-runs)
		try {
			await s3.send(new HeadObjectCommand({Bucket: config.s3.cdnBucket, Key: newKey}));
			// File exists at new path — just probe dimensions if image
			if (att.mimetype?.startsWith('image/')) {
				const obj = await s3.send(new GetObjectCommand({Bucket: config.s3.cdnBucket, Key: newKey}));
				const buffer = Buffer.from(await obj.Body!.transformToByteArray());
				return probeImage(buffer);
			}
			return {width: null, height: null, placeholder: null, content_hash: null, flags: null};
		} catch {
			// Not found — proceed with copy
		}

		// Download from old path
		const obj = await s3.send(
			new GetObjectCommand({Bucket: config.s3.sourceBucket, Key: oldKey}),
		);
		const buffer = Buffer.from(await obj.Body!.transformToByteArray());

		// Upload to new path
		await s3.send(
			new PutObjectCommand({
				Bucket: config.s3.cdnBucket,
				Key: newKey,
				Body: buffer,
				ContentType: att.mimetype ?? 'application/octet-stream',
			}),
		);

		// Probe image if applicable
		if (att.mimetype?.startsWith('image/')) {
			return probeImage(buffer);
		}

		const hash = createHash('sha256').update(buffer).digest('hex');
		return {width: null, height: null, placeholder: null, content_hash: hash, flags: null};
	} catch (err: any) {
		// Don't fail the whole migration — just skip this attachment's processing
		if (!processAttachment._warnedCount) processAttachment._warnedCount = 0;
		processAttachment._warnedCount++;
		if (processAttachment._warnedCount <= 10) {
			console.warn(`\n  WARN: Failed to process attachment ${oldKey}: ${err.message}`);
		}
		return {width: null, height: null, placeholder: null, content_hash: null, flags: null};
	}
}

processAttachment._warnedCount = 0;

/**
 * Re-upload an asset from old S3 key to new path structure.
 * New S3 key: {prefix}/{entityId}/{md5_8chars} (no extension).
 * Returns the hash for Cassandra (with a_ prefix for GIFs), or null on failure.
 */
export async function reuploadAsset(
	oldKey: string,
	prefix: string,
	entityId: bigint,
): Promise<string | null> {
	const s3 = getS3();
	if (!s3) return null;

	try {
		const obj = await s3.send(
			new GetObjectCommand({Bucket: config.s3.sourceBucket, Key: oldKey}),
		);
		const buffer = Buffer.from(await obj.Body!.transformToByteArray());
		return uploadAssetBuffer(buffer, obj.ContentType ?? 'image/png', prefix, entityId);
	} catch {
		return null;
	}
}

/**
 * Upload a buffer as an asset to S3.
 * S3 key: {prefix}/{entityId}/{md5_8chars} (no extension).
 * Returns the hash for Cassandra (with a_ prefix for GIFs), or null on failure.
 */
export async function uploadAssetBuffer(
	buffer: Buffer,
	mimeType: string,
	prefix: string,
	entityId: bigint,
): Promise<string | null> {
	const s3 = getS3();
	if (!s3) return null;

	try {
		const md5 = createHash('md5').update(buffer).digest('hex').slice(0, 8);
		const isAnimated = mimeType === 'image/gif';
		const storedHash = isAnimated ? `a_${md5}` : md5;
		const newKey = `${prefix}/${entityId}/${md5}`;

		// Idempotent: skip if already exists
		try {
			await s3.send(new HeadObjectCommand({Bucket: config.s3.cdnBucket, Key: newKey}));
			return storedHash;
		} catch {
			// not found, proceed with upload
		}

		await s3.send(
			new PutObjectCommand({
				Bucket: config.s3.cdnBucket,
				Key: newKey,
				Body: buffer,
				ContentType: mimeType,
			}),
		);
		return storedHash;
	} catch {
		return null;
	}
}

async function probeImage(buffer: Buffer): Promise<ProcessedAttachment> {
	const metadata = await sharp(buffer).metadata();
	const hash = createHash('sha256').update(buffer).digest('hex');

	let flags = 0;
	// Check if animated (GIF, APNG)
	if (metadata.format === 'gif' || (metadata.format === 'png' && (metadata.pages ?? 0) > 1)) {
		flags |= 1 << 5; // IS_ANIMATED
	}

	return {
		width: metadata.width ?? null,
		height: metadata.height ?? null,
		placeholder: null, // thumbhash generation could be added later
		content_hash: hash,
		flags: flags || null,
	};
}
