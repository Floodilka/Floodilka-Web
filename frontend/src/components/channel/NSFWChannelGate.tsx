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
import {WarningIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import * as GuildNSFWActionCreators from '~/actions/GuildNSFWActionCreators';
import {Button} from '~/components/uikit/Button/Button';
import {NSFWGateReason} from '~/stores/GuildNSFWAgreeStore';
import styles from './NSFWChannelGate.module.css';

interface Props {
	channelId: string;
	reason: NSFWGateReason;
}

export const NSFWChannelGate = observer(({channelId, reason}: Props) => {
	const handleAgree = () => {
		GuildNSFWActionCreators.agreeToNSFWChannel(channelId);
	};

	const renderContent = () => {
		switch (reason) {
			case NSFWGateReason.AGE_RESTRICTED:
				return (
					<>
						<h2 className={styles.title}>
							<Trans>Age-Restricted Channel</Trans>
						</h2>
						<p className={styles.description}>
							<Trans>You must be 18 or older to view this channel.</Trans>
						</p>
					</>
				);
			default:
				return (
					<>
						<h2 className={styles.title}>
							<Trans>NSFW Channel</Trans>
						</h2>
						<p className={styles.description}>
							<Trans>
								This channel may contain content that is not safe for work or that may be inappropriate for some users.
								You must be 18 or older to view this channel.
							</Trans>
						</p>
						<Button onClick={handleAgree} variant="danger-primary">
							<Trans>I am 18 or older</Trans>
						</Button>
					</>
				);
		}
	};

	return (
		<div className={styles.container}>
			<div className={styles.content}>
				<div className={styles.iconContainer}>
					<WarningIcon className={styles.icon} weight="fill" />
				</div>
				{renderContent()}
			</div>
		</div>
	);
});
