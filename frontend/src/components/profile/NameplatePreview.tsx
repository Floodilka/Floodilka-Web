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

		const nameplateImageUrl = React.useMemo(() => {
			if (hasClearedNameplate) return null;
			if (previewNameplateUrl) return previewNameplateUrl;
			const asset = AvatarUtils.getUserNameplateAsset({id: user.id, nameplate: user.nameplate ?? null});
			return asset?.imageUrl ?? null;
		}, [hasClearedNameplate, previewNameplateUrl, user.id, user.nameplate]);

		const displayName = previewNickname || user.globalName || user.username;

		return (
			<div className={styles.wrapper}>
				<div className={styles.previewLabel}>
					<Trans>Nameplate Preview</Trans>
				</div>
				<div className={styles.card}>
					<div className={styles.placeholderRow} aria-hidden="true" />
					<div className={clsx(styles.row, nameplateImageUrl && styles.nameplateActive)}>
						{nameplateImageUrl && (
							<>
								<span
									className={styles.nameplate}
									style={{backgroundImage: `url(${nameplateImageUrl})`}}
									aria-hidden="true"
								/>
								<span className={styles.nameplateOverlay} aria-hidden="true" />
							</>
						)}
						<div className={styles.content}>
							{avatarUrl ? (
								<img className={styles.avatar} src={avatarUrl} alt="" />
							) : (
								<div className={styles.avatarFallback} aria-hidden="true" />
							)}
							<span className={styles.name}>{displayName}</span>
						</div>
					</div>
					<div className={styles.placeholderRow} aria-hidden="true" />
					<div className={styles.placeholderRow} aria-hidden="true" />
				</div>
			</div>
		);
	},
);
