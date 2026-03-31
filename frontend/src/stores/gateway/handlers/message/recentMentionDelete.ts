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

import RecentMentionsStore from '~/stores/RecentMentionsStore';
import type {GatewayHandlerContext} from '../index';

interface RecentMentionDeletePayload {
	message_id: string;
}

export function handleRecentMentionDelete(data: RecentMentionDeletePayload, _context: GatewayHandlerContext): void {
	RecentMentionsStore.handleMessageDelete(data.message_id);
}
