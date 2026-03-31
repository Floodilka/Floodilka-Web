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
import {DMChannelView} from '~/components/channel/channel-view/DMChannelView';
import {GuildChannelView} from '~/components/channel/channel-view/GuildChannelView';
import {useParams} from '~/lib/router';
import ChannelStore from '~/stores/ChannelStore';

export const ChannelIndexPage = observer(() => {
	const {
		guildId: routeGuildId,
		channelId,
		messageId,
	} = useParams() as {
		guildId?: string;
		channelId?: string;
		messageId?: string;
	};

	if (!channelId) {
		return null;
	}

	const channel = ChannelStore.getChannel(channelId);
	const derivedGuildId = routeGuildId || channel?.guildId;

	if (channel?.isPrivate()) {
		return <DMChannelView channelId={channelId} />;
	}

	return <GuildChannelView channelId={channelId} guildId={derivedGuildId} messageId={messageId} />;
});
