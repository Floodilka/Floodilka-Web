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

import type {UserRecord} from '~/records/UserRecord';
import DeveloperOptionsStore from '~/stores/DeveloperOptionsStore';
import {buildMediaProxyURL} from '~/utils/MediaProxyUtils';
import {mediaUrl} from '~/utils/UrlUtils';

const DEFAULT_AVATAR_PRIMARY_COLORS = [0x4641d9, 0xf0b100, 0x00bba7, 0x2b7fff, 0xad46ff, 0x6a7282];
const DEFAULT_AVATAR_COUNT = DEFAULT_AVATAR_PRIMARY_COLORS.length;

const getDefaultAvatar = (index: number): string => `https://static.floodilka.com/avatars/${index}.png`;
const getDefaultAvatarIndex = (id: string) => Number(BigInt(id) % BigInt(DEFAULT_AVATAR_COUNT));

export const getDefaultAvatarPrimaryColor = (id: string) => DEFAULT_AVATAR_PRIMARY_COLORS[getDefaultAvatarIndex(id)];

type AvatarOptions = Pick<UserRecord, 'id' | 'avatar'>;
type BannerOptions = Pick<UserRecord, 'id' | 'banner'>;
type NameplateOptions = Pick<UserRecord, 'id' | 'nameplate'>;

interface IconOptions {
	id: string;
	icon: string | null;
}

const getMediaURL = ({
	path,
	id,
	hash,
	size,
	format,
}: {
	path: string;
	id: string;
	hash: string;
	size?: number;
	format: string;
}) => {
	if (DeveloperOptionsStore.forceRenderPlaceholders) {
		return '';
	}

	const basePath = `${path}/${id}/${hash}.${format}`;
	return size ? mediaUrl(`${basePath}?size=${size}`) : mediaUrl(basePath);
};

const getGuildMemberMediaURL = ({
	path,
	guildId,
	userId,
	hash,
	size,
	format,
}: {
	path: string;
	guildId: string;
	userId: string;
	hash: string;
	size?: number;
	format: string;
}) => {
	if (DeveloperOptionsStore.forceRenderPlaceholders) {
		return '';
	}

	const basePath = `guilds/${guildId}/users/${userId}/${path}/${hash}.${format}`;
	return size ? mediaUrl(`${basePath}?size=${size}`) : mediaUrl(basePath);
};

const parseAvatar = (avatar: string) => {
	const animated = avatar.startsWith('a_');
	const hash = animated ? avatar.slice(2) : avatar;
	return {
		animated,
		hash,
	};
};

const BANNER_NEW_STATIC_PREFIX = 's_';
const BANNER_NEW_ANIMATED_PREFIX = 'v_';

const parseBannerHash = (banner: string) => {
	if (banner.startsWith(BANNER_NEW_ANIMATED_PREFIX)) {
		return {animated: true, newFormat: true, fullHash: banner};
	}
	if (banner.startsWith(BANNER_NEW_STATIC_PREFIX)) {
		return {animated: false, newFormat: true, fullHash: banner};
	}
	if (banner.startsWith('a_')) {
		return {animated: true, newFormat: false, fullHash: banner};
	}
	return {animated: false, newFormat: false, fullHash: banner};
};

export interface BannerAsset {
	animated: boolean;
	videoUrl: string | null;
	imageUrl: string;
}

export const getUserAvatarURL = ({id, avatar}: AvatarOptions, animated = false, size = 160) => {
	if (!avatar) {
		return getDefaultAvatar(getDefaultAvatarIndex(id));
	}

	const parsedAvatar = parseAvatar(avatar);
	const shouldAnimate = parsedAvatar.animated ? animated : false;

	return getMediaURL({
		path: 'avatars',
		id,
		hash: parsedAvatar.hash,
		size,
		format: shouldAnimate ? 'gif' : 'webp',
	});
};

