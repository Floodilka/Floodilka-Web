/*
 * Copyright (C) 2026 Floodilka Contributors
 *
 * This file is part of Floodilka.
 *
 * Floodilka is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Floodilka is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Floodilka. If not, see <https://www.gnu.org/licenses/>.
 */

import crypto from 'node:crypto';
import sharp from 'sharp';
import {Config} from '~/Config';
import {AVATAR_EXTENSIONS, AVATAR_MAX_SIZE} from '~/Constants';
import {InputValidationError} from '~/Errors';
import {Logger} from '~/Logger';
import {transcodeToNameplateWebM} from '~/utils/FfmpegUtils';
import type {IAssetDeletionQueue} from './IAssetDeletionQueue';
import type {IMediaService} from './IMediaService';
import type {IStorageService} from './IStorageService';

export type BannerEntityType = 'user' | 'guild' | 'guild_member';

export interface BannerUploadOptions {
	entityType: BannerEntityType;
	entityId: bigint;
	guildId?: bigint;
	base64Image: string | null;
	previousHash: string | null;
	errorPath: string;
}

export interface PreparedBannerUpload {
	newHash: string | null;
	previousHash: string | null;
	isAnimated: boolean;
	newKeys: Array<string>;
	previousKeys: Array<string>;
	newCdnUrls: Array<string>;
	previousCdnUrls: Array<string>;
	height: number | null;
	width: number | null;
	imageBuffer: Uint8Array | null;
	_uploaded: boolean;
}

const NEW_STATIC_HASH_PREFIX = 's_';
const NEW_ANIMATED_HASH_PREFIX = 'v_';

const BANNER_STATIC_QUALITY = 82;
const BANNER_STATIC_EFFORT = 4;
const BANNER_ANIMATED_MAX_DURATION_SECONDS = 6;

const BANNER_MAX_STATIC_BYTES = 1 * 1024 * 1024;
const BANNER_MAX_WEBM_BYTES = 2 * 1024 * 1024;

interface BannerTargetConfig {
	width: number;
	height: number;
	animatedBitrateKbps: number;
}

const BANNER_TARGETS: Record<BannerEntityType, BannerTargetConfig> = {
	user: {width: 1530, height: 540, animatedBitrateKbps: 800},
	guild_member: {width: 1530, height: 540, animatedBitrateKbps: 800},
	guild: {width: 1920, height: 1080, animatedBitrateKbps: 1200},
};

export class BannerAssetProcessor {
	constructor(
		private readonly storageService: IStorageService,
		private readonly mediaService: IMediaService,
		private readonly assetDeletionQueue: IAssetDeletionQueue,
	) {}

	async processUpload(options: BannerUploadOptions): Promise<PreparedBannerUpload> {
		const {entityType, entityId, guildId, base64Image, previousHash, errorPath} = options;

		const previousKeys = this.keysForHash(entityType, entityId, previousHash, guildId);
		const previousCdnUrls = this.cdnUrlsForHash(entityType, entityId, previousHash, guildId);

		if (!base64Image) {
			return {
				newHash: null,
				previousHash,
				isAnimated: false,
				newKeys: [],
				previousKeys,
				newCdnUrls: [],
				previousCdnUrls,
				height: null,
				width: null,
				imageBuffer: null,
				_uploaded: false,
			};
		}

		const base64Data = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;

		let inputBuffer: Uint8Array;
		try {
			inputBuffer = new Uint8Array(Buffer.from(base64Data, 'base64'));
		} catch {
			throw InputValidationError.create(errorPath, 'Некорректные данные изображения');
		}

		if (inputBuffer.length > AVATAR_MAX_SIZE) {
			throw InputValidationError.create(
				errorPath,
				`Размер файла превышает ${Math.floor(AVATAR_MAX_SIZE / 1024 / 1024)}MB`,
			);
		}

		const metadata = await this.mediaService.getMetadata({
			type: 'base64',
			base64: base64Data,
			isNSFWAllowed: false,
		});

		if (metadata == null || !AVATAR_EXTENSIONS.has(metadata.format)) {
			throw InputValidationError.create(
				errorPath,
				`Неподдерживаемый формат изображения. Допустимые расширения: ${[...AVATAR_EXTENSIONS].join(', ')}`,
			);
		}

		const isAnimated = metadata.animated === true || metadata.format === 'gif';
		const target = BANNER_TARGETS[entityType];

		if (isAnimated) {
			return await this.processAnimated({
				entityType,
				entityId,
				guildId,
				inputBuffer,
				target,
				previousHash,
				previousKeys,
				previousCdnUrls,
				errorPath,
			});
		}

		return await this.processStatic({
			entityType,
			entityId,
			guildId,
			inputBuffer,
			target,
			previousHash,
			previousKeys,
			previousCdnUrls,
			errorPath,
		});
	}

