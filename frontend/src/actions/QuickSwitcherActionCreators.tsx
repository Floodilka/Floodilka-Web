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

import * as ModalActionCreators from '~/actions/ModalActionCreators';
import {modal} from '~/actions/ModalActionCreators';
import * as NavigationActionCreators from '~/actions/NavigationActionCreators';
import * as PrivateChannelActionCreators from '~/actions/PrivateChannelActionCreators';
import {ME, QuickSwitcherResultTypes} from '~/Constants';
import {UserSettingsModal} from '~/components/modals/UserSettingsModal';
import {Routes} from '~/Routes';
import type {QuickSwitcherExecutableResult} from '~/stores/QuickSwitcherStore';
import QuickSwitcherStore from '~/stores/QuickSwitcherStore';
import SelectedChannelStore from '~/stores/SelectedChannelStore';
import {goToMessage, parseMessagePath} from '~/utils/MessageNavigator';
import * as RouterUtils from '~/utils/RouterUtils';

const QUICK_SWITCHER_MODAL_KEY = 'quick-switcher';

export const hide = (): void => {
	QuickSwitcherStore.hide();
};

export const search = (query: string): void => {
	QuickSwitcherStore.search(query);
};

export const select = (selectedIndex: number): void => {
	QuickSwitcherStore.select(selectedIndex);
};

export const moveSelection = (direction: 'up' | 'down'): void => {
	const nextIndex = QuickSwitcherStore.findNextSelectableIndex(direction);
	select(nextIndex);
};

export const confirmSelection = async (): Promise<void> => {
	const result = QuickSwitcherStore.getSelectedResult();
	if (!result) return;
	await switchTo(result);
};

export const switchTo = async (result: QuickSwitcherExecutableResult): Promise<void> => {
	try {
		switch (result.type) {
			case QuickSwitcherResultTypes.USER: {
				if (result.dmChannelId) {
					RouterUtils.transitionTo(Routes.dmChannel(result.dmChannelId));
				} else {
					await PrivateChannelActionCreators.openDMChannel(result.user.id);
				}
				break;
			}
			case QuickSwitcherResultTypes.GROUP_DM: {
				RouterUtils.transitionTo(Routes.dmChannel(result.channel.id));
				break;
			}
			case QuickSwitcherResultTypes.TEXT_CHANNEL: {
				if (result.guild) {
					NavigationActionCreators.selectGuild(result.guild.id);
					NavigationActionCreators.selectChannel(result.guild.id, result.channel.id);
					RouterUtils.transitionTo(Routes.guildChannel(result.guild.id, result.channel.id));
				} else {
					RouterUtils.transitionTo(Routes.dmChannel(result.channel.id));
				}
				break;
			}
			case QuickSwitcherResultTypes.VOICE_CHANNEL: {
				if (result.guild) {
					NavigationActionCreators.selectGuild(result.guild.id);
					NavigationActionCreators.selectChannel(result.guild.id, result.channel.id);
					RouterUtils.transitionTo(Routes.guildChannel(result.guild.id, result.channel.id));
				}
				break;
			}
			case QuickSwitcherResultTypes.GUILD: {
				const channelId = SelectedChannelStore.selectedChannelIds.get(result.guild.id);
				NavigationActionCreators.selectGuild(result.guild.id);
				if (channelId) {
					NavigationActionCreators.selectChannel(result.guild.id, channelId);
					RouterUtils.transitionTo(Routes.guildChannel(result.guild.id, channelId));
				} else {
					RouterUtils.transitionTo(Routes.guildChannel(result.guild.id));
				}
				break;
			}
			case QuickSwitcherResultTypes.VIRTUAL_GUILD: {
				if (result.virtualGuildType === 'home') {
					const dmChannelId = SelectedChannelStore.selectedChannelIds.get(ME);
					if (dmChannelId) {
						RouterUtils.transitionTo(Routes.dmChannel(dmChannelId));
					} else {
						RouterUtils.transitionTo(Routes.ME);
					}
				}
				break;
			}
			case QuickSwitcherResultTypes.SETTINGS: {
				const initialTab = result.settingsTab.type;
				const initialSubtab = result.settingsSubtab?.type;

				ModalActionCreators.push(
					modal(() => <UserSettingsModal initialTab={initialTab} initialSubtab={initialSubtab} />),
				);
				break;
			}
			case QuickSwitcherResultTypes.QUICK_ACTION: {
				result.action();
				break;
			}
			case QuickSwitcherResultTypes.LINK: {
				const parsed = parseMessagePath(result.path);
				if (parsed) {
					goToMessage(parsed.channelId, parsed.messageId);
				} else {
					RouterUtils.transitionTo(result.path);
				}
				break;
			}
			default:
				break;
		}
	} finally {
		hide();
	}
};

export const getModalKey = (): string => QUICK_SWITCHER_MODAL_KEY;