export const getUserAvatarURLWithProxy = (
	{id, avatar}: AvatarOptions,
	mediaProxyEndpoint: string,
	animated = false,
) => {
	if (!avatar) {
		return getDefaultAvatar(getDefaultAvatarIndex(id));
	}

	if (DeveloperOptionsStore.forceRenderPlaceholders) {
		return '';
	}

	const parsedAvatar = parseAvatar(avatar);
	const shouldAnimate = parsedAvatar.animated ? animated : false;
	const format = shouldAnimate ? 'gif' : 'webp';

	return buildMediaProxyURL(`${mediaProxyEndpoint}/avatars/${id}/${parsedAvatar.hash}.${format}?size=160`);
};

export const getWebhookAvatarURL = ({id, avatar}: {id: string; avatar: string | null}, animated = false) => {
	if (!avatar) {
		return getDefaultAvatar(getDefaultAvatarIndex(id));
	}

	const parsedAvatar = parseAvatar(avatar);
	const shouldAnimate = parsedAvatar.animated ? animated : false;

	return getMediaURL({
		path: 'avatars',
		id,
		hash: parsedAvatar.hash,
		size: 160,
		format: shouldAnimate ? 'gif' : 'webp',
	});
};

export const getUserBannerURL = ({id, banner}: BannerOptions, animated = false, size = 1024) => {
	if (!banner) {
		return null;
	}

	const parsed = parseBannerHash(banner);

	if (parsed.newFormat && parsed.animated) {
		return getMediaURL({path: 'bnnrs', id, hash: parsed.fullHash, size, format: 'png'});
	}

	if (parsed.newFormat) {
		return getMediaURL({path: 'bnnrs', id, hash: parsed.fullHash, size, format: 'webp'});
	}

	const shouldAnimate = parsed.animated ? animated : false;
	const legacyHash = parsed.animated ? parsed.fullHash.slice(2) : parsed.fullHash;
	return getMediaURL({
		path: 'bnnrs',
		id,
		hash: legacyHash,
		size,
		format: shouldAnimate ? 'gif' : 'webp',
	});
};

export const getUserBannerAsset = ({id, banner}: BannerOptions, size = 1024): BannerAsset | null => {
	if (!banner) {
		return null;
	}

	const parsed = parseBannerHash(banner);

	if (parsed.newFormat && parsed.animated) {
		const videoUrl = getMediaURL({path: 'bnnrs', id, hash: parsed.fullHash, format: 'mp4'});
		const imageUrl = getMediaURL({path: 'bnnrs', id, hash: parsed.fullHash, size, format: 'png'});
		return {animated: true, videoUrl, imageUrl};
	}

	if (parsed.newFormat) {
		const imageUrl = getMediaURL({path: 'bnnrs', id, hash: parsed.fullHash, size, format: 'webp'});
		return {animated: false, videoUrl: null, imageUrl};
	}

	const legacyHash = parsed.animated ? parsed.fullHash.slice(2) : parsed.fullHash;
	if (parsed.animated) {
		const imageUrl = getMediaURL({path: 'bnnrs', id, hash: legacyHash, size, format: 'gif'});
		return {animated: true, videoUrl: null, imageUrl};
	}

	const imageUrl = getMediaURL({path: 'bnnrs', id, hash: legacyHash, size, format: 'webp'});
	return {animated: false, videoUrl: null, imageUrl};
};

export interface NameplateAsset {
	animated: boolean;
	videoUrl: string | null;
	imageUrl: string;
}

export const getUserNameplateAsset = ({id, nameplate}: NameplateOptions, size = 480): NameplateAsset | null => {
	if (!nameplate) {
		return null;
	}

	const parsed = parseAvatar(nameplate);

	if (parsed.animated) {
		const videoUrl = getMediaURL({
			path: 'nmplts',
			id,
			hash: `a_${parsed.hash}`,
			format: 'mp4',
		});
		const imageUrl = getMediaURL({
			path: 'nmplts',
			id,
			hash: `a_${parsed.hash}`,
			size,
			format: 'png',
		});
		return {animated: true, videoUrl, imageUrl};
	}

	const imageUrl = getMediaURL({
		path: 'nmplts',
		id,
		hash: parsed.hash,
		size,
		format: 'webp',
	});
	return {animated: false, videoUrl: null, imageUrl};
};

