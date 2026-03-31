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

import NotificationStore from '~/stores/NotificationStore';
import ReadStateStore from '~/stores/ReadStateStore';
import type {GatewayHandlerContext} from '../index';

interface MessageAckPayload {
	channel_id: string;
	message_id: string;
	mention_count: number;
	manual?: boolean;
}

export function handleMessageAck(data: MessageAckPayload, _context: GatewayHandlerContext): void {
	ReadStateStore.handleMessageAck({
		channelId: data.channel_id,
		messageId: data.message_id,
		mentionCount: data.mention_count,
		manual: data.manual ?? false,
	});
	NotificationStore.handleMessageAck({channelId: data.channel_id});
}
