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

import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {ComparisonCheckRow} from './ComparisonCheckRow';
import {ComparisonRow} from './ComparisonRow';
import styles from './FeatureComparisonTable.module.css';

export const FeatureComparisonTable = observer(({formatter}: {formatter: Intl.NumberFormat}) => {
	const {t} = useLingui();
	return (
		<div className={styles.table}>
			<div className={styles.header}>
				<div className={styles.headerFeature}>
					<p className={styles.headerFeatureText}>
						<Trans>Feature</Trans>
					</p>
				</div>
				<div className={styles.headerValues}>
					<div className={styles.headerFree}>
						<Trans>Free</Trans>
					</div>
					<div className={styles.headerPremium}>
						<Trans>Premium</Trans>
					</div>
				</div>
			</div>

			<div className={styles.rows}>
				<ComparisonCheckRow feature={t`Per-community profiles`} freeHas={false} premiumHas={true} />
				<ComparisonCheckRow feature={t`Profile badge`} freeHas={false} premiumHas={true} />
				<ComparisonCheckRow feature={t`Animated nameplate`} freeHas={false} premiumHas={true} />
				<ComparisonRow
					feature={t`Custom video backgrounds`}
					freeValue={formatter.format(1)}
					premiumValue={formatter.format(15)}
				/>
				<ComparisonCheckRow feature={t`Custom entrance sounds`} freeHas={false} premiumHas={true} />
				<ComparisonCheckRow feature={t`Custom notification sounds`} freeHas={false} premiumHas={true} />
				<ComparisonRow
					feature={t`Communities`}
					freeValue={formatter.format(100)}
					premiumValue={formatter.format(200)}
				/>
				<ComparisonRow
					feature={t`Message character limit`}
					freeValue={formatter.format(2000)}
					premiumValue={formatter.format(4000)}
				/>
				<ComparisonRow
					feature={t`Bookmarked messages`}
					freeValue={formatter.format(50)}
					premiumValue={formatter.format(300)}
				/>
				<ComparisonRow
					feature={t`Bio character limit`}
					freeValue={formatter.format(160)}
					premiumValue={formatter.format(320)}
				/>
				<ComparisonRow feature={t`File upload size`} freeValue={t`25 MB`} premiumValue={t`500 MB`} />
				<ComparisonRow
					feature={t`Saved media`}
					freeValue={formatter.format(50)}
					premiumValue={formatter.format(500)}
				/>
				<ComparisonCheckRow feature={t`Use animated emojis`} freeHas={true} premiumHas={true} />
				<ComparisonCheckRow feature={t`Global emoji & sticker access`} freeHas={false} premiumHas={true} />
				<ComparisonRow feature={t`Video quality`} freeValue={t`720p/30fps`} premiumValue={t`1080p/60fps`} />
				<ComparisonCheckRow feature={t`Animated avatars`} freeHas={false} premiumHas={true} />
				<ComparisonCheckRow feature={t`Profile banners`} freeHas={false} premiumHas={true} />
				<ComparisonCheckRow feature={t`Early access to new features`} freeHas={false} premiumHas={true} />
			</div>
		</div>
	);
});
