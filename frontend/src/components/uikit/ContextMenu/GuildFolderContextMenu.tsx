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

import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {useCallback, useMemo} from 'react';
import * as ReadStateActionCreators from '~/actions/ReadStateActionCreators';
import {openGuildFolderSettingsModal} from '~/components/modals/GuildFolderSettingsModal';
import {MarkAsReadIcon, SettingsIcon} from '~/components/uikit/ContextMenu/ContextMenuIcons';
import {MenuGroup} from '~/components/uikit/ContextMenu/MenuGroup';
import {MenuItem} from '~/components/uikit/ContextMenu/MenuItem';
import type {GuildRecord} from '~/records/GuildRecord';
import ChannelStore from '~/stores/ChannelStore';
import GuildReadStateStore from '~/stores/GuildReadStateStore';
import type {GuildFolder} from '~/stores/UserSettingsStore';

interface GuildFolderContextMenuProps {
	folder: GuildFolder;
	guilds: Array<GuildRecord>;
	onClose: () => void;
}

export const GuildFolderContextMenu: React.FC<GuildFolderContextMenuProps> = observer(({folder, guilds, onClose}) => {
	const {t} = useLingui();

	const hasUnreads = useMemo(() => {
		return guilds.some((guild) => GuildReadStateStore.hasUnread(guild.id));
	}, [guilds]);

	const handleMarkFolderAsRead = useCallback(() => {
		const channelIds: Array<string> = [];

		for (const guild of guilds) {
			const channels = ChannelStore.getGuildChannels(guild.id);
			for (const channel of channels) {
				channelIds.push(channel.id);
			}
		}

		if (channelIds.length > 0) {
			void ReadStateActionCreators.bulkAckChannels(channelIds);
		}

		onClose();
	}, [guilds, onClose]);

	const handleFolderSettings = useCallback(() => {
		if (folder.id != null) {
			openGuildFolderSettingsModal(folder.id);
		}
		onClose();
	}, [folder.id, onClose]);

	return (
		<>
			<MenuGroup>
				<MenuItem icon={<MarkAsReadIcon />} onClick={handleMarkFolderAsRead} disabled={!hasUnreads}>
					{t`Mark Folder as Read`}
				</MenuItem>
			</MenuGroup>

			<MenuGroup>
				<MenuItem icon={<SettingsIcon />} onClick={handleFolderSettings}>
					{t`Folder Settings`}
				</MenuItem>
			</MenuGroup>
		</>
	);
});
