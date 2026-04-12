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
import {
	BookmarkSimpleIcon,
	FolderIcon,
	GameControllerIcon,
	HeartIcon,
	MusicNoteIcon,
	ShieldIcon,
	StarIcon,
} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {AnimatePresence, motion} from 'framer-motion';
import {observer} from 'mobx-react-lite';
import type {CSSProperties} from 'react';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {ConnectableElement} from 'react-dnd';
import {useDrag, useDrop} from 'react-dnd';
import {getEmptyImage} from 'react-dnd-html5-backend';
import * as ContextMenuActionCreators from '~/actions/ContextMenuActionCreators';
import {computeVerticalDropPosition} from '~/components/layout/dnd/DndDropPosition';
import {GuildListItem} from '~/components/layout/guild-list/GuildListItem';
import {VoiceBadge} from '~/components/layout/guild-list/VoiceBadge';
import {DND_TYPES, type GuildDragItem, type GuildDropResult} from '~/components/layout/types/dnd';
import {GuildFolderContextMenu} from '~/components/uikit/ContextMenu/GuildFolderContextMenu';
import FocusRing from '~/components/uikit/FocusRing/FocusRing';
import {MentionBadgeAnimated} from '~/components/uikit/MentionBadge';
import {Tooltip} from '~/components/uikit/Tooltip';
import {useHover} from '~/hooks/useHover';
import {useMergeRefs} from '~/hooks/useMergeRefs';
import {useLocation} from '~/lib/router';
import type {GuildRecord} from '~/records/GuildRecord';
import {Routes} from '~/Routes';
import AccessibilityStore from '~/stores/AccessibilityStore';
import GuildFolderExpandedStore from '~/stores/GuildFolderExpandedStore';
import GuildReadStateStore from '~/stores/GuildReadStateStore';
import MobileLayoutStore from '~/stores/MobileLayoutStore';
import {
	type GuildFolder,
	GuildFolderFlags,
	type GuildFolderIcon,
	GuildFolderIcons,
	UNCATEGORIZED_FOLDER_ID,
} from '~/stores/UserSettingsStore';
import MediaEngineStore from '~/stores/voice/MediaEngineFacade';
import * as AvatarUtils from '~/utils/AvatarUtils';
import * as StringUtils from '~/utils/StringUtils';
import styles from './GuildFolderItem.module.css';

interface GuildFolderItemProps {
	folder: GuildFolder;
	guilds: Array<GuildRecord>;
	isSelected: boolean;
	onGuildDrop?: (item: GuildDragItem, result: GuildDropResult) => void;
	onDragStateChange?: (item: GuildDragItem | null) => void;
}

function getFolderColor(color: number | null): string {
	if (color === null || color === 0) {
		return 'var(--cell-color)';
	}
	return `#${color.toString(16).padStart(6, '0')}`;
}

function shouldShowCollapsedFolderIcon(flags: number): boolean {
	return (flags & GuildFolderFlags.SHOW_ICON_WHEN_COLLAPSED) === GuildFolderFlags.SHOW_ICON_WHEN_COLLAPSED;
}

function renderCollapsedFolderIcon(icon: GuildFolderIcon) {
	switch (icon) {
		case GuildFolderIcons.STAR:
			return <StarIcon weight="fill" className={styles.folderIcon} />;
		case GuildFolderIcons.HEART:
			return <HeartIcon weight="fill" className={styles.folderIcon} />;
		case GuildFolderIcons.BOOKMARK:
			return <BookmarkSimpleIcon weight="fill" className={styles.folderIcon} />;
		case GuildFolderIcons.GAME_CONTROLLER:
			return <GameControllerIcon weight="fill" className={styles.folderIcon} />;
		case GuildFolderIcons.SHIELD:
			return <ShieldIcon weight="fill" className={styles.folderIcon} />;
		case GuildFolderIcons.MUSIC_NOTE:
			return <MusicNoteIcon weight="fill" className={styles.folderIcon} />;
		default:
			return <FolderIcon weight="fill" className={styles.folderIcon} />;
	}
}

