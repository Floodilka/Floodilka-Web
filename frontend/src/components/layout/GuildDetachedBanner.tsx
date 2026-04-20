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

import {useMemo} from 'react';
import {GuildFeatures} from '~/Constants';
import type {GuildRecord} from '~/records/GuildRecord';
import * as AvatarUtils from '~/utils/AvatarUtils';
import styles from './GuildDetachedBanner.module.css';

const MAX_VIEWPORT_HEIGHT_FRACTION = 0.3;
const DEFAULT_BANNER_HEIGHT = 240;

export function GuildDetachedBanner({guild}: {guild: GuildRecord}) {
	const aspectRatio = useMemo(
		() => (guild.bannerWidth && guild.bannerHeight ? guild.bannerWidth / guild.bannerHeight : undefined),
		[guild.bannerHeight, guild.bannerWidth],
	);
	const bannerAsset = AvatarUtils.getGuildBannerAsset({id: guild.id, banner: guild.banner});
	const isDetachedBanner = guild.features.has(GuildFeatures.DETACHED_BANNER);

	if (!bannerAsset || !isDetachedBanner) return null;

	const maxHeight = `${MAX_VIEWPORT_HEIGHT_FRACTION * 100}vh`;
	const bannerHeight = guild.bannerHeight ?? DEFAULT_BANNER_HEIGHT;

	return (
		<div
			className={styles.container}
			style={{maxHeight, ...(aspectRatio ? {aspectRatio: `${aspectRatio}`} : {height: bannerHeight})}}
		>
			{bannerAsset.videoUrl ? (
				<video
					className={styles.banner}
					src={bannerAsset.videoUrl}
					poster={bannerAsset.imageUrl}
					autoPlay
					loop
					muted
					playsInline
					aria-hidden="true"
				/>
			) : (
				<img src={bannerAsset.imageUrl} alt="" className={styles.banner} draggable={false} />
			)}
		</div>
	);
}
