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

import type {ChannelID} from '~/BrandedTypes';
import type {User} from '~/Models';
import type {ReadStateService} from '~/read_state/ReadStateService';

interface IncrementDmMentionCountsParams {
	readStateService: ReadStateService;
	user: User | null;
	recipients: Array<User>;
	channelId: ChannelID;
}

export async function incrementDmMentionCounts(params: IncrementDmMentionCountsParams): Promise<void> {
	const {readStateService, user, recipients, channelId} = params;

	if (!user || user.isBot) return;

	const validRecipients = recipients.filter((recipient) => recipient.id !== user.id && !recipient.isBot);

	if (validRecipients.length === 0) return;

	await readStateService.bulkIncrementMentionCounts(
		validRecipients.map((recipient) => ({
			userId: recipient.id,
			channelId,
		})),
	);
}
