/*
 * Copyright (C) 2026 Fluxer Contributors
 *
 * This file is part of Fluxer.
 *
 * Fluxer is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Fluxer is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Fluxer. If not, see <https://www.gnu.org/licenses/>.
 */

import {useLingui} from '@lingui/react/macro';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import React from 'react';
import {UserFlags, UserPremiumTypes} from '~/Constants';
import styles from '~/components/popouts/UserProfileBadges.module.css';
import FocusRing from '~/components/uikit/FocusRing/FocusRing';
import {Tooltip} from '~/components/uikit/Tooltip/Tooltip';
import {Routes} from '~/Routes';
import type {ProfileRecord} from '~/records/ProfileRecord';
import type {UserRecord} from '~/records/UserRecord';
import * as DateUtils from '~/utils/DateUtils';

interface Badge {
	key: string;
	iconUrl: string;
	tooltip: string;
	url: string;
}

interface VirtualBadge {
	key: string;
	tooltip: string;
	url: string;
	component: React.ReactElement;
}

interface UserProfileBadgesProps {
	user: UserRecord;
	profile: ProfileRecord | null;
	isModal?: boolean;
	isMobile?: boolean;
	warningIndicator?: React.ReactNode;
}

export const UserProfileBadges: React.FC<UserProfileBadgesProps> = observer(
	({user, profile, isModal = false, isMobile = false, warningIndicator}) => {
		const {t} = useLingui();
		const badges = React.useMemo(() => {
			const result: Array<Badge> = [];

			if (user.flags & UserFlags.STAFF) {
				result.push({
					key: 'staff',
					iconUrl: '/badges/staff.svg',
					tooltip: t`Floodilka Staff`,
					url: Routes.careers(),
				});
			}

			if (user.flags & UserFlags.CTP_MEMBER) {
				result.push({
					key: 'ctp',
					iconUrl: '/badges/ctp.svg',
					tooltip: t`Floodilka Community Team`,
					url: Routes.careers(),
				});
			}

			if (user.flags & UserFlags.PARTNER) {
				result.push({
					key: 'partner',
					iconUrl: '/badges/partner.svg',
					tooltip: t`Floodilka Partner`,
					url: Routes.partners(),
				});
			}

			if (user.flags & UserFlags.BUG_HUNTER) {
				result.push({
					key: 'bug_hunter',
					iconUrl: '/badges/bug-hunter.svg',
					tooltip: t`Floodilka Bug Hunter`,
					url: Routes.bugs(),
				});
			}

			if (profile?.premiumType && profile.premiumType !== UserPremiumTypes.NONE) {
				let tooltipText = t`Floodilka Premium Subscriber`;

				if (profile.premiumSince) {
					const premiumSinceFormatted = DateUtils.getFormattedShortDate(profile.premiumSince);
					tooltipText = t`Floodilka Premium subscriber since ${premiumSinceFormatted}`;
				}

				result.push({
					key: 'premium',
					iconUrl: '/badges/premium.svg',
					tooltip: tooltipText,
					url: Routes.premium(),
				});
			}

			return result;
		}, [user.flags, profile?.premiumType, profile?.premiumSince]);

		const virtualBadges = React.useMemo(() => {
			const result: Array<VirtualBadge> = [];
			return result;
		}, []);

		if (badges.length === 0 && virtualBadges.length === 0) {
			return null;
		}

		const containerClassName = isModal
			? clsx(styles.containerModal, isMobile ? styles.containerModalMobile : styles.containerModalDesktop)
			: styles.containerPopout;

		const badgeClassName = isModal && isMobile ? styles.badgeMobile : styles.badgeDesktop;
		const isDesktopInteractions = !isMobile;

		const renderInteractiveWrapper = (url: string, children: React.ReactNode, style?: React.CSSProperties) => {
			if (isDesktopInteractions) {
				return (
					<a href={url} target="_blank" rel="noopener noreferrer" className={styles.link} style={style}>
						{children}
					</a>
				);
			}

			return (
				<div className={styles.link} style={style}>
					{children}
				</div>
			);
		};

		const virtualBadgeStyle: React.CSSProperties = {
			WebkitTapHighlightColor: 'transparent',
			WebkitTouchCallout: 'none',
		};

		return (
			<div className={containerClassName}>
				{warningIndicator}
				{badges.map((badge) => {
					const badgeContent = <img src={badge.iconUrl} alt={badge.tooltip} className={badgeClassName} />;

					return (
						<Tooltip key={badge.key} text={badge.tooltip} maxWidth="xl">
							<FocusRing offset={-2}>{renderInteractiveWrapper(badge.url, badgeContent)}</FocusRing>
						</Tooltip>
					);
				})}
				{virtualBadges.map((badge) => (
					<Tooltip key={badge.key} text={badge.tooltip} maxWidth="xl">
						<FocusRing offset={-2}>{renderInteractiveWrapper(badge.url, badge.component, virtualBadgeStyle)}</FocusRing>
					</Tooltip>
				))}
			</div>
		);
	},
);
