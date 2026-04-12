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

import {ExclamationMarkIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import React from 'react';
import {useDrop} from 'react-dnd';
import * as DimensionActionCreators from '~/actions/DimensionActionCreators';
import * as UserSettingsActionCreators from '~/actions/UserSettingsActionCreators';
import {ChannelTypes} from '~/Constants';
import {DND_TYPES, type GuildDragItem, type GuildDropResult} from '~/components/layout/types/dnd';
import {openClaimAccountModal} from '~/components/modals/ClaimAccountModal';
import {Tooltip} from '~/components/uikit/Tooltip/Tooltip';
import {ComponentDispatch} from '~/lib/ComponentDispatch';
import {Platform} from '~/lib/Platform';
import {useLocation} from '~/lib/router';
import {Routes} from '~/Routes';
import type {ChannelRecord} from '~/records/ChannelRecord';
import CallStateStore from '~/stores/CallStateStore';
import ChannelStore from '~/stores/ChannelStore';
import DimensionStore from '~/stores/DimensionStore';
import GuildAvailabilityStore from '~/stores/GuildAvailabilityStore';
import GuildFolderExpandedStore from '~/stores/GuildFolderExpandedStore';
import GuildListStore, {type OrganizedItem} from '~/stores/GuildListStore';
import GuildReadStateStore from '~/stores/GuildReadStateStore';
import InitializationStore from '~/stores/InitializationStore';
import MobileLayoutStore from '~/stores/MobileLayoutStore';
import NagbarStore from '~/stores/NagbarStore';
import ReadStateStore from '~/stores/ReadStateStore';
import UserSettingsStore, {type GuildFolder, DEFAULT_GUILD_FOLDER_ICON, UNCATEGORIZED_FOLDER_ID} from '~/stores/UserSettingsStore';
import UserStore from '~/stores/UserStore';
import MediaEngineStore from '~/stores/voice/MediaEngineFacade';
import * as SnowflakeUtils from '~/utils/SnowflakeUtils';
import {useActiveNagbars, useNagbarConditions} from './app-layout/hooks';
import {NagbarContainer} from './app-layout/NagbarContainer';
import {TopNagbarContext} from './app-layout/TopNagbarContext';
import styles from './GuildsLayout.module.css';
import {AddGuildButton} from './guild-list/AddGuildButton';
import {DownloadButton} from './guild-list/DownloadButton';
import {GuildFolderItem} from './guild-list/GuildFolderItem';
import {HomeButton} from './guild-list/HomeButton';
import {DMListItem} from './guild-list/GuildListDMItem';
import {GuildListItem} from './guild-list/GuildListItem';
import {MobileMentionToast} from './MobileMentionToast';
import {OutlineFrame} from './OutlineFrame';
import {ScrollIndicatorOverlay} from './ScrollIndicatorOverlay';
import {UserArea} from './UserArea';

const isSelectedPath = (pathname: string, path: string) => {
	return pathname.startsWith(path);
};

const DM_LIST_REMOVAL_DELAY_MS = 750;

const getUnreadDMChannels = () => {
	const dmChannels = ChannelStore.dmChannels;
	return dmChannels.filter((channel) => ReadStateStore.hasUnread(channel.id));
};

function getOrganizedItemKey(item: OrganizedItem): string {
	if (item.type === 'folder') {
		return `folder-${item.folder.id}`;
	}
	return item.guild.id;
}

function cloneGuildFolder(folder: GuildFolder): GuildFolder {
	return {
		id: folder.id,
		name: folder.name,
		color: folder.color,
		flags: folder.flags,
		icon: folder.icon,
		guildIds: [...folder.guildIds],
	};
}

function getFolderIdFromKey(itemKey: string): number | null {
	if (!itemKey.startsWith('folder-')) return null;
	const folderIdRaw = itemKey.slice('folder-'.length);
	if (folderIdRaw === 'null') return null;
	const parsedFolderId = Number(folderIdRaw);
	if (Number.isNaN(parsedFolderId)) return null;
	return parsedFolderId;
}

function getNextFolderId(guildFolders: ReadonlyArray<GuildFolder>): number {
	let maxId = 0;
	for (const folder of guildFolders) {
		if (folder.id !== null && folder.id > maxId) {
			maxId = folder.id;
		}
	}
	return maxId + 1;
}

interface TopLevelGuildItem {
	type: 'guild';
	guildId: string;
}

interface TopLevelGuildFolderItem {
	type: 'folder';
	folder: GuildFolder;
}

type TopLevelItem = TopLevelGuildItem | TopLevelGuildFolderItem;

function buildTopLevelItems(guildFolders: ReadonlyArray<GuildFolder>): Array<TopLevelItem> {
	const topLevelItems: Array<TopLevelItem> = [];
	for (const folder of guildFolders) {
		if (folder.id === UNCATEGORIZED_FOLDER_ID) {
			for (const guildId of folder.guildIds) {
				topLevelItems.push({type: 'guild', guildId});
			}
			continue;
		}
		if (folder.guildIds.length === 0) continue;
		topLevelItems.push({type: 'folder', folder: cloneGuildFolder(folder)});
	}
	return topLevelItems;
}

function buildGuildFoldersFromTopLevelItems(topLevelItems: ReadonlyArray<TopLevelItem>): Array<GuildFolder> {
	const guildFolders: Array<GuildFolder> = [];
	let pendingUncategorizedGuildIds: Array<string> = [];

	function flushUncategorized(): void {
		if (pendingUncategorizedGuildIds.length === 0) return;
		guildFolders.push({
			id: UNCATEGORIZED_FOLDER_ID,
			name: null,
			color: null,
			flags: 0,
			icon: DEFAULT_GUILD_FOLDER_ICON,
			guildIds: pendingUncategorizedGuildIds,
		});
		pendingUncategorizedGuildIds = [];
	}

	for (const topLevelItem of topLevelItems) {
		if (topLevelItem.type === 'guild') {
			pendingUncategorizedGuildIds.push(topLevelItem.guildId);
			continue;
		}
		flushUncategorized();
		if (topLevelItem.folder.guildIds.length === 0) continue;
		guildFolders.push(cloneGuildFolder(topLevelItem.folder));
	}

	flushUncategorized();
	return guildFolders;
}

function removeGuildIdsFromGuildFolders(
	guildFolders: ReadonlyArray<GuildFolder>,
	guildIdsToRemove: ReadonlySet<string>,
): Array<GuildFolder> {
	return guildFolders
		.map((folder) => ({
			...folder,
			guildIds: folder.guildIds.filter((guildId) => !guildIdsToRemove.has(guildId)),
		}))
		.filter((folder) => folder.guildIds.length > 0);
}

interface BottomDropZoneProps {
	onGuildDrop: (item: GuildDragItem, result: GuildDropResult) => void;
	lastItemKey: string;
	lastItemIsFolder: boolean;
	isDragging: boolean;
}

function BottomDropZone({onGuildDrop, lastItemKey, lastItemIsFolder, isDragging}: BottomDropZoneProps) {
	const [{isOver, canDrop}, dropRef] = useDrop(
		() => ({
			accept: [DND_TYPES.GUILD_ITEM, DND_TYPES.GUILD_FOLDER],
			drop: (item: GuildDragItem): GuildDropResult => {
				const result: GuildDropResult = {
					targetId: lastItemKey,
					position: 'after',
					targetIsFolder: lastItemIsFolder,
				};
				onGuildDrop(item, result);
				return result;
			},
			collect: (monitor) => ({
				isOver: monitor.isOver(),
				canDrop: monitor.canDrop(),
			}),
		}),
		[onGuildDrop, lastItemKey, lastItemIsFolder],
	);

	const isActive = isOver && canDrop;

	const setRef = React.useCallback(
		(node: HTMLDivElement | null) => {
			dropRef(node);
		},
		[dropRef],
	);

	return (
		<div
			ref={setRef}
			className={styles.guildListDropZone}
		/>
	);
}

const GuildList = observer(() => {
	const {t} = useLingui();
	const [isDragging, setIsDragging] = React.useState(false);
	const guilds = GuildListStore.guilds;
	const organizedItems = GuildListStore.getOrganizedGuildList();
	const unavailableGuilds = GuildAvailabilityStore.unavailableGuilds;
	const unreadDMChannelsRaw = getUnreadDMChannels();
	const unreadDMChannelIds = unreadDMChannelsRaw.map((c) => c.id).join(',');
	const unreadDMChannels = React.useMemo(() => unreadDMChannelsRaw, [unreadDMChannelIds]);
	const scrollRef = React.useRef<HTMLDivElement>(null);
	const location = useLocation();
	const hasUnavailableGuilds = unavailableGuilds.size > 0;
	const unavailableCount = unavailableGuilds.size;
	const guildReadVersion = GuildReadStateStore.version;
	const readVersion = ReadStateStore.version;
	const guildIndicatorDependencies = React.useMemo(
		() => [guilds.length, guildReadVersion, readVersion, unreadDMChannelIds],
		[guilds.length, guildReadVersion, readVersion, unreadDMChannelIds],
	);
	const getGuildScrollContainer = React.useCallback(() => scrollRef.current, []);
	const [visibleDMChannels, setVisibleDMChannels] = React.useState(unreadDMChannels);
	const pinnedCallChannel =
		MediaEngineStore.connected && MediaEngineStore.channelId
			? (() => {
					const channel = ChannelStore.getChannel(MediaEngineStore.channelId);
					if (!channel) return null;
					if (channel.type !== ChannelTypes.DM && channel.type !== ChannelTypes.GROUP_DM) return null;
					const hasActiveCall = CallStateStore.hasActiveCall(channel.id);
					if (!hasActiveCall) return null;
					return channel;
				})()
			: null;
	const filteredDMChannels = pinnedCallChannel
		? visibleDMChannels.filter((channel) => channel.id !== pinnedCallChannel.id)
		: visibleDMChannels;
	const hasVisibleDMChannels = filteredDMChannels.length > 0 || Boolean(pinnedCallChannel);
	const shouldShowTopDivider = (guilds.length > 0 || hasUnavailableGuilds) && !hasVisibleDMChannels;
	const shouldShowEmptyStateDivider = !hasVisibleDMChannels && !hasUnavailableGuilds && guilds.length === 0;
	const removalTimers = React.useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

	React.useEffect(() => {
		const unreadIds = new Set(unreadDMChannels.map((channel) => channel.id));

		setVisibleDMChannels((current) => {
			const leftover = current.filter((channel) => !unreadIds.has(channel.id));

			for (const channel of leftover) {
				if (!removalTimers.current.has(channel.id)) {
					const timer = setTimeout(() => {
						removalTimers.current.delete(channel.id);
						setVisibleDMChannels((latest) => latest.filter((latestChannel) => latestChannel.id !== channel.id));
					}, DM_LIST_REMOVAL_DELAY_MS);
					removalTimers.current.set(channel.id, timer);
				}
			}

			return [...unreadDMChannels, ...leftover];
		});

		for (const channel of unreadDMChannels) {
			const timer = removalTimers.current.get(channel.id);
			if (timer) {
				clearTimeout(timer);
				removalTimers.current.delete(channel.id);
			}
		}
	}, [unreadDMChannels]);

	React.useEffect(() => {
		return () => {
			removalTimers.current.forEach((timer) => clearTimeout(timer));
			removalTimers.current.clear();
		};
	}, []);

	const renderDMListItems = (channels: Array<ChannelRecord>) =>
		channels.map((channel, index) => {
			const isSelected = isSelectedPath(location.pathname, Routes.dmChannel(channel.id));
			const isLastItem = index === channels.length - 1;

			return (
				<div key={channel.id} className={styles.dmListItemWrapper}>
					<DMListItem
						channel={channel}
						isSelected={isSelected}
						className={isLastItem ? styles.guildListItemNoMargin : undefined}
					/>
				</div>
			);
		});

	const handleGuildDrop = React.useCallback(
		(item: GuildDragItem, result: GuildDropResult) => {
			const sourceKey = item.id;
			const targetKey = result.targetId;
			if (sourceKey === targetKey) return;

			const {position, targetIsFolder, targetFolderId} = result;

			if (position === 'inside' && targetIsFolder && !item.isFolder) {
				const sourceGuildId = item.id;
				const parsedTargetFolderId = getFolderIdFromKey(targetKey);
				const cleaned = removeGuildIdsFromGuildFolders(UserSettingsStore.guildFolders, new Set([sourceGuildId]));
				const newGuildFolders = cleaned.map((folder) => {
					if (folder.id !== parsedTargetFolderId) return folder;
					return {...folder, guildIds: [...folder.guildIds, sourceGuildId]};
				});
				UserSettingsActionCreators.update({guildFolders: newGuildFolders});
				return;
			}

			if (
				targetFolderId != null &&
				targetFolderId !== UNCATEGORIZED_FOLDER_ID &&
				!item.isFolder &&
				(position === 'before' || position === 'after')
			) {
				const sourceGuildId = item.id;
				const targetGuildId = targetKey;
				const cleaned = removeGuildIdsFromGuildFolders(UserSettingsStore.guildFolders, new Set([sourceGuildId]));
				const newGuildFolders = cleaned.map((folder) => {
					if (folder.id !== targetFolderId) return folder;
					const guildIds = [...folder.guildIds];
					const targetIdx = guildIds.indexOf(targetGuildId);
					if (targetIdx !== -1) {
						const insertIdx = position === 'after' ? targetIdx + 1 : targetIdx;
						guildIds.splice(insertIdx, 0, sourceGuildId);
					} else {
						guildIds.push(sourceGuildId);
					}
					return {...folder, guildIds};
				});
				UserSettingsActionCreators.update({guildFolders: newGuildFolders});
				return;
			}

			if (position === 'combine' && !targetIsFolder && !item.isFolder && result.targetFolderId == null) {
				const sourceGuildId = item.id;
				const targetGuildId = targetKey;
				const cleaned = removeGuildIdsFromGuildFolders(UserSettingsStore.guildFolders, new Set([sourceGuildId]));
				const topLevelItems = buildTopLevelItems(cleaned);
				const targetIdx = topLevelItems.findIndex((tli) => tli.type === 'guild' && tli.guildId === targetGuildId);
				if (targetIdx === -1) return;
				const newFolderId = getNextFolderId(UserSettingsStore.guildFolders);
				if (GuildFolderExpandedStore.isExpanded(newFolderId)) {
					GuildFolderExpandedStore.toggleExpanded(newFolderId);
				}
				const newFolder: GuildFolder = {
					id: newFolderId,
					name: null,
					color: null,
					flags: 0,
					icon: DEFAULT_GUILD_FOLDER_ICON,
					guildIds: [targetGuildId, sourceGuildId],
				};
				topLevelItems[targetIdx] = {type: 'folder', folder: newFolder};
				const newGuildFolders = buildGuildFoldersFromTopLevelItems(topLevelItems);
				UserSettingsActionCreators.update({guildFolders: newGuildFolders});
				return;
			}

			if (
				!item.isFolder &&
				item.folderId != null &&
				item.folderId !== UNCATEGORIZED_FOLDER_ID &&
				targetIsFolder &&
				(position === 'before' || position === 'after')
			) {
				const sourceGuildId = item.id;
				const parsedTargetFolderId = getFolderIdFromKey(targetKey);
				const originalTopLevelItems = buildTopLevelItems(UserSettingsStore.guildFolders);
				const originalTargetIdx = originalTopLevelItems.findIndex(
					(tli) => tli.type === 'folder' && tli.folder.id === parsedTargetFolderId,
				);
				if (originalTargetIdx === -1) return;
				const cleaned = removeGuildIdsFromGuildFolders(UserSettingsStore.guildFolders, new Set([sourceGuildId]));
				const topLevelItems = buildTopLevelItems(cleaned);
				let targetIdx = topLevelItems.findIndex(
					(tli) => tli.type === 'folder' && tli.folder.id === parsedTargetFolderId,
				);
				if (targetIdx === -1) {
					targetIdx = Math.min(originalTargetIdx, topLevelItems.length);
				}
				const newItem: TopLevelGuildItem = {type: 'guild', guildId: sourceGuildId};
				const insertIdx = position === 'after' ? targetIdx + 1 : targetIdx;
				topLevelItems.splice(Math.min(insertIdx, topLevelItems.length), 0, newItem);
				const newGuildFolders = buildGuildFoldersFromTopLevelItems(topLevelItems);
				UserSettingsActionCreators.update({guildFolders: newGuildFolders});
				return;
			}

			if (
				!item.isFolder &&
				item.folderId != null &&
				item.folderId !== UNCATEGORIZED_FOLDER_ID &&
				!targetIsFolder &&
				result.targetFolderId == null &&
				(position === 'before' || position === 'after')
			) {
				const sourceGuildId = item.id;
				const targetGuildId = targetKey;
				const cleaned = removeGuildIdsFromGuildFolders(UserSettingsStore.guildFolders, new Set([sourceGuildId]));
				const topLevelItems = buildTopLevelItems(cleaned);
				const targetIdx = topLevelItems.findIndex((tli) => tli.type === 'guild' && tli.guildId === targetGuildId);
				if (targetIdx === -1) return;
				const newItem: TopLevelGuildItem = {type: 'guild', guildId: sourceGuildId};
				const insertIdx = position === 'after' ? targetIdx + 1 : targetIdx;
				topLevelItems.splice(insertIdx, 0, newItem);
				const newGuildFolders = buildGuildFoldersFromTopLevelItems(topLevelItems);
				UserSettingsActionCreators.update({guildFolders: newGuildFolders});
				return;
			}

			const oldIndex = organizedItems.findIndex((i) => getOrganizedItemKey(i) === sourceKey);
			const targetIndex = organizedItems.findIndex((i) => getOrganizedItemKey(i) === targetKey);
			if (oldIndex === -1 || targetIndex === -1) return;

			let newIndex = position === 'after' ? targetIndex + 1 : targetIndex;
			if (oldIndex < targetIndex && position === 'after') newIndex--;

			const newOrganizedItems = [...organizedItems];
			const [movedItem] = newOrganizedItems.splice(oldIndex, 1);
			newOrganizedItems.splice(newIndex, 0, movedItem);

			const topLevelItems: Array<TopLevelItem> = newOrganizedItems.map((oi) => {
				if (oi.type === 'folder') {
					return {type: 'folder' as const, folder: cloneGuildFolder(oi.folder)};
				}
				return {type: 'guild' as const, guildId: oi.guild.id};
			});
			const newGuildFolders = buildGuildFoldersFromTopLevelItems(topLevelItems);
			UserSettingsActionCreators.update({guildFolders: newGuildFolders});
		},
		[organizedItems],
	);

	const handleDragStateChange = React.useCallback((item: GuildDragItem | null) => {
		setIsDragging(item !== null);
	}, []);

	const handleScroll = React.useCallback((event: React.UIEvent<HTMLDivElement>) => {
		const scrollTop = event.currentTarget.scrollTop;
		DimensionActionCreators.updateGuildListScroll(scrollTop);
	}, []);

	React.useEffect(() => {
		const scrollTop = DimensionStore.getGuildListDimensions().scrollTop;
		if (scrollTop > 0 && scrollRef.current) {
			scrollRef.current.scrollTop = scrollTop;
		}
	}, []);

	return (
		<div ref={scrollRef} className={styles.guildListScrollContainer} onScroll={handleScroll}>
			<div className={styles.guildListContent}>
				<div className={styles.guildListTopSection}>
					<HomeButton />

					<div className={styles.dmListSection}>
						{pinnedCallChannel && (
							<div className={styles.dmListItemWrapper} key={`pinned-call-${pinnedCallChannel.id}`}>
								<DMListItem
									channel={pinnedCallChannel}
									isSelected={isSelectedPath(location.pathname, Routes.dmChannel(pinnedCallChannel.id))}
									voiceCallActive
								/>
							</div>
						)}
						{renderDMListItems(filteredDMChannels)}
					</div>

					{hasVisibleDMChannels && <div className={styles.guildDivider} />}
				</div>

				<div className={styles.guildListGuildsSection}>
					{hasUnavailableGuilds && (
						<Tooltip
							position="right"
							type={'error'}
							maxWidth="xl"
							size="large"
							text={() =>
								unavailableCount === 1
									? t`${unavailableCount} community is temporarily unavailable.`
									: t`${unavailableCount} communities are temporarily unavailable.`
							}
						>
							<div className={styles.unavailableContainer}>
								<div className={styles.unavailableBadge}>
									<ExclamationMarkIcon weight="regular" className={styles.unavailableIcon} />
								</div>
							</div>
						</Tooltip>
					)}

					{shouldShowTopDivider && <div className={styles.guildDivider} />}

					{organizedItems.length > 0 && (
						<div className={styles.guildListItems}>
							{(() => {
								const selectedGuildIndex = guilds.findIndex((g) =>
									isSelectedPath(location.pathname, Routes.guildChannel(g.id)),
								);
								return organizedItems.map((item, index) => {
									if (item.type === 'folder') {
										const isFolderSelected = item.guilds.some((guild) =>
											isSelectedPath(location.pathname, Routes.guildChannel(guild.id)),
										);
										return (
											<GuildFolderItem
												key={getOrganizedItemKey(item)}
												folder={item.folder}
												guilds={item.guilds}
												isSelected={isFolderSelected}
												onGuildDrop={handleGuildDrop}
												onDragStateChange={handleDragStateChange}
											/>
										);
									}
									return (
										<GuildListItem
											key={item.guild.id}
											isSortingList={isDragging}
											guild={item.guild}
											isSelected={isSelectedPath(location.pathname, Routes.guildChannel(item.guild.id))}
											guildIndex={index}
											selectedGuildIndex={selectedGuildIndex}
											onGuildDrop={handleGuildDrop}
											onDragStateChange={handleDragStateChange}
										/>
									);
								});
							})()}

							<BottomDropZone
								onGuildDrop={handleGuildDrop}
								lastItemKey={getOrganizedItemKey(organizedItems[organizedItems.length - 1])}
								lastItemIsFolder={organizedItems[organizedItems.length - 1].type === 'folder'}
								isDragging={isDragging}
							/>
						</div>
					)}

					{shouldShowEmptyStateDivider && <div className={styles.guildDivider} />}

					<AddGuildButton />
					{!Platform.isElectron && !Platform.isPWA && <DownloadButton />}
				</div>
			</div>
			<ScrollIndicatorOverlay
				getScrollContainer={getGuildScrollContainer}
				dependencies={guildIndicatorDependencies}
				label={t`New`}
			/>
		</div>
	);
});

export const GuildsLayout = observer(({children}: {children: React.ReactNode}) => {
	const mobileLayout = MobileLayoutStore;
	const user = UserStore.currentUser;
	const location = useLocation();
	const showGuildListOnMobile =
		mobileLayout.enabled &&
		(location.pathname === Routes.ME ||
			(Routes.isChannelRoute(location.pathname) && location.pathname.split('/').length === 3));

	const showBottomNav =
		mobileLayout.enabled &&
		(location.pathname === Routes.ME ||
			location.pathname === Routes.NOTIFICATIONS ||
			location.pathname === Routes.YOU ||
			(Routes.isGuildChannelRoute(location.pathname) && location.pathname.split('/').length === 3));

	const nagbarConditions = useNagbarConditions();
	const activeNagbars = useActiveNagbars(nagbarConditions);
	const prevNagbarCount = React.useRef(activeNagbars.length);
	const isReady = InitializationStore.isReady;

	React.useEffect(() => {
		if (prevNagbarCount.current !== activeNagbars.length) {
			prevNagbarCount.current = activeNagbars.length;
			ComponentDispatch.dispatch('LAYOUT_RESIZED');
		}
	}, [activeNagbars.length]);

	const THIRTY_MINUTES_MS = 30 * 60 * 1000;
	React.useEffect(() => {
		if (!isReady) return;
		if (!user) return;
		if (NagbarStore.claimAccountModalShownThisSession) return;
		if (user.isClaimed()) return;
		const accountAgeMs = SnowflakeUtils.age(user.id);
		if (accountAgeMs < THIRTY_MINUTES_MS) return;

		NagbarStore.markClaimAccountModalShown();
		openClaimAccountModal();
	}, [isReady, user, location.pathname]);

	const shouldShowSidebarDivider = !mobileLayout.enabled;

	const hasNagbars = activeNagbars.length > 0;

	return (
		<div
			className={clsx(
				hasNagbars ? styles.guildsLayoutContainerWithNagbar : styles.guildsLayoutContainer,
				mobileLayout.enabled && !showGuildListOnMobile && styles.guildsLayoutContainerMobile,
				showBottomNav && styles.guildsLayoutReserveMobileBottomNav,
			)}
		>
			{hasNagbars && (
				<div className={styles.nagbarRow}>
					<NagbarContainer nagbars={activeNagbars} />
				</div>
			)}
			{(!mobileLayout.enabled || showGuildListOnMobile) && <GuildList />}
			<div
				className={clsx(
					styles.contentContainer,
					mobileLayout.enabled && !showGuildListOnMobile && styles.contentContainerMobile,
				)}
			>
				<TopNagbarContext.Provider value={hasNagbars}>
					<OutlineFrame
						className={styles.outlineFrame}
						sidebarDivider={shouldShowSidebarDivider}
						topBanner={<MobileMentionToast />}
					>
						<div className={styles.contentInner}>{children}</div>
					</OutlineFrame>
				</TopNagbarContext.Provider>
			</div>
		</div>
	);
});
