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

import React from 'react';
import * as ModalActionCreators from '~/actions/ModalActionCreators';

export interface VoiceConnectionConfirmModalCallbacks {
	onSwitchDevice: () => void;
	onCancel: () => void;
}

export interface VoiceConnectionConfirmModalProps extends VoiceConnectionConfirmModalCallbacks {
	guildId: string | null;
	channelId: string;
}

export interface VoiceConnectionConfirmModalLogicState {
	handleSwitchDevice: () => Promise<void>;
	handleCancel: () => void;
}

export const useVoiceConnectionConfirmModalLogic = ({
	onSwitchDevice,
	onCancel,
}: VoiceConnectionConfirmModalCallbacks): VoiceConnectionConfirmModalLogicState => {
	const handleSwitchDevice = React.useCallback(async () => {
		onSwitchDevice();
		ModalActionCreators.pop();
	}, [onSwitchDevice]);

	const handleCancel = React.useCallback(() => {
		onCancel();
		ModalActionCreators.pop();
	}, [onCancel]);

	return {
		handleSwitchDevice,
		handleCancel,
	};
};
