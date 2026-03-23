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
import {observer} from 'mobx-react-lite';
import {UserFlags, UserPremiumTypes} from '~/Constants';
import {Tooltip} from '~/components/uikit/Tooltip/Tooltip';
import type {UserRecord} from '~/records/UserRecord';
import UserProfileStore from '~/stores/UserProfileStore';
import styles from './UserBadgesInline.module.css';

interface UserBadgesInlineProps {
	user: UserRecord;
	guildId?: string;
}

interface InlineBadge {
	key: string;
	iconUrl: string;
	tooltip: string;
}

export const UserBadgesInline: React.FC<UserBadgesInlineProps> = observer(({user, guildId}) => {
	const {t} = useLingui();

	const profile = UserProfileStore.getProfile(user.id, guildId);
	const premiumType = user.premiumType ?? profile?.premiumType ?? null;

	const badges: Array<InlineBadge> = [];

	if (user.flags & UserFlags.STAFF) {
		badges.push({key: 'staff', iconUrl: '/badges/staff.svg', tooltip: t`Floodilka Staff`});
	}

	if (user.flags & UserFlags.CTP_MEMBER) {
		badges.push({key: 'ctp', iconUrl: '/badges/ctp.svg', tooltip: t`Floodilka Community Team`});
	}

	if (user.flags & UserFlags.PARTNER) {
		badges.push({key: 'partner', iconUrl: '/badges/partner.svg', tooltip: t`Floodilka Partner`});
	}

	if (user.flags & UserFlags.BUG_HUNTER) {
		badges.push({key: 'bug_hunter', iconUrl: '/badges/bug-hunter.svg', tooltip: t`Floodilka Bug Hunter`});
	}

	if (premiumType != null && premiumType !== UserPremiumTypes.NONE) {
		badges.push({key: 'premium', iconUrl: '/badges/premium.svg', tooltip: t`Floodilka Premium Subscriber`});
	}

	if (badges.length === 0) {
		return null;
	}

	return (
		<span className={styles.container}>
			{badges.map((badge) => (
				<Tooltip key={badge.key} text={badge.tooltip}>
					<img src={badge.iconUrl} alt={badge.tooltip} className={styles.badge} />
				</Tooltip>
			))}
		</span>
	);
});
