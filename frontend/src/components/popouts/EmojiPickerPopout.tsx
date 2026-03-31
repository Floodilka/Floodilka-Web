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

import {observer} from 'mobx-react-lite';
import React from 'react';
import {ExpressionPickerPopout} from '~/components/popouts/ExpressionPickerPopout';
import type {Emoji} from '~/stores/EmojiStore';

export const EmojiPickerPopout = observer(
	({
		channelId,
		handleSelect,
		onClose,
	}: {
		channelId: string | null;
		handleSelect: (emoji: Emoji, shiftKey?: boolean) => void;
		onClose?: () => void;
	}) => {
		const handleEmojiSelect = React.useCallback(
			(emoji: Emoji, shiftKey?: boolean) => {
				handleSelect(emoji, shiftKey);
				if (!shiftKey && onClose) {
					onClose();
				}
			},
			[handleSelect, onClose],
		);

		return (
			<ExpressionPickerPopout
				channelId={channelId ?? undefined}
				onEmojiSelect={handleEmojiSelect}
				onClose={onClose}
				visibleTabs={['emojis']}
			/>
		);
	},
);
