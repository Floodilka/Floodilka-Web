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

import type {MessageDescriptor} from '@lingui/core';
import {msg} from '@lingui/core/macro';
import * as ChannelActionCreators from '~/actions/ChannelActionCreators';
import * as ModalActionCreators from '~/actions/ModalActionCreators';
import {selectChannel} from '~/actions/NavigationActionCreators';
import {ChannelTypes} from '~/Constants';
import {Routes} from '~/Routes';
import * as RouterUtils from '~/utils/RouterUtils';

export interface FormInputs {
	name: string;
	type: string;
}

export interface ChannelTypeOption {
	value: number;
	name: string;
	desc: string;
}

export const getChannelTypeOptions = (t: (msg: MessageDescriptor) => string): Array<ChannelTypeOption> => [
	{
		value: ChannelTypes.GUILD_TEXT,
		name: t(msg`Text Channel`),
		desc: t(msg`Send messages, images, GIFs, and emoji`),
	},
	{
		value: ChannelTypes.GUILD_VOICE,
		name: t(msg`Voice Channel`),
		desc: t(msg`Hang out together with voice, video, and screen share`),
	},
];

export const createChannel = async (guildId: string, data: FormInputs, parentId?: string): Promise<void> => {
	const channelType = Number(data.type);
	const channel = await ChannelActionCreators.create(guildId, {
		name: data.name,
		type: channelType,
		parent_id: parentId || null,
		bitrate: channelType === ChannelTypes.GUILD_VOICE ? 64000 : null,
		user_limit: channelType === ChannelTypes.GUILD_VOICE ? 0 : null,
	});

	if (channel.type === ChannelTypes.GUILD_TEXT || channel.type === ChannelTypes.GUILD_VOICE) {
		setTimeout(() => {
			RouterUtils.transitionTo(Routes.guildChannel(guildId, channel.id));
			selectChannel(guildId, channel.id);
		}, 50);
	}

	ModalActionCreators.pop();
};

export const getDefaultValues = (): Partial<FormInputs> => ({
	type: ChannelTypes.GUILD_TEXT.toString(),
});
