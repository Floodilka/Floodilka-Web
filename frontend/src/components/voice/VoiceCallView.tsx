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

import {
	FloatingFocusManager,
	flip,
	offset,
	shift,
	useClick,
	useDismiss,
	useFloating,
	useInteractions,
	useRole,
} from '@floating-ui/react';
import {useLingui} from '@lingui/react/macro';
import type {TrackReferenceOrPlaceholder} from '@livekit/components-react';
import {
	ParticipantContext,
	TrackRefContext,
	isTrackReference,
	useConnectionState,
	useParticipants,
} from '@livekit/components-react';
import {
	ArrowLeftIcon,
	ArrowsOutIcon,
	ChartBarIcon,
	ListIcon,
	PhoneIcon,
	XIcon,
} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {ConnectionState, type Participant, Track} from 'livekit-client';
import {observer} from 'mobx-react-lite';
import React, {useCallback, useMemo, useRef, useState} from 'react';

import {ChannelHeaderIcon} from '~/components/channel/ChannelHeader/ChannelHeaderIcon';
import {InboxButton} from '~/components/channel/ChannelHeader/UtilityButtons';
import {NativeDragRegion} from '~/components/layout/NativeDragRegion';
import {BottomSheet} from '~/components/uikit/BottomSheet/BottomSheet';
import FocusRing from '~/components/uikit/FocusRing/FocusRing';
import type {ChannelRecord} from '~/records/ChannelRecord';
import ContextMenuStore, {isContextMenuNodeTarget} from '~/stores/ContextMenuStore';
import * as PiPActionCreators from '~/actions/PiPActionCreators';
import KeyboardModeStore from '~/stores/KeyboardModeStore';
import MobileLayoutStore from '~/stores/MobileLayoutStore';
import PiPStore from '~/stores/PiPStore';
import PopoutStore from '~/stores/PopoutStore';
import MediaEngineStore from '~/stores/voice/MediaEngineFacade';
import * as ChannelUtils from '~/utils/ChannelUtils';
import channelHeaderStyles from '../channel/ChannelHeader.module.css';
import {CompactVoiceCallView} from './CompactVoiceCallView';
import {useVoiceCallTracksAndLayout} from './useVoiceCallTracksAndLayout';
import styles from './VoiceCallView.module.css';
import {VoiceControlBar} from './VoiceControlBar';
import {VoiceGridLayout} from './VoiceGridLayout';
import {VoiceParticipantTile} from './VoiceParticipantTile';
import {VoiceStatsOverlay} from './VoiceStatsOverlay';

interface VoiceCallViewProps {
	channel: ChannelRecord;
}

function useConnectionStateText(connectionState: ConnectionState, t: any) {
	return useMemo(() => {
		switch (connectionState) {
			case ConnectionState.Connecting:
				return t`Connecting...`;
			case ConnectionState.Reconnecting:
				return t`Reconnecting...`;
			case ConnectionState.Disconnected:
				return t`Disconnected`;
			default:
				return null;
		}
	}, [connectionState, t]);
}

function useFullscreen(containerRef: React.RefObject<HTMLElement | null>) {
	const [isFullscreen, setIsFullscreen] = useState(false);

	const toggleFullscreen = useCallback(() => {
		const el = containerRef.current;
		if (!el) return;

		if (document.fullscreenElement) {
			document.exitFullscreen().catch(() => {});
			return;
		}

		el.requestFullscreen().catch(() => {});
	}, [containerRef]);

	React.useEffect(() => {
		const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
		document.addEventListener('fullscreenchange', onChange);
		return () => document.removeEventListener('fullscreenchange', onChange);
	}, []);

	return {isFullscreen, toggleFullscreen};
}