export const GuildFolderItem = observer(({folder, guilds, onGuildDrop, onDragStateChange}: GuildFolderItemProps) => {
	const {t} = useLingui();
	const location = useLocation();
	const isExpanded = GuildFolderExpandedStore.isExpanded(folder.id ?? UNCATEGORIZED_FOLDER_ID);
	const [hoverRef, isHovering] = useHover();
	const focusableRef = useRef<HTMLDivElement | null>(null);
	const focusRingTargetRef = useRef<HTMLDivElement | null>(null);
	const itemRef = useRef<HTMLElement | null>(null);
	const mobileLayout = MobileLayoutStore;
	const [dropIndicator, setDropIndicator] = useState<'top' | 'bottom' | 'inside' | null>(null);

	const derivedFolderName = useMemo(() => {
		return guilds
			.slice(0, 3)
			.map((guild) => guild.name)
			.join(', ');
	}, [guilds]);
	const folderName = folder.name || derivedFolderName || t`Folder`;
	const folderColor = getFolderColor(folder.color);
	const folderId = `folder-${folder.id}`;
	const folderAccentStyle = useMemo<CSSProperties>(
		() =>
			({
				'--folder-accent': folderColor,
			}) as CSSProperties,
		[folderColor],
	);

	const hasUnreadMessages = useMemo(() => {
		return guilds.some((guild) => GuildReadStateStore.hasUnread(guild.id));
	}, [guilds]);

	const totalMentionCount = useMemo(() => {
		return guilds.reduce((sum, guild) => sum + GuildReadStateStore.getMentionCount(guild.id), 0);
	}, [guilds]);

	const allVoiceStates = MediaEngineStore.getAllVoiceStates();
	const hasVoiceActivity = useMemo(() => {
		for (const guild of guilds) {
			const guildVoiceStates = allVoiceStates[guild.id];
			if (!guildVoiceStates) continue;
			for (const channelStates of Object.values(guildVoiceStates)) {
				if (Object.keys(channelStates).length > 0) return true;
			}
		}
		return false;
	}, [allVoiceStates, guilds]);

	const folderAriaLabel = useMemo(() => {
		if (isExpanded) return t`${folderName} (expanded)`;
		return folderName;
	}, [folderName, isExpanded, t]);

	const dragItemData = useMemo<GuildDragItem>(
		() => ({
			type: DND_TYPES.GUILD_FOLDER,
			id: folderId,
			isFolder: true,
			folderId: folder.id,
		}),
		[folderId, folder.id],
	);

	const [{isDragging}, dragRef, preview] = useDrag(
		() => ({
			type: DND_TYPES.GUILD_FOLDER,
			item: () => {
				onDragStateChange?.(dragItemData);
				return dragItemData;
			},
			canDrag: !mobileLayout.enabled,
			collect: (monitor) => ({isDragging: monitor.isDragging()}),
			end: () => {
				onDragStateChange?.(null);
				setDropIndicator(null);
			},
		}),
		[dragItemData, mobileLayout.enabled, onDragStateChange],
	);

	const [{isOver}, dropRef] = useDrop(
		() => ({
			accept: [DND_TYPES.GUILD_ITEM, DND_TYPES.GUILD_FOLDER],
			canDrop: (item: GuildDragItem) => {
				if (item.id === folderId) return false;
				return true;
			},
			hover: (item: GuildDragItem, monitor) => {
				if (item.id === folderId) {
					setDropIndicator(null);
					return;
				}
				const node = itemRef.current;
				if (!node) return;
				const clientOffset = monitor.getClientOffset();
				if (!clientOffset) return;
				const boundingRect = node.getBoundingClientRect();
				const dropPos = computeVerticalDropPosition(clientOffset, boundingRect, item.isFolder ? 0.5 : 0.1);

				if (dropPos === 'center') {
					setDropIndicator('inside');
				} else {
					setDropIndicator(dropPos === 'before' ? 'top' : 'bottom');
				}
			},
			drop: (item: GuildDragItem, monitor): GuildDropResult | undefined => {
				if (!monitor.canDrop()) {
					setDropIndicator(null);
					return;
				}
				const node = itemRef.current;
				if (!node) return;
				const clientOffset = monitor.getClientOffset();
				if (!clientOffset) return;
				const boundingRect = node.getBoundingClientRect();
				const dropPos = computeVerticalDropPosition(clientOffset, boundingRect, item.isFolder ? 0.5 : 0.1);

				let position: 'before' | 'after' | 'inside';
				if (dropPos === 'center') {
					position = 'inside';
				} else {
					position = dropPos;
				}

				const result: GuildDropResult = {
					targetId: folderId,
					position,
					targetIsFolder: true,
				};
				onGuildDrop?.(item, result);
				setDropIndicator(null);
				return result;
			},
			collect: (monitor) => ({
				isOver: monitor.isOver({shallow: true}),
			}),
		}),
		[folderId, onGuildDrop],
	);

	useEffect(() => {
		if (!isOver) setDropIndicator(null);
	}, [isOver]);

	useEffect(() => {
		preview(getEmptyImage(), {captureDraggingState: true});
	}, [preview]);

	const dragConnectorRef = useCallback(
		(node: ConnectableElement | null) => {
			dragRef(node);
		},
		[dragRef],
	);
	const dropConnectorRef = useCallback(
		(node: ConnectableElement | null) => {
			dropRef(node);
		},
		[dropRef],
	);
	const dndRef = useMergeRefs([dragConnectorRef, dropConnectorRef, itemRef]);
	const innerRef = useMergeRefs([hoverRef, focusableRef]);

	const handleToggleExpanded = useCallback(() => {
		GuildFolderExpandedStore.toggleExpanded(folder.id ?? UNCATEGORIZED_FOLDER_ID);
	}, [folder.id]);

	const handleKeyDown = useCallback(
		(event: React.KeyboardEvent) => {
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				handleToggleExpanded();
			}
		},
		[handleToggleExpanded],
	);

	const handleContextMenu = useCallback(
		(event: React.MouseEvent) => {
			event.preventDefault();
			event.stopPropagation();

			ContextMenuActionCreators.openFromEvent(event, (props) => (
				<GuildFolderContextMenu folder={folder} guilds={guilds} onClose={props.onClose} />
			));
		},
		[folder, guilds],
	);

	const handleBadgePointerDown = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
		event.stopPropagation();
	}, []);

	const handleBadgeClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
		event.stopPropagation();
	}, []);

	const shouldShowHoverState = isHovering;
	const indicatorHeight = shouldShowHoverState ? 20 : 8;

	const prefersReducedMotion = AccessibilityStore.useReducedMotion;
	const firstFourGuilds = guilds.slice(0, 4);
	const showCollapsedIcon = shouldShowCollapsedFolderIcon(folder.flags);

	const tooltipText = useMemo(() => {
		return isExpanded ? t`Collapse ${folderName}` : folderName;
	}, [isExpanded, folderName, t]);

	const expandTransition = useMemo(
		() => (prefersReducedMotion ? {duration: 0} : {duration: 0.2, ease: [0.25, 0.1, 0.25, 1] as const}),
		[prefersReducedMotion],
	);

	return (
		<div ref={dndRef} className={styles.folderContainer} style={{...folderAccentStyle, opacity: isDragging ? 0.5 : 1, width: '100%'}}>
			<AnimatePresence initial={false}>
				{isExpanded && (
					<motion.div
						className={styles.expandedFolderBackground}
						initial={prefersReducedMotion ? false : {opacity: 0, width: 48}}
						animate={{opacity: 1, width: 'var(--folder-expanded-surface-size)'}}
						exit={prefersReducedMotion ? undefined : {opacity: 0, width: 48}}
						transition={expandTransition}
					/>
				)}
			</AnimatePresence>

			<Tooltip
				position="right"
				maxWidth="xl"
				size="large"
				text={() => (
					<div className={styles.folderTooltipContainer}>
						<span className={styles.folderTooltipName}>{tooltipText}</span>
					</div>
				)}
			>
				<FocusRing focusTarget={focusableRef} ringTarget={focusRingTargetRef} offset={-2}>
					<div
						className={clsx(
							styles.folderHeader,
							dropIndicator === 'top' && styles.dropIndicatorTop,
							dropIndicator === 'bottom' && styles.dropIndicatorBottom,
							dropIndicator === 'inside' && styles.dropIndicatorInside,
						)}
						ref={innerRef}
						role="button"
						tabIndex={0}
						data-guild-list-focus-item="true"
						aria-label={folderAriaLabel}
						aria-expanded={isExpanded}
						onClick={handleToggleExpanded}
						onContextMenu={handleContextMenu}
						onKeyDown={handleKeyDown}
					>
						{!isExpanded && (
							<AnimatePresence>
								{(hasUnreadMessages || shouldShowHoverState) && (
									<div className={styles.folderIndicator}>
										<motion.span
											className={styles.folderIndicatorBar}
											initial={false}
											animate={{opacity: 1, scale: 1, height: indicatorHeight}}
											exit={{opacity: 0, scale: 0, height: 0}}
											transition={{duration: 0.2, ease: [0.25, 0.1, 0.25, 1]}}
										/>
									</div>
								)}
							</AnimatePresence>
						)}

						<div className={styles.relative} ref={focusRingTargetRef}>
							{isExpanded ? (
								<div className={styles.folderHeaderButton}>{renderCollapsedFolderIcon(folder.icon)}</div>
							) : (
								<>
									{showCollapsedIcon ? (
										<>
											<div className={styles.collapsedFolderBackground} />
											<div className={styles.folderHeaderButton}>{renderCollapsedFolderIcon(folder.icon)}</div>
										</>
									) : (
										<>
											<div className={styles.collapsedFolderBackground} />
											<div className={styles.collapsedFolder}>
												{firstFourGuilds.map((guild) => (
													<MiniGuildIcon key={guild.id} guild={guild} />
												))}
											</div>
										</>
									)}
									{hasVoiceActivity && <VoiceBadge />}
									<button
										type="button"
										tabIndex={-1}
										aria-hidden={true}
										className={clsx(styles.folderBadge, totalMentionCount > 0 && styles.folderBadgeActive)}
										onPointerDown={handleBadgePointerDown}
										onClick={handleBadgeClick}
									>
										<MentionBadgeAnimated mentionCount={totalMentionCount} size="small" />
									</button>
								</>
							)}
						</div>
					</div>
				</FocusRing>
			</Tooltip>

			<AnimatePresence initial={false}>
				{isExpanded && (
					<motion.div
						className={styles.expandedGuilds}
						initial={prefersReducedMotion ? false : {height: 0, opacity: 0, paddingTop: 0, paddingBottom: 0}}
						animate={{height: 'auto', opacity: 1, paddingTop: 4, paddingBottom: 8}}
						exit={prefersReducedMotion ? undefined : {height: 0, opacity: 0, paddingTop: 0, paddingBottom: 0}}
						transition={expandTransition}
						style={{overflow: 'hidden'}}
					>
						{guilds.map((guild) => {
							const isGuildSelected = location.pathname.startsWith(Routes.guildChannel(guild.id));
							return (
								<GuildListItem
									key={guild.id}
									guild={guild}
									isSelected={isGuildSelected}
									onGuildDrop={onGuildDrop}
									onDragStateChange={onDragStateChange}
									insideFolderId={folder.id}
								/>
							);
						})}
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
});

interface MiniGuildIconProps {
	guild: GuildRecord;
}

const MiniGuildIcon = observer(({guild}: MiniGuildIconProps) => {
	const iconUrl = AvatarUtils.getGuildIconURL(guild, false);
	const initials = StringUtils.getInitialsFromName(guild.name);

	if (iconUrl) {
		return <div className={styles.miniGuildIcon} style={{backgroundImage: `url(${iconUrl})`}} />;
	}

	return (
		<div className={clsx(styles.miniGuildIcon, styles.miniGuildIconWithInitials)}>
			<span className={styles.miniGuildInitials}>{initials?.slice(0, 2)}</span>
		</div>
	);
});
