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

import {splitMediaAndFileAttachments} from '~/components/channel/messageAttachmentUtils';
import type {MessageAttachment} from '~/records/MessageRecord';
import UserSettingsStore from '~/stores/UserSettingsStore';

export interface AttachmentRenderingState {
	enrichedAttachments: Array<MessageAttachment>;
	activeAttachments: Array<MessageAttachment>;
	mediaAttachments: Array<MessageAttachment>;
	shouldUseMosaic: boolean;
}

export const getAttachmentRenderingState = (
	snapshotAttachments?: ReadonlyArray<MessageAttachment> | null,
): AttachmentRenderingState => {
	const attachments = snapshotAttachments ?? [];
	const enrichedAttachments = [...attachments];
	const activeAttachments = [...attachments];
	const {mediaAttachments} = splitMediaAndFileAttachments(activeAttachments);
	const shouldUseMosaic = mediaAttachments.length >= 2 && UserSettingsStore.getInlineAttachmentMedia();

	return {
		enrichedAttachments,
		activeAttachments,
		mediaAttachments,
		shouldUseMosaic,
	};
};