const VoiceCallViewInner = observer(({channel}: {channel: ChannelRecord}) => {
	const {t} = useLingui();
	const containerRef = useRef<HTMLDivElement>(null);

	const isMobile = MobileLayoutStore.isMobileLayout();
	const {keyboardModeEnabled} = KeyboardModeStore;

	const [isStatsOpen, setIsStatsOpen] = useState(false);
	const [isCallSheetOpen, setIsCallSheetOpen] = useState(false);

	const participants = useParticipants();
	const participantCount = participants.length;
	const connectionState = useConnectionState();
	const connectionStateText = useConnectionStateText(connectionState, t);

	const isInboxPopoutOpen = PopoutStore.isOpen('inbox');
	const isAnyContextMenuOpen = useMemo(() => {
		const cm = ContextMenuStore.contextMenu;
		const target = cm?.target?.target ?? null;
		const container = containerRef.current;
		if (!cm || !container || !isContextMenuNodeTarget(target)) return false;
		return Boolean(container.contains(target));
	}, [ContextMenuStore.contextMenu]);

	const {isFullscreen, toggleFullscreen} = useFullscreen(containerRef);

	const {
		hasScreenShare,
		screenShareTracks,
		filteredCameraTracks,
		focusMainTrack,
	} = useVoiceCallTracksAndLayout({channel});

	const pipTrack = useMemo<TrackReferenceOrPlaceholder | null>(() => {
		const isActiveVideo = (tr: TrackReferenceOrPlaceholder | null | undefined) => {
			if (!tr) return false;
			if (!isTrackReference(tr)) return false;
			if (tr.source === Track.Source.ScreenShare) return true;
			return Boolean(tr.publication) && !tr.publication.isMuted;
		};

		if (isActiveVideo(focusMainTrack as TrackReferenceOrPlaceholder | null)) {
			return focusMainTrack as TrackReferenceOrPlaceholder;
		}
		if (screenShareTracks.length > 0) return screenShareTracks[0] as TrackReferenceOrPlaceholder;
		const activeCamera = filteredCameraTracks.find(isActiveVideo);
		if (activeCamera) return activeCamera as TrackReferenceOrPlaceholder;
		return null;
	}, [focusMainTrack, screenShareTracks, filteredCameraTracks]);

	const pipSnapshotRef = useRef<{pipTrack: TrackReferenceOrPlaceholder | null}>({pipTrack});
	React.useEffect(() => {
		pipSnapshotRef.current = {pipTrack};
	}, [pipTrack]);

	const openPiPForTrack = useCallback(
		(trackRef: TrackReferenceOrPlaceholder) => {
			const identity = trackRef?.participant?.identity ?? '';
			if (!identity) return;
			const match = identity.match(/^user_(\d+)_(.+)$/);
			const userId = match?.[1] ?? '';
			const connectionId = match?.[2] ?? '';
			if (!userId || !connectionId) return;
			const contentType = trackRef.source === Track.Source.ScreenShare ? 'stream' : 'camera';
			PiPActionCreators.openPiP({
				type: contentType,
				participantIdentity: identity,
				channelId: channel.id,
				guildId: channel.guildId ?? null,
				connectionId,
				userId,
			});
		},
		[channel.id, channel.guildId],
	);

	React.useEffect(() => {
		return () => {
			if (isMobile) return;
			if (!MediaEngineStore.room) return;
			const snapshot = pipSnapshotRef.current;
			if (!snapshot.pipTrack) return;
			openPiPForTrack(snapshot.pipTrack);
		};
	}, [isMobile, openPiPForTrack]);

	const pipOpen = PiPStore.getIsOpen();
	const pipContent = PiPStore.getContent();
	React.useEffect(() => {
		if (pipOpen && pipContent?.channelId === channel.id) {
			PiPActionCreators.closePiP();
		}
	}, [pipOpen, pipContent, channel.id]);

	const {
		refs: statsRefs,
		floatingStyles: statsFloatingStyles,
		context: statsContext,
	} = useFloating({
		open: isStatsOpen,
		onOpenChange: setIsStatsOpen,
		placement: 'bottom-end',
		middleware: [offset(8), flip(), shift({padding: 8})],
	});

	const {getReferenceProps: getStatsReferenceProps, getFloatingProps: getStatsFloatingProps} = useInteractions([
		useClick(statsContext),
		useDismiss(statsContext),
		useRole(statsContext),
	]);
	const statsFloatingProps = isMobile ? {} : getStatsFloatingProps();

	React.useEffect(() => {
		if (!isMobile && isCallSheetOpen) {
			setIsCallSheetOpen(false);
		}
	}, [isCallSheetOpen, isMobile]);

	const handleBackClick = useCallback(() => window.history.back(), []);
	const handleOpenCallSheet = useCallback(() => setIsCallSheetOpen(true), []);
	const handleCloseCallSheet = useCallback(() => setIsCallSheetOpen(false), []);

	// Determine if we're in focus mode (pinned screen share or camera)
	const isInFocusMode = Boolean(focusMainTrack);

	const mainContentNode = useMemo(() => {
		if (isInFocusMode && focusMainTrack) {
			const focusIdentity = focusMainTrack.participant.identity;
			const isScreenShareFocused = screenShareTracks.some(
				(t) => t.participant.identity === focusIdentity,
			);

			// When focusing a camera, exclude it from the carousel
			// When focusing a screen share, it's not in filteredCameraTracks so no filtering needed
			const carouselCameraTracks = isScreenShareFocused
				? filteredCameraTracks
				: filteredCameraTracks.filter((t) => t.participant.identity !== focusIdentity);

			return (
				<div className={styles.gridLayoutWrapperStream}>
					<div className={styles.streamPlayer}>
						<TrackRefContext.Provider value={focusMainTrack as TrackReferenceOrPlaceholder}>
							<ParticipantContext.Provider
								value={(focusMainTrack as TrackReferenceOrPlaceholder).participant as Participant}
							>
								<VoiceParticipantTile
									guildId={channel.guildId}
									channelId={channel.id}
									showFocusIndicator={false}
								/>
							</ParticipantContext.Provider>
						</TrackRefContext.Provider>
					</div>
					<VoiceGridLayout tracks={carouselCameraTracks} horizontal>
						<VoiceParticipantTile guildId={channel.guildId} channelId={channel.id} />
					</VoiceGridLayout>
				</div>
			);
		}

		// Normal grid: all tracks including screen shares in the flex-wrap grid
		const allTracks = hasScreenShare ? [...screenShareTracks, ...filteredCameraTracks] : filteredCameraTracks;
		return (
			<div className={styles.gridLayoutWrapper}>
				<VoiceGridLayout tracks={allTracks}>
					<VoiceParticipantTile guildId={channel.guildId} channelId={channel.id} />
				</VoiceGridLayout>
			</div>
		);
	}, [isInFocusMode, focusMainTrack, hasScreenShare, screenShareTracks, filteredCameraTracks, channel.guildId, channel.id]);

	const statsReferencePropsRaw = getStatsReferenceProps();
	const {ref: _statsRef, onClick: statsOnClickRaw, ...statsReferenceProps} = statsReferencePropsRaw;
	const statsOnClick = statsOnClickRaw as React.MouseEventHandler<HTMLButtonElement> | undefined;

	return (
		<div
			ref={containerRef}
			className={clsx(
				styles.root,
				styles.voiceRoot,
				(isAnyContextMenuOpen || isInboxPopoutOpen || isStatsOpen) && styles.contextMenuActive,
				keyboardModeEnabled && styles.keyboardModeActive,
			)}
		>
			<output className={styles.srOnly} aria-live="polite" aria-atomic="true">
				{participantCount === 1
					? t`${participantCount} participant in call`
					: t`${participantCount} participants in call`}
			</output>

			<NativeDragRegion className={clsx(channelHeaderStyles.headerContainer, styles.voiceChrome, styles.voiceHeader)}>
				<div className={channelHeaderStyles.headerLeftSection}>
					{isMobile ? (
						<FocusRing offset={-2}>
							<button type="button" className={channelHeaderStyles.backButton} onClick={handleBackClick}>
								<ArrowLeftIcon className={channelHeaderStyles.backIconBold} weight="bold" />
							</button>
						</FocusRing>
					) : (
						<FocusRing offset={-2}>
							<button type="button" className={channelHeaderStyles.backButtonDesktop} onClick={handleBackClick}>
								<ListIcon className={channelHeaderStyles.backIcon} />
							</button>
						</FocusRing>
					)}

					<div className={channelHeaderStyles.leftContentContainer}>
						<div className={channelHeaderStyles.channelInfoContainer}>
							{ChannelUtils.getIcon(channel, {className: channelHeaderStyles.channelIcon})}
							<span className={channelHeaderStyles.channelName}>{channel.name ?? ''}</span>
						</div>
					</div>
				</div>

				<div className={channelHeaderStyles.headerRightSection}>
					{connectionStateText && (
						<div
							className={clsx(
								styles.connectionStatusContainer,
								connectionState === ConnectionState.Connecting && styles.statusConnecting,
								connectionState === ConnectionState.Reconnecting && styles.statusReconnecting,
								connectionState === ConnectionState.Disconnected && styles.statusDisconnected,
								connectionState === ConnectionState.Connected && styles.statusConnected,
							)}
						>
							<div className={styles.connectionStatusDot} />
							{connectionStateText}
						</div>
					)}

					<ChannelHeaderIcon
						ref={statsRefs.setReference}
						icon={ChartBarIcon}
						label={t`Connection Stats`}
						isSelected={isStatsOpen}
						onClick={statsOnClick}
						aria-expanded={isStatsOpen}
						{...statsReferenceProps}
					/>

					{isMobile && (
						<ChannelHeaderIcon icon={PhoneIcon} label={t`View call controls`} onClick={handleOpenCallSheet} />
					)}

					<ChannelHeaderIcon
						icon={isFullscreen ? XIcon : ArrowsOutIcon}
						label={isFullscreen ? t`Exit Fullscreen` : t`Fullscreen`}
						isSelected={isFullscreen}
						onClick={toggleFullscreen}
					/>

					{!isMobile && <InboxButton />}
				</div>
			</NativeDragRegion>

			<div className={styles.mainContent}>{mainContentNode}</div>

			<div className={clsx(styles.controlBarContainer, styles.voiceChrome)}>
				<VoiceControlBar />
			</div>

			{isStatsOpen &&
				(isMobile ? (
					<BottomSheet
						isOpen={isStatsOpen}
						onClose={() => setIsStatsOpen(false)}
						title={t`Connection Stats`}
						snapPoints={[0.3, 0.65, 0.9]}
					>
						<VoiceStatsOverlay onClose={() => setIsStatsOpen(false)} />
					</BottomSheet>
				) : (
					<FloatingFocusManager context={statsContext} modal={false}>
						<div ref={statsRefs.setFloating} style={{...statsFloatingStyles, zIndex: 30}} {...statsFloatingProps}>
							<VoiceStatsOverlay onClose={() => setIsStatsOpen(false)} />
						</div>
					</FloatingFocusManager>
				))}

			{isMobile && (
				<BottomSheet
					isOpen={isCallSheetOpen}
					onClose={handleCloseCallSheet}
					title={channel.name ?? t`Voice call`}
					snapPoints={[0.35, 0.65, 0.95]}
					disablePadding
					surface="primary"
				>
					<div className={styles.voiceCallSheetContent}>
						<CompactVoiceCallView channel={channel} className={styles.voiceCallSheetCompact} />
					</div>
				</BottomSheet>
			)}
		</div>
	);
});

export const VoiceCallView = observer(({channel}: VoiceCallViewProps) => <VoiceCallViewInner channel={channel} />);
