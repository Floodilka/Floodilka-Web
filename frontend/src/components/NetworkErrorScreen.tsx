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

import {Trans} from '@lingui/react/macro';
import React from 'react';
import {FloodilkaIcon} from '~/components/icons/FloodilkaIcon';
import {Button} from '~/components/uikit/Button/Button';
import styles from './ErrorFallback.module.css';

export const NetworkErrorScreen: React.FC = () => {
	const handleRetry = React.useCallback(() => {
		window.location.reload();
	}, []);

	return (
		<div className={styles.errorFallbackContainer}>
			<FloodilkaIcon className={styles.errorFallbackIcon} />
			<div className={styles.errorFallbackContent}>
				<h1 className={styles.errorFallbackTitle}>
					<Trans>Connection Issue</Trans>
				</h1>
				<p className={styles.errorFallbackDescription}>
					<Trans>
						We're having trouble connecting to Floodilka's servers. This could be a temporary network issue or scheduled
						maintenance.
					</Trans>
				</p>
			</div>
			<div className={styles.errorFallbackActions}>
				<Button onClick={handleRetry}>
					<Trans>Try Again</Trans>
				</Button>
			</div>
		</div>
	);
};