	async commit(prepared: PreparedBannerUpload): Promise<void> {
		if (!prepared.previousHash || prepared.previousKeys.length === 0) {
			return;
		}

		if (prepared.newHash === prepared.previousHash) {
			return;
		}

		for (let i = 0; i < prepared.previousKeys.length; i++) {
			const s3Key = prepared.previousKeys[i];
			const cdnUrl = prepared.previousCdnUrls[i] ?? null;
			try {
				await this.assetDeletionQueue.queueDeletion({s3Key, cdnUrl, reason: 'banner_replaced'});
			} catch (error) {
				Logger.error({error, s3Key}, 'Failed to queue banner deletion');
			}
		}
	}

	async rollback(prepared: PreparedBannerUpload): Promise<void> {
		if (!prepared._uploaded) {
			return;
		}
		for (const s3Key of prepared.newKeys) {
			try {
				await this.storageService.deleteObject(Config.s3.buckets.cdn, s3Key);
				Logger.info({s3Key}, 'Rolled back banner asset upload');
			} catch (error) {
				Logger.error({error, s3Key}, 'Failed to rollback banner asset upload');
			}
		}
	}

	private async processStatic(params: {
		entityType: BannerEntityType;
		entityId: bigint;
		guildId?: bigint;
		inputBuffer: Uint8Array;
		target: BannerTargetConfig;
		previousHash: string | null;
		previousKeys: Array<string>;
		previousCdnUrls: Array<string>;
		errorPath: string;
	}): Promise<PreparedBannerUpload> {
		const {entityType, entityId, guildId, inputBuffer, target, previousHash, previousKeys, previousCdnUrls, errorPath} =
			params;

		let webpBuffer: Buffer;
		try {
			webpBuffer = await sharp(Buffer.from(inputBuffer))
				.resize(target.width, target.height, {fit: 'cover', position: 'center'})
				.webp({quality: BANNER_STATIC_QUALITY, effort: BANNER_STATIC_EFFORT})
				.toBuffer();
		} catch (error) {
			Logger.error({error, entityType}, 'Banner static encode failed');
			throw InputValidationError.create(errorPath, 'Не удалось обработать изображение');
		}

		if (webpBuffer.length > BANNER_MAX_STATIC_BYTES) {
			throw InputValidationError.create(
				errorPath,
				`Слишком большое изображение после обработки (${Math.ceil(webpBuffer.length / 1024)}KB)`,
			);
		}

		const shortHash = crypto.createHash('md5').update(webpBuffer).digest('hex').slice(0, 8);
		const newHash = `${NEW_STATIC_HASH_PREFIX}${shortHash}`;
		const imageBuffer = new Uint8Array(webpBuffer);

		if (newHash === previousHash) {
			return {
				newHash,
				previousHash,
				isAnimated: false,
				newKeys: [],
				previousKeys,
				newCdnUrls: [],
				previousCdnUrls,
				height: target.height,
				width: target.width,
				imageBuffer,
				_uploaded: false,
			};
		}

		const s3Key = this.staticKey(entityType, entityId, shortHash, guildId);
		const cdnUrl = this.staticCdnUrl(entityType, entityId, newHash, guildId);

		await this.storageService.uploadObject({
			bucket: Config.s3.buckets.cdn,
			key: s3Key,
			body: imageBuffer,
			contentType: 'image/webp',
		});

		return {
			newHash,
			previousHash,
			isAnimated: false,
			newKeys: [s3Key],
			previousKeys,
			newCdnUrls: [cdnUrl],
			previousCdnUrls,
			height: target.height,
			width: target.width,
			imageBuffer,
			_uploaded: true,
		};
	}