export const getUserNameplateURL = (options: NameplateOptions, size = 480): string | null => {
	const asset = getUserNameplateAsset(options, size);
	return asset?.imageUrl ?? null;
};

export const getGuildIconURL = ({id, icon}: IconOptions, animated = false) => {
	if (!icon) {
		return null;
	}

	const parsedIcon = parseAvatar(icon);
	const shouldAnimate = parsedIcon.animated ? animated : false;

	return getMediaURL({
		path: 'icons',
		id,
		hash: parsedIcon.hash,
		size: 160,
		format: shouldAnimate ? 'gif' : 'webp',
	});
};

export const getGuildBannerURL = ({id, banner}: {id: string; banner: string | null}, animated = false) => {
	if (!banner) {
		return null;
	}

	const parsed = parseBannerHash(banner);

	if (parsed.newFormat && parsed.animated) {
		return getMediaURL({path: 'bnnrs', id, hash: parsed.fullHash, size: 1024, format: 'png'});
	}

	if (parsed.newFormat) {
		return getMediaURL({path: 'bnnrs', id, hash: parsed.fullHash, size: 1024, format: 'webp'});
	}

	const shouldAnimate = parsed.animated ? animated : false;
	const legacyHash = parsed.animated ? parsed.fullHash.slice(2) : parsed.fullHash;
	return getMediaURL({
		path: 'bnnrs',
		id,
		hash: legacyHash,
		size: 1024,
		format: shouldAnimate ? 'gif' : 'webp',
	});
};

export const getGuildBannerAsset = (
	{id, banner}: {id: string; banner: string | null},
	size = 1024,
): BannerAsset | null => {
	if (!banner) {
		return null;
	}

	const parsed = parseBannerHash(banner);

	if (parsed.newFormat && parsed.animated) {
		const videoUrl = getMediaURL({path: 'bnnrs', id, hash: parsed.fullHash, format: 'mp4'});
		const imageUrl = getMediaURL({path: 'bnnrs', id, hash: parsed.fullHash, size, format: 'png'});
		return {animated: true, videoUrl, imageUrl};
	}

	if (parsed.newFormat) {
		const imageUrl = getMediaURL({path: 'bnnrs', id, hash: parsed.fullHash, size, format: 'webp'});
		return {animated: false, videoUrl: null, imageUrl};
	}

	const legacyHash = parsed.animated ? parsed.fullHash.slice(2) : parsed.fullHash;
	if (parsed.animated) {
		const imageUrl = getMediaURL({path: 'bnnrs', id, hash: legacyHash, size, format: 'gif'});
		return {animated: true, videoUrl: null, imageUrl};
	}

	const imageUrl = getMediaURL({path: 'bnnrs', id, hash: legacyHash, size, format: 'webp'});
	return {animated: false, videoUrl: null, imageUrl};
};

export const getGuildSplashURL = ({id, splash}: {id: string; splash: string | null}, size = 1024) => {
	if (!splash) {
		return null;
	}

	const parsedSplash = parseAvatar(splash);

	return getMediaURL({
		path: 'splashes',
		id,
		hash: parsedSplash.hash,
		size,
		format: 'webp',
	});
};

export const getGuildEmbedSplashURL = ({id, embedSplash}: {id: string; embedSplash: string | null}, size = 1024) => {
	if (!embedSplash) {
		return null;
	}

	const parsedEmbedSplash = parseAvatar(embedSplash);

	return getMediaURL({
		path: 'embed-splashes',
		id,
		hash: parsedEmbedSplash.hash,
		size,
		format: 'webp',
	});
};

export const getChannelIconURL = ({id, icon}: IconOptions, size?: number) => {
	if (!icon) {
		return null;
	}

	const parsedIcon = parseAvatar(icon);

	return getMediaURL({
		path: 'icons',
		id,
		hash: parsedIcon.hash,
		size: size || 160,
		format: 'webp',
	});
};

