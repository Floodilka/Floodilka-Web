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
import {InputValidationError} from '~/Errors';
import {Logger} from '~/Logger';
import {transcodeToNameplateWebM} from '~/utils/FfmpegUtils';
import type {IAssetDeletionQueue} from './IAssetDeletionQueue';
import type {IMediaService} from './IMediaService';
import type {IStorageService} from './IStorageService';

const NAMEPLATE_TARGET_WIDTH = 1000;
const NAMEPLATE_TARGET_HEIGHT = 200;
const NAMEPLATE_MAX_DURATION_SECONDS = 6;
const NAMEPLATE_WEBM_BITRATE_KBPS = 400;
const NAMEPLATE_MAX_INPUT_BYTES = 8 * 1024 * 1024;
const NAMEPLATE_MAX_WEBM_BYTES = 1.5 * 1024 * 1024;
const NAMEPLATE_MAX_STATIC_BYTES = 512 * 1024;

const STATIC_FORMATS = new Set(['jpeg', 'jpg', 'png', 'webp']);
const VIDEO_FORMATS = new Set(['webm', 'mp4', 'mov', 'quicktime', 'm4v', 'matroska,webm']);

export interface PreparedNameplateUpload {
	newHash: string | null;
	previousHash: string | null;
	newKeys: Array<string>;
	previousKeys: Array<string>;
	newCdnUrls: Array<string>;
	previousCdnUrls: Array<string>;
	_uploaded: boolean;
}

export interface NameplateUploadOptions {
	userId: bigint;
	base64Image: string | null;
	previousHash: string | null;
}

export class NameplateAssetProcessor {
	constructor(
		private readonly storageService: IStorageService,
		private readonly mediaService: IMediaService,
		private readonly assetDeletionQueue: IAssetDeletionQueue,
	) {}

	async processUpload(options: NameplateUploadOptions): Promise<PreparedNameplateUpload> {
		const {userId, base64Image, previousHash} = options;

		const previousKeys = this.keysForHash(userId, previousHash);
		const previousCdnUrls = this.cdnUrlsForHash(userId, previousHash);

		if (!base64Image) {
			return {
				newHash: null,
				previousHash,
				newKeys: [],
				previousKeys,
				newCdnUrls: [],
				previousCdnUrls,
				_uploaded: false,
			};
		}

		const base64Data = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;

		let inputBuffer: Uint8Array;
		try {
			inputBuffer = new Uint8Array(Buffer.from(base64Data, 'base64'));
		} catch {
			throw InputValidationError.create('nameplate', 'Некорректные данные изображения');
		}

		if (inputBuffer.length > NAMEPLATE_MAX_INPUT_BYTES) {
			throw InputValidationError.create(
				'nameplate',
				`Размер файла превышает ${Math.floor(NAMEPLATE_MAX_INPUT_BYTES / 1024 / 1024)}MB`,
			);
		}

		const metadata = await this.mediaService.getMetadata({
			type: 'base64',
			base64: base64Data,
			isNSFWAllowed: false,
		});

		if (!metadata) {
			throw InputValidationError.create('nameplate', 'Не удалось определить формат файла');
		}

		const format = metadata.format.toLowerCase();
		const isAnimatedByMetadata = metadata.animated === true || format === 'gif';
		const isVideoFormat = VIDEO_FORMATS.has(format);
		const isStaticImage = STATIC_FORMATS.has(format) && !isAnimatedByMetadata;
		const isAnimatedInput = isVideoFormat || isAnimatedByMetadata;

		if (!isStaticImage && !isAnimatedInput) {
			throw InputValidationError.create(
				'nameplate',
				'Неподдерживаемый формат. Разрешены: JPEG, PNG, WebP, GIF, WebM, MP4',
			);
		}

		if (isAnimatedInput) {
			return await this.processAnimated({userId, inputBuffer, previousHash, previousKeys, previousCdnUrls});
		}

		return await this.processStatic({userId, inputBuffer, previousHash, previousKeys, previousCdnUrls});
	}