	private async processAnimated(params: {
		entityType: BannerEntityType;
		entityId: bigint;
		guildId?: bigint;
		inputBuffer: Uint8Array;
		target: BannerTargetConfig;
		previousHash: string | null;
		previousKeys: Array<string>;
		previousCdnUrls: Array<string>;
		errorPath: string;
	}): Promise<PreparedBannerUpload> {
		const {entityType, entityId, guildId, inputBuffer, target, previousHash, previousKeys, previousCdnUrls, errorPath} =
			params;

		let result;
		try {
			result = await transcodeToNameplateWebM({
				input: inputBuffer,
				targetWidth: target.width,
				targetHeight: target.height,
				maxDurationSeconds: BANNER_ANIMATED_MAX_DURATION_SECONDS,
				targetBitrateKbps: target.animatedBitrateKbps,
			});
		} catch (error) {
			Logger.error({error, entityType}, 'Banner animated transcode failed');
			throw InputValidationError.create(errorPath, 'Не удалось обработать анимацию');
		}

		if (result.webm.length > BANNER_MAX_WEBM_BYTES) {
			throw InputValidationError.create(
				errorPath,
				`Анимация слишком большая после сжатия (${Math.ceil(result.webm.length / 1024)}KB)`,
			);
		}

		const shortHash = crypto.createHash('md5').update(Buffer.from(result.webm)).digest('hex').slice(0, 8);
		const newHash = `${NEW_ANIMATED_HASH_PREFIX}${shortHash}`;

		if (newHash === previousHash) {
			return {
				newHash,
				previousHash,
				isAnimated: true,
				newKeys: [],
				previousKeys,
				newCdnUrls: [],
				previousCdnUrls,
				height: target.height,
				width: target.width,
				imageBuffer: result.poster,
				_uploaded: false,
			};
		}

		const webmKey = this.webmKey(entityType, entityId, shortHash, guildId);
		const posterKey = this.posterKey(entityType, entityId, shortHash, guildId);
		const webmCdn = this.webmCdnUrl(entityType, entityId, newHash, guildId);
		const posterCdn = this.posterCdnUrl(entityType, entityId, newHash, guildId);

		await Promise.all([
			this.storageService.uploadObject({
				bucket: Config.s3.buckets.cdn,
				key: webmKey,
				body: result.webm,
				contentType: 'video/webm',
			}),
			this.storageService.uploadObject({
				bucket: Config.s3.buckets.cdn,
				key: posterKey,
				body: result.poster,
				contentType: 'image/png',
			}),
		]);

		return {
			newHash,
			previousHash,
			isAnimated: true,
			newKeys: [webmKey, posterKey],
			previousKeys,
			newCdnUrls: [webmCdn, posterCdn],
			previousCdnUrls,
			height: target.height,
			width: target.width,
			imageBuffer: result.poster,
			_uploaded: true,
		};
	}