export const getGuildMemberAvatarURL = ({
	guildId,
	userId,
	avatar,
	animated = false,
	size = 160,
}: {
	guildId: string;
	userId: string;
	avatar: string | null;
	animated?: boolean;
	size?: number;
}) => {
	if (!avatar) {
		return null;
	}

	const parsedAvatar = parseAvatar(avatar);
	const shouldAnimate = parsedAvatar.animated ? animated : false;

	return getGuildMemberMediaURL({
		path: 'avatars',
		guildId,
		userId,
		hash: parsedAvatar.hash,
		size,
		format: shouldAnimate ? 'gif' : 'webp',
	});
};

export const getGuildMemberBannerURL = ({
	guildId,
	userId,
	banner,
	animated = false,
	size = 1024,
}: {
	guildId: string;
	userId: string;
	banner: string | null;
	animated?: boolean;
	size?: number;
}) => {
	if (!banner) {
		return null;
	}

	const parsed = parseBannerHash(banner);

	if (parsed.newFormat && parsed.animated) {
		return getGuildMemberMediaURL({path: 'bnnrs', guildId, userId, hash: parsed.fullHash, size, format: 'png'});
	}

	if (parsed.newFormat) {
		return getGuildMemberMediaURL({path: 'bnnrs', guildId, userId, hash: parsed.fullHash, size, format: 'webp'});
	}

	const shouldAnimate = parsed.animated ? animated : false;
	const legacyHash = parsed.animated ? parsed.fullHash.slice(2) : parsed.fullHash;
	return getGuildMemberMediaURL({
		path: 'bnnrs',
		guildId,
		userId,
		hash: legacyHash,
		size,
		format: shouldAnimate ? 'gif' : 'webp',
	});
};

export const getGuildMemberBannerAsset = ({
	guildId,
	userId,
	banner,
	size = 1024,
}: {
	guildId: string;
	userId: string;
	banner: string | null;
	size?: number;
}): BannerAsset | null => {
	if (!banner) {
		return null;
	}

	const parsed = parseBannerHash(banner);

	if (parsed.newFormat && parsed.animated) {
		const videoUrl = getGuildMemberMediaURL({path: 'bnnrs', guildId, userId, hash: parsed.fullHash, format: 'mp4'});
		const imageUrl = getGuildMemberMediaURL({path: 'bnnrs', guildId, userId, hash: parsed.fullHash, size, format: 'png'});
		return {animated: true, videoUrl, imageUrl};
	}

	if (parsed.newFormat) {
		const imageUrl = getGuildMemberMediaURL({
			path: 'bnnrs',
			guildId,
			userId,
			hash: parsed.fullHash,
			size,
			format: 'webp',
		});
		return {animated: false, videoUrl: null, imageUrl};
	}

	const legacyHash = parsed.animated ? parsed.fullHash.slice(2) : parsed.fullHash;
	if (parsed.animated) {
		const imageUrl = getGuildMemberMediaURL({path: 'bnnrs', guildId, userId, hash: legacyHash, size, format: 'gif'});
		return {animated: true, videoUrl: null, imageUrl};
	}

	const imageUrl = getGuildMemberMediaURL({path: 'bnnrs', guildId, userId, hash: legacyHash, size, format: 'webp'});
	return {animated: false, videoUrl: null, imageUrl};
};

export const getEmojiURL = ({id, animated}: {id: string; animated?: boolean}) => {
	if (DeveloperOptionsStore.forceRenderPlaceholders) {
		return '';
	}
	return mediaUrl(`emojis/${id}.${animated ? 'gif' : 'webp'}`);
};

type StickerSize = 160 | 320;

export const getStickerURL = ({id, animated, size = 320}: {id: string; animated?: boolean; size?: StickerSize}) => {
	if (DeveloperOptionsStore.forceRenderPlaceholders) {
		return '';
	}

	const safeSize: StickerSize = size === 320 ? 320 : 160;
	const ext = animated ? 'gif' : 'webp';

	return mediaUrl(`stickers/${id}.${ext}?size=${safeSize}`);
};

export const fileToBase64 = (file: File) =>
	new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = reject;
		reader.readAsDataURL(file);
	});
