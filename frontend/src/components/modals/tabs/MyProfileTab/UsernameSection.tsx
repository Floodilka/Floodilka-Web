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

import {msg} from '@lingui/core/macro';
import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import * as ModalActionCreators from '~/actions/ModalActionCreators';
import {modal} from '~/actions/ModalActionCreators';
import {UsernameChangeModal} from '~/components/modals/UsernameChangeModal';
import {Button} from '~/components/uikit/Button/Button';
import {Tooltip} from '~/components/uikit/Tooltip/Tooltip';
import styles from './UsernameSection.module.css';

interface UsernameSectionProps {
	isClaimed: boolean;
	hasPremium: boolean;
}

export const UsernameSection = observer(({isClaimed}: UsernameSectionProps) => {
	const {t} = useLingui();

	return (
		<div>
			<div className={styles.label}>
				<Trans>Username</Trans>
			</div>

			<div className={styles.actions}>
				{!isClaimed ? (
					<Tooltip text={t(msg`Claim your account to change your username`)}>
						<div>
							<Button variant="primary" small disabled>
								<Trans>Change Username</Trans>
							</Button>
						</div>
					</Tooltip>
				) : (
					<Button
						variant="primary"
						small
						onClick={() => ModalActionCreators.push(modal(() => <UsernameChangeModal />))}
					>
						<Trans>Change Username</Trans>
					</Button>
				)}
			</div>

			<div className={styles.description}>
				<Trans>Your username is how others identify you.</Trans>
			</div>
		</div>
	);
});