	private keysForHash(
		entityType: BannerEntityType,
		entityId: bigint,
		hash: string | null,
		guildId?: bigint,
	): Array<string> {
		if (!hash) return [];

		if (hash.startsWith(NEW_ANIMATED_HASH_PREFIX)) {
			const shortHash = hash.slice(NEW_ANIMATED_HASH_PREFIX.length);
			return [
				this.webmKey(entityType, entityId, shortHash, guildId),
				this.posterKey(entityType, entityId, shortHash, guildId),
			];
		}

		if (hash.startsWith(NEW_STATIC_HASH_PREFIX)) {
			const shortHash = hash.slice(NEW_STATIC_HASH_PREFIX.length);
			return [this.staticKey(entityType, entityId, shortHash, guildId)];
		}

		return [this.legacyKey(entityType, entityId, this.stripLegacyPrefix(hash), guildId)];
	}

	private cdnUrlsForHash(
		entityType: BannerEntityType,
		entityId: bigint,
		hash: string | null,
		guildId?: bigint,
	): Array<string> {
		if (!hash) return [];

		if (hash.startsWith(NEW_ANIMATED_HASH_PREFIX)) {
			return [
				this.webmCdnUrl(entityType, entityId, hash, guildId),
				this.posterCdnUrl(entityType, entityId, hash, guildId),
			];
		}

		if (hash.startsWith(NEW_STATIC_HASH_PREFIX)) {
			return [this.staticCdnUrl(entityType, entityId, hash, guildId)];
		}

		return [this.legacyCdnUrl(entityType, entityId, hash, guildId)];
	}

	private stripLegacyPrefix(hash: string): string {
		return hash.startsWith('a_') ? hash.slice(2) : hash;
	}

	private s3KeyBase(entityType: BannerEntityType, entityId: bigint, guildId?: bigint): string {
		if (entityType === 'guild_member') {
			if (!guildId) {
				throw new Error('guildId is required for guild_member banners');
			}
			return `guilds/${guildId}/users/${entityId}/banners`;
		}
		return `banners/${entityId}`;
	}

	private cdnUrlBase(entityType: BannerEntityType, entityId: bigint, guildId?: bigint): string {
		if (entityType === 'guild_member') {
			if (!guildId) {
				throw new Error('guildId is required for guild_member banners');
			}
			return `${Config.endpoints.media}/guilds/${guildId}/users/${entityId}/bnnrs`;
		}
		return `${Config.endpoints.media}/bnnrs/${entityId}`;
	}

	private staticKey(entityType: BannerEntityType, entityId: bigint, shortHash: string, guildId?: bigint): string {
		return `${this.s3KeyBase(entityType, entityId, guildId)}/${shortHash}.webp`;
	}

	private webmKey(entityType: BannerEntityType, entityId: bigint, shortHash: string, guildId?: bigint): string {
		return `${this.s3KeyBase(entityType, entityId, guildId)}/${shortHash}.webm`;
	}

	private posterKey(entityType: BannerEntityType, entityId: bigint, shortHash: string, guildId?: bigint): string {
		return `${this.s3KeyBase(entityType, entityId, guildId)}/${shortHash}.png`;
	}

	private legacyKey(entityType: BannerEntityType, entityId: bigint, shortHash: string, guildId?: bigint): string {
		return `${this.s3KeyBase(entityType, entityId, guildId)}/${shortHash}`;
	}

	private staticCdnUrl(entityType: BannerEntityType, entityId: bigint, hash: string, guildId?: bigint): string {
		return `${this.cdnUrlBase(entityType, entityId, guildId)}/${hash}.webp`;
	}

	private webmCdnUrl(entityType: BannerEntityType, entityId: bigint, hash: string, guildId?: bigint): string {
		return `${this.cdnUrlBase(entityType, entityId, guildId)}/${hash}.webm`;
	}

	private posterCdnUrl(entityType: BannerEntityType, entityId: bigint, hash: string, guildId?: bigint): string {
		return `${this.cdnUrlBase(entityType, entityId, guildId)}/${hash}.png`;
	}

	private legacyCdnUrl(entityType: BannerEntityType, entityId: bigint, hash: string, guildId?: bigint): string {
		return `${this.cdnUrlBase(entityType, entityId, guildId)}/${hash}`;
	}
}
