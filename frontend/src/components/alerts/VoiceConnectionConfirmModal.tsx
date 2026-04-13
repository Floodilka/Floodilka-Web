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
import type React from 'react';
import * as Modal from '~/components/modals/Modal';
import {Button} from '~/components/uikit/Button/Button';
import {
	useVoiceConnectionConfirmModalLogic,
	type VoiceConnectionConfirmModalProps,
} from '~/utils/alerts/VoiceConnectionConfirmModalUtils';
import styles from './VoiceConnectionConfirmModal.module.css';

export const VoiceConnectionConfirmModal: React.FC<VoiceConnectionConfirmModalProps> = observer(
	({guildId: _guildId, channelId: _channelId, onSwitchDevice, onCancel}) => {
		const {t} = useLingui();
		const {handleSwitchDevice} = useVoiceConnectionConfirmModalLogic({
			onSwitchDevice,
			onCancel,
		});

		return (
			<Modal.Root size="small" centered>
				<Modal.Header title={t`Voice Connection Confirmation`} />
				<Modal.Content>
					<Trans>You're already connected to this voice channel from another device.</Trans>
				</Modal.Content>
				<Modal.Footer>
					<div className={styles.footer}>
						<Button variant="primary" onClick={handleSwitchDevice} className={styles.fullWidth}>
							<Trans>Switch to This Device</Trans>
						</Button>
					</div>
				</Modal.Footer>
			</Modal.Root>
		);
	},
);
