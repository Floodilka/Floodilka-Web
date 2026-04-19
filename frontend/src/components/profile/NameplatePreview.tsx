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

import {Trans} from '@lingui/react/macro';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import React from 'react';
import type {UserRecord} from '~/records/UserRecord';
import * as AvatarUtils from '~/utils/AvatarUtils';
import styles from './NameplatePreview.module.css';

interface NameplatePreviewProps {
	user: UserRecord;
	previewAvatarUrl?: string | null;
	hasClearedAvatar?: boolean;
	previewNameplateUrl?: string | null;
	hasClearedNameplate?: boolean;
	previewNickname?: string | null;
}

export const NameplatePreview: React.FC<NameplatePreviewProps> = observer(
	({user, previewAvatarUrl, hasClearedAvatar, previewNameplateUrl, hasClearedNameplate, previewNickname}) => {
		const avatarUrl = React.useMemo(() => {
			if (previewAvatarUrl) return previewAvatarUrl;
			if (hasClearedAvatar) {
				return AvatarUtils.getUserAvatarURL({id: user.id, avatar: null}, false, 64);
			}
			return AvatarUtils.getUserAvatarURL({id: user.id, avatar: user.avatar}, false, 64);
		}, [previewAvatarUrl, hasClearedAvatar, user.id, user.avatar]);

		const nameplateAsset = React.useMemo(() => {
			if (hasClearedNameplate) return null;
			if (previewNameplateUrl) {
				return {animated: false as const, videoUrl: null, imageUrl: previewNameplateUrl};
			}
			return AvatarUtils.getUserNameplateAsset({id: user.id, nameplate: user.nameplate ?? null});
		}, [hasClearedNameplate, previewNameplateUrl, user.id, user.nameplate]);

		const displayName = previewNickname || user.globalName || user.username;
		const hasNameplate = Boolean(nameplateAsset);

		return (
			<div className={styles.wrapper}>
				<div className={styles.previewLabel}>
					<Trans>Nameplate Preview</Trans>
				</div>
				<div className={styles.card}>
					<SkeletonMemberItem index={0} />
					<div className={clsx(styles.row, hasNameplate && styles.nameplateActive)}>
						{nameplateAsset?.animated && nameplateAsset.videoUrl ? (
							<>
								<video
									className={styles.nameplateVideo}
									src={nameplateAsset.videoUrl}
									poster={nameplateAsset.imageUrl}
									autoPlay
									loop
									muted
									playsInline
									aria-hidden="true"
								/>
								<span className={styles.nameplateOverlay} aria-hidden="true" />
							</>
						) : nameplateAsset ? (
							<>
								<span
									className={styles.nameplate}
									style={{backgroundImage: `url(${nameplateAsset.imageUrl})`}}
									aria-hidden="true"
								/>
								<span className={styles.nameplateOverlay} aria-hidden="true" />
							</>
						) : null}
						<div className={styles.content}>
							{avatarUrl ? (
								<img className={styles.avatar} src={avatarUrl} alt="" />
							) : (
								<div className={styles.avatarFallback} aria-hidden="true" />
							)}
							<span className={styles.name}>{displayName}</span>
						</div>
					</div>
					<SkeletonMemberItem index={1} />
				</div>
			</div>
		);
	},
);

const SkeletonMemberItem: React.FC<{index: number}> = ({index}) => {
	const seededRandom = (seed: number) => {
		const x = Math.sin(seed) * 10000;
		return x - Math.floor(x);
	};

	const baseSeed = (index + 1) * 17;
	const nameWidth = 40 + seededRandom(baseSeed) * 40;
	const statusWidth = 30 + seededRandom(baseSeed + 1) * 50;

	return (
		<div className={styles.skeletonItem} aria-hidden="true">
			<div className={styles.skeletonContent}>
				<div className={styles.skeletonAvatar} />
				<div className={styles.skeletonUserInfoContainer}>
					<div className={styles.skeletonName} style={{width: `${Math.min(nameWidth, 95)}%`}} />
					<div className={styles.skeletonStatus} style={{width: `${Math.min(statusWidth, 95)}%`}} />
				</div>
			</div>
		</div>
	);
};
