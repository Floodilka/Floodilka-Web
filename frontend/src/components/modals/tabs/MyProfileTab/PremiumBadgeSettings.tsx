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

import {t} from '@lingui/core/macro';
import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {Switch} from '~/components/form/Switch';
import * as DateUtils from '~/utils/DateUtils';
import styles from './PremiumBadgeSettings.module.css';

interface PremiumBadgeSettingsProps {
	premiumBadgeHidden: boolean;
	premiumBadgeTimestampHidden: boolean;
	onToggle: (
		field:
			| 'premium_badge_hidden'
			| 'premium_badge_timestamp_hidden',
		value: boolean,
	) => void;
	premiumSince?: Date | null;
}

export const PremiumBadgeSettings = observer(
	({
		premiumBadgeHidden,
		premiumBadgeTimestampHidden,
		onToggle,
		premiumSince,
	}: PremiumBadgeSettingsProps) => {
		const {i18n} = useLingui();

		return (
			<div>
				<div className={styles.header}>
					<h2 className={styles.title}>
						<Trans>Premium Badge Privacy</Trans>
					</h2>
					<p className={styles.description}>
						<Trans>Control how your Premium badge is displayed to others</Trans>
					</p>
				</div>

				<div className={styles.switches}>
					<Switch
						label={t(i18n)`Hide Premium badge entirely`}
						description={t(i18n)`Completely hide your Premium badge from other users`}
						value={premiumBadgeHidden}
						onChange={(value) => onToggle('premium_badge_hidden', value)}
					/>

					<Switch
						label={
							premiumSince
								? t(i18n)`Hide Premium purchase date (${DateUtils.getFormattedShortDate(premiumSince)})`
								: t(i18n)`Hide Premium purchase date`
						}
						description={t(i18n)`Remove when you first bought Premium from your badge`}
						value={premiumBadgeTimestampHidden}
						onChange={(value) => onToggle('premium_badge_timestamp_hidden', value)}
						disabled={premiumBadgeHidden}
					/>
				</div>
			</div>
		);
	},
);