	async commit(prepared: PreparedNameplateUpload): Promise<void> {
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
				await this.assetDeletionQueue.queueDeletion({s3Key, cdnUrl, reason: 'nameplate_replaced'});
			} catch (error) {
				Logger.error({error, s3Key}, 'Failed to queue nameplate deletion');
			}
		}
	}

	async rollback(prepared: PreparedNameplateUpload): Promise<void> {
		if (!prepared._uploaded) {
			return;
		}
		for (const s3Key of prepared.newKeys) {
			try {
				await this.storageService.deleteObject(Config.s3.buckets.cdn, s3Key);
				Logger.info({s3Key}, 'Rolled back nameplate asset upload');
			} catch (error) {
				Logger.error({error, s3Key}, 'Failed to rollback nameplate asset upload');
			}
		}
	}

	private async processStatic(params: {
		userId: bigint;
		inputBuffer: Uint8Array;
		previousHash: string | null;
		previousKeys: Array<string>;
		previousCdnUrls: Array<string>;
	}): Promise<PreparedNameplateUpload> {
		const {userId, inputBuffer, previousHash, previousKeys, previousCdnUrls} = params;

		let webpBuffer: Buffer;
		try {
			webpBuffer = await sharp(Buffer.from(inputBuffer))
				.resize(NAMEPLATE_TARGET_WIDTH, NAMEPLATE_TARGET_HEIGHT, {
					fit: 'cover',
					position: 'center',
				})
				.webp({quality: 82, effort: 4})
				.toBuffer();
		} catch (error) {
			Logger.error({error}, 'Nameplate static encode failed');
			throw InputValidationError.create('nameplate', 'Не удалось обработать изображение');
		}

		if (webpBuffer.length > NAMEPLATE_MAX_STATIC_BYTES) {
			throw InputValidationError.create(
				'nameplate',
				`Слишком большое изображение после обработки (${Math.ceil(webpBuffer.length / 1024)}KB)`,
			);
		}

		const shortHash = crypto.createHash('md5').update(webpBuffer).digest('hex').slice(0, 8);

		if (shortHash === previousHash) {
			return {
				newHash: shortHash,
				previousHash,
				newKeys: [],
				previousKeys,
				newCdnUrls: [],
				previousCdnUrls,
				_uploaded: false,
			};
		}

		const s3Key = this.staticKey(userId, shortHash);
		const cdnUrl = this.staticCdnUrl(userId, shortHash);

		await this.storageService.uploadObject({
			bucket: Config.s3.buckets.cdn,
			key: s3Key,
			body: new Uint8Array(webpBuffer),
			contentType: 'image/webp',
		});

		return {
			newHash: shortHash,
			previousHash,
			newKeys: [s3Key],
			previousKeys,
			newCdnUrls: [cdnUrl],
			previousCdnUrls,
			_uploaded: true,
		};
	}

	private async processAnimated(params: {
		userId: bigint;
		inputBuffer: Uint8Array;
		previousHash: string | null;
		previousKeys: Array<string>;
		previousCdnUrls: Array<string>;
	}): Promise<PreparedNameplateUpload> {
		const {userId, inputBuffer, previousHash, previousKeys, previousCdnUrls} = params;

		let result;
		try {
			result = await transcodeToNameplateWebM({
				input: inputBuffer,
				targetWidth: NAMEPLATE_TARGET_WIDTH,
				targetHeight: NAMEPLATE_TARGET_HEIGHT,
				maxDurationSeconds: NAMEPLATE_MAX_DURATION_SECONDS,
				targetBitrateKbps: NAMEPLATE_WEBM_BITRATE_KBPS,
			});
		} catch (error) {
			Logger.error({error}, 'Nameplate animated transcode failed');
			throw InputValidationError.create('nameplate', 'Не удалось обработать анимацию');
		}

		if (result.webm.length > NAMEPLATE_MAX_WEBM_BYTES) {
			throw InputValidationError.create(
				'nameplate',
				`Анимация слишком большая после сжатия (${Math.ceil(result.webm.length / 1024)}KB)`,
			);
		}

		const shortHash = crypto.createHash('md5').update(Buffer.from(result.webm)).digest('hex').slice(0, 8);
		const fullHash = `a_${shortHash}`;

		if (fullHash === previousHash) {
			return {
				newHash: fullHash,
				previousHash,
				newKeys: [],
				previousKeys,
				newCdnUrls: [],
				previousCdnUrls,
				_uploaded: false,
			};
		}

		const webmKey = this.webmKey(userId, shortHash);
		const posterKey = this.posterKey(userId, shortHash);
		const webmCdn = this.webmCdnUrl(userId, fullHash);
		const posterCdn = this.posterCdnUrl(userId, fullHash);

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
			newHash: fullHash,
			previousHash,
			newKeys: [webmKey, posterKey],
			previousKeys,
			newCdnUrls: [webmCdn, posterCdn],
			previousCdnUrls,
			_uploaded: true,
		};
	}

	private keysForHash(userId: bigint, hash: string | null): Array<string> {
		if (!hash) return [];
		if (hash.startsWith('a_')) {
			const shortHash = hash.slice(2);
			return [this.webmKey(userId, shortHash), this.posterKey(userId, shortHash)];
		}
		return [this.staticKey(userId, hash)];
	}

	private cdnUrlsForHash(userId: bigint, hash: string | null): Array<string> {
		if (!hash) return [];
		if (hash.startsWith('a_')) {
			return [this.webmCdnUrl(userId, hash), this.posterCdnUrl(userId, hash)];
		}
		return [this.staticCdnUrl(userId, hash)];
	}

	private staticKey(userId: bigint, shortHash: string): string {
		return `nameplates/${userId}/${shortHash}.webp`;
	}

	private webmKey(userId: bigint, shortHash: string): string {
		return `nameplates/${userId}/${shortHash}.webm`;
	}

	private posterKey(userId: bigint, shortHash: string): string {
		return `nameplates/${userId}/${shortHash}.png`;
	}

	private staticCdnUrl(userId: bigint, hash: string): string {
		return `${Config.endpoints.media}/nmplts/${userId}/${hash}.webp`;
	}

	private webmCdnUrl(userId: bigint, hash: string): string {
		return `${Config.endpoints.media}/nmplts/${userId}/${hash}.webm`;
	}

	private posterCdnUrl(userId: bigint, hash: string): string {
		return `${Config.endpoints.media}/nmplts/${userId}/${hash}.png`;
	}
}
