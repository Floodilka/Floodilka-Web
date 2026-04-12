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
	isTrackReference,
	type TrackReferenceOrPlaceholder,
	useTracks,
	VideoTrack,
} from '@livekit/components-react';
import {ArrowLeftIcon, PhoneXIcon, XIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import type {AnimationPlaybackControls, SpringOptions} from 'framer-motion';
import {animate, motion, type PanInfo, useDragControls, useMotionValue} from 'framer-motion';
import {type Room, RoomEvent, Track} from 'livekit-client';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import * as PiPActionCreators from '~/actions/PiPActionCreators';
import {DEFAULT_ACCENT_COLOR} from '~/Constants';
import NavigationCoordinator from '~/navigation/NavigationCoordinator';
import {Avatar} from '~/components/uikit/Avatar';
import FocusRing from '~/components/uikit/FocusRing/FocusRing';
import {Tooltip} from '~/components/uikit/Tooltip';
import {getPlaceholderAvatarColor} from '~/components/voice/getPlaceholderAvatarColor';
import styles from '~/components/voice/PiPOverlay.module.css';
import voiceParticipantTileStyles from '~/components/voice/VoiceParticipantTile.module.css';
import AccessibilityStore from '~/stores/AccessibilityStore';
import ChannelStore from '~/stores/ChannelStore';
import MobileLayoutStore from '~/stores/MobileLayoutStore';
import PiPStore, {PIP_DEFAULT_WIDTH, type PiPContent} from '~/stores/PiPStore';
import UserStore from '~/stores/UserStore';
import MediaEngineStore from '~/stores/voice/MediaEngineFacade';
import * as NicknameUtils from '~/utils/NicknameUtils';

const PIP_ASPECT_RATIO = 16 / 9;
const PIP_MAX_WIDTH = 720;
const PIP_MIN_WIDTH = 240;
const EDGE_PADDING = 20;

const FLING_TIME_SECONDS = 0.25;
const STRONG_FLING_VELOCITY = 550;
const MIN_AXIS_VELOCITY = 180;

const AVATAR_BACKGROUND_DIM_AMOUNT = 0.12;

type Corner = 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left';

interface CornerPosition {
	x: number;
	y: number;
}

interface DragBounds {
	minX: number;
	maxX: number;
	minY: number;
	maxY: number;
}

interface ResizeListeners {
	move: (event: PointerEvent) => void;
	up: (event: PointerEvent) => void;
}

type ResizeEdge = 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

interface ResizeState {
	pointerId: number;
	edge: ResizeEdge;
	startX: number;
	startY: number;
	startWidth: number;
	startPosX: number;
	startPosY: number;
}

const SNAP_SPRING: SpringOptions = {
	stiffness: 520,
	damping: 42,
	mass: 0.9,
	bounce: 0.35,
};

const INTERACTION_SPRING: SpringOptions = {
	stiffness: 520,
	damping: 38,
	mass: 0.8,
};

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function getPiPHeight(width: number): number {
	return Math.round(width / PIP_ASPECT_RATIO);
}

function getViewportMaxWidth(viewportWidth: number, viewportHeight: number): number {
	const maxByWidth = Math.max(120, viewportWidth - EDGE_PADDING * 2);
	const maxByHeight = Math.max(120, (viewportHeight - EDGE_PADDING * 2) * PIP_ASPECT_RATIO);
	return Math.max(120, Math.min(PIP_MAX_WIDTH, maxByWidth, maxByHeight));
}

function getViewportMinWidth(viewportMaxWidth: number): number {
	return Math.min(PIP_MIN_WIDTH, viewportMaxWidth);
}

function clampPiPWidth(value: number, viewportWidth: number, viewportHeight: number): number {
	const viewportMaxWidth = getViewportMaxWidth(viewportWidth, viewportHeight);
	const viewportMinWidth = getViewportMinWidth(viewportMaxWidth);
	return clamp(Math.round(value), viewportMinWidth, viewportMaxWidth);
}

function getDragBounds(viewportWidth: number, viewportHeight: number, pipWidth: number, pipHeight: number): DragBounds {
	const maxX = Math.max(EDGE_PADDING, viewportWidth - pipWidth - EDGE_PADDING);
	const maxY = Math.max(EDGE_PADDING, viewportHeight - pipHeight - EDGE_PADDING);

	return {
		minX: EDGE_PADDING,
		maxX,
		minY: EDGE_PADDING,
		maxY,
	};
}

function getCornerPositions(
	viewportWidth: number,
	viewportHeight: number,
	pipWidth: number,
	pipHeight: number,
): Record<Corner, CornerPosition> {
	const bounds = getDragBounds(viewportWidth, viewportHeight, pipWidth, pipHeight);

	return {
		'top-left': {x: bounds.minX, y: bounds.minY},
		'top-right': {x: bounds.maxX, y: bounds.minY},
		'bottom-right': {x: bounds.maxX, y: bounds.maxY},
		'bottom-left': {x: bounds.minX, y: bounds.maxY},
	};
}

function pickCornerOnRelease(
	currentX: number,
	currentY: number,
	velocityX: number,
	velocityY: number,
	corners: Record<Corner, CornerPosition>,
	bounds: DragBounds,
): Corner {
	const projectedX = clamp(currentX + velocityX * FLING_TIME_SECONDS, bounds.minX, bounds.maxX);
	const projectedY = clamp(currentY + velocityY * FLING_TIME_SECONDS, bounds.minY, bounds.maxY);

	const speed = Math.hypot(velocityX, velocityY);
	const splitX = (bounds.minX + bounds.maxX) / 2;
	const splitY = (bounds.minY + bounds.maxY) / 2;

	if (speed >= STRONG_FLING_VELOCITY) {
		const horizontal =
			Math.abs(velocityX) >= MIN_AXIS_VELOCITY
				? velocityX >= 0
					? 'right'
					: 'left'
				: projectedX >= splitX
					? 'right'
					: 'left';
		const vertical =
			Math.abs(velocityY) >= MIN_AXIS_VELOCITY
				? velocityY >= 0
					? 'bottom'
					: 'top'
				: projectedY >= splitY
					? 'bottom'
					: 'top';

		return `${vertical}-${horizontal}` as Corner;
	}

	const entries = Object.entries(corners) as Array<[Corner, CornerPosition]>;
	let bestCorner = entries[0][0];
	let bestDist = Number.POSITIVE_INFINITY;

	for (const [corner, pos] of entries) {
		const dx = pos.x - projectedX;
		const dy = pos.y - projectedY;
		const dist = dx * dx + dy * dy;

		if (dist < bestDist) {
			bestDist = dist;
			bestCorner = corner;
		}
	}

	return bestCorner;
}

interface ParsedIdentity {
	userId: string;
	connectionId: string;
}

function parseIdentity(identity: string): ParsedIdentity {
	const match = identity.match(/^user_(\d+)_(.+)$/);
	return {userId: match?.[1] ?? '', connectionId: match?.[2] ?? ''};
}

interface RGBComponents {
	r: number;
	g: number;
	b: number;
	a?: number;
}

const clampChannel = (value: number) => Math.max(0, Math.min(255, value));

const toRGBComponents = (color: string): RGBComponents | null => {
	const normalized = color.trim();

	const hexMatch = normalized.match(/^#([a-f0-9]{3}|[a-f0-9]{6}|[a-f0-9]{8})$/i);
	if (hexMatch) {
		const hex = hexMatch[1];
		const expand = (pair: string) => (pair.length === 1 ? `${pair}${pair}` : pair);

		if (hex.length === 3) {
			return {
				r: parseInt(expand(hex[0]), 16),
				g: parseInt(expand(hex[1]), 16),
				b: parseInt(expand(hex[2]), 16),
			};
		}
		if (hex.length === 6) {
			return {
				r: parseInt(hex.slice(0, 2), 16),
				g: parseInt(hex.slice(2, 4), 16),
				b: parseInt(hex.slice(4, 6), 16),
			};
		}
		if (hex.length === 8) {
			return {
				r: parseInt(hex.slice(0, 2), 16),
				g: parseInt(hex.slice(2, 4), 16),
				b: parseInt(hex.slice(4, 6), 16),
				a: parseInt(hex.slice(6, 8), 16) / 255,
			};
		}
	}

	const rgbMatch = normalized.match(
		/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(\d*\.?\d+))?\s*\)$/i,
	);
	if (rgbMatch) {
		const [, rawR, rawG, rawB, rawA] = rgbMatch;
		const components: RGBComponents = {
			r: clampChannel(Number(rawR)),
			g: clampChannel(Number(rawG)),
			b: clampChannel(Number(rawB)),
		};
		if (rawA != null) {
			components.a = Math.max(0, Math.min(1, Number(rawA)));
		}
		return components;
	}

	return null;
};

const formatRGB = ({r, g, b, a}: RGBComponents): string =>
	a != null ? `rgba(${r}, ${g}, ${b}, ${a})` : `rgb(${r}, ${g}, ${b})`;

function dimColor(color: string): string {
	const rgb = toRGBComponents(color);
	if (!rgb) return color;
	const factor = Math.max(0, Math.min(1, 1 - AVATAR_BACKGROUND_DIM_AMOUNT));
	const dimmed: RGBComponents = {
		r: clampChannel(Math.round(rgb.r * factor)),
		g: clampChannel(Math.round(rgb.g * factor)),
		b: clampChannel(Math.round(rgb.b * factor)),
	};
	if (rgb.a != null) dimmed.a = rgb.a;
	return formatRGB(dimmed);
}

function useFindTrackRef(content: PiPContent | null, room: Room): TrackReferenceOrPlaceholder | null {
	const tracks = useTracks(
		[
			{source: Track.Source.Camera, withPlaceholder: true},
			{source: Track.Source.ScreenShare, withPlaceholder: true},
		],
		{
			updateOnlyOn: [
				RoomEvent.TrackPublished,
				RoomEvent.TrackUnpublished,
				RoomEvent.TrackSubscribed,
				RoomEvent.TrackUnsubscribed,
				RoomEvent.TrackMuted,
				RoomEvent.TrackUnmuted,
			],
			onlySubscribed: false,
			room,
		},
	);

	return useMemo(() => {
		if (!content) return null;
		const targetSource = content.type === 'stream' ? Track.Source.ScreenShare : Track.Source.Camera;
		return (
			tracks.find((tr) => tr.participant.identity === content.participantIdentity && tr.source === targetSource) ??
			null
		);
	}, [tracks, content]);
}

interface PiPOverlayInnerProps {
	content: PiPContent;
	room: Room;
}

const PiPOverlayInner = observer(function PiPOverlayInner({content, room}: PiPOverlayInnerProps) {
	const {t} = useLingui();
	const corner = PiPStore.getEffectiveCorner();

	const trackRef = useFindTrackRef(content, room);
	const channel = ChannelStore.getChannel(content.channelId);
	const participantUser = UserStore.getUser(content.userId);

	const isScreenShare = content.type === 'stream';

	const displayName = useMemo(() => {
		if (!participantUser) return '';
		return (
			NicknameUtils.getNickname(participantUser, content.guildId ?? undefined, content.channelId) ||
			participantUser.username ||
			''
		);
	}, [participantUser, content.guildId, content.channelId]);

	const channelName = channel?.name ?? '';

	const [viewportSize, setViewportSize] = useState(() => ({
		width: window.innerWidth,
		height: window.innerHeight,
	}));
	const [pipWidth, setPipWidth] = useState(() =>
		clampPiPWidth(PiPStore.getWidth() || PIP_DEFAULT_WIDTH, window.innerWidth, window.innerHeight),
	);
	const [isResizing, setIsResizing] = useState(false);
	const [isDragging, setIsDragging] = useState(false);

	const videoRef = useRef<HTMLVideoElement | null>(null);
	const pipWidthRef = useRef(pipWidth);
	const placeholderColor = useMemo(
		() => getPlaceholderAvatarColor(participantUser, DEFAULT_ACCENT_COLOR),
		[participantUser],
	);
	const placeholderBackgroundColor = useMemo(() => dimColor(placeholderColor), [placeholderColor]);
	const pipAvatarSize = useMemo(() => clamp(Math.round(pipWidth * 0.28), 72, 168), [pipWidth]);
	const hasVisibleMediaTrack = useMemo(() => {
		if (!trackRef || !isTrackReference(trackRef)) return false;
		const publication = trackRef.publication;
		return Boolean(publication?.track) && !publication?.isMuted;
	}, [trackRef]);

	const pipHeight = useMemo(() => getPiPHeight(pipWidth), [pipWidth]);

	const bounds = useMemo(
		() => getDragBounds(viewportSize.width, viewportSize.height, pipWidth, pipHeight),
		[viewportSize.width, viewportSize.height, pipHeight, pipWidth],
	);

	const cornerPositions = useMemo(
		() => getCornerPositions(viewportSize.width, viewportSize.height, pipWidth, pipHeight),
		[viewportSize.width, viewportSize.height, pipHeight, pipWidth],
	);

	const initialPosition = cornerPositions[corner];

	const x = useMotionValue(initialPosition.x);
	const y = useMotionValue(initialPosition.y);
	const dragControls = useDragControls();

	const isDraggingRef = useRef(false);
	const isResizingRef = useRef(false);
	const animRef = useRef<{x?: AnimationPlaybackControls; y?: AnimationPlaybackControls}>({});
	const resizeStateRef = useRef<ResizeState | null>(null);
	const resizeListenersRef = useRef<ResizeListeners | null>(null);

	const stopSnapAnimations = useCallback(() => {
		animRef.current.x?.stop();
		animRef.current.y?.stop();
		animRef.current = {};
	}, []);

	const snapToCorner = useCallback(
		(targetCorner: Corner, opts?: {immediate?: boolean}) => {
			const next = cornerPositions[targetCorner];
			stopSnapAnimations();

			if (opts?.immediate || AccessibilityStore.useReducedMotion) {
				x.set(next.x);
				y.set(next.y);
				return;
			}

			animRef.current.x = animate(x, next.x, SNAP_SPRING);
			animRef.current.y = animate(y, next.y, SNAP_SPRING);
		},
		[cornerPositions, stopSnapAnimations, x, y],
	);

	useEffect(() => {
		const handleResize = () => {
			setViewportSize({width: window.innerWidth, height: window.innerHeight});
		};
		window.addEventListener('resize', handleResize, {passive: true});
		return () => window.removeEventListener('resize', handleResize);
	}, []);

	useEffect(() => {
		pipWidthRef.current = pipWidth;
	}, [pipWidth]);

	useEffect(() => {
		setPipWidth((prevWidth) => {
			const clampedWidth = clampPiPWidth(prevWidth, viewportSize.width, viewportSize.height);
			if (clampedWidth !== prevWidth) {
				PiPStore.setWidth(clampedWidth);
			}
			return clampedWidth;
		});
	}, [viewportSize.height, viewportSize.width]);

	useEffect(() => {
		if (isDraggingRef.current || isResizingRef.current) return;
		snapToCorner(corner);
	}, [corner, snapToCorner]);

	useEffect(() => {
		if (isDraggingRef.current || isResizingRef.current) return;
		x.set(clamp(x.get(), bounds.minX, bounds.maxX));
		y.set(clamp(y.get(), bounds.minY, bounds.maxY));
	}, [bounds.maxX, bounds.maxY, bounds.minX, bounds.minY, x, y]);

	const cleanupResizeListeners = useCallback(() => {
		const listeners = resizeListenersRef.current;
		if (!listeners) return;
		window.removeEventListener('pointermove', listeners.move);
		window.removeEventListener('pointerup', listeners.up);
		window.removeEventListener('pointercancel', listeners.up);
		resizeListenersRef.current = null;
	}, []);

	const computeResizeDelta = useCallback(
		(edge: ResizeEdge, deltaX: number, deltaY: number): {deltaWidth: number; deltaPosX: number; deltaPosY: number} => {
			const deltaWidthFromHorizontal = edge.includes('right') ? deltaX : edge.includes('left') ? -deltaX : 0;
			const deltaWidthFromVertical = edge.includes('bottom')
				? deltaY * PIP_ASPECT_RATIO
				: edge.includes('top')
					? -deltaY * PIP_ASPECT_RATIO
					: 0;

			const deltaWidth =
				edge === 'top' || edge === 'bottom'
					? deltaWidthFromVertical
					: edge === 'left' || edge === 'right'
						? deltaWidthFromHorizontal
						: deltaWidthFromHorizontal + deltaWidthFromVertical;

			const deltaHeight = deltaWidth / PIP_ASPECT_RATIO;
			const deltaPosX = edge.includes('left') ? -deltaWidth : 0;
			const deltaPosY = edge.includes('top') ? -deltaHeight : 0;

			return {deltaWidth, deltaPosX, deltaPosY};
		},
		[],
	);

	const handleResizePointerMove = useCallback(
		(event: PointerEvent) => {
			const state = resizeStateRef.current;
			if (!state || state.pointerId !== event.pointerId) return;

			event.preventDefault();
			const deltaX = event.clientX - state.startX;
			const deltaY = event.clientY - state.startY;
			const {deltaWidth, deltaPosX, deltaPosY} = computeResizeDelta(state.edge, deltaX, deltaY);

			const nextWidth = clampPiPWidth(state.startWidth + deltaWidth, viewportSize.width, viewportSize.height);

			setPipWidth(nextWidth);
			pipWidthRef.current = nextWidth;
			x.set(state.startPosX + deltaPosX);
			y.set(state.startPosY + deltaPosY);
		},
		[computeResizeDelta, viewportSize.height, viewportSize.width, x, y],
	);

	const handleResizePointerUp = useCallback(
		(event: PointerEvent) => {
			const state = resizeStateRef.current;
			if (!state || state.pointerId !== event.pointerId) return;
			event.preventDefault();
			cleanupResizeListeners();
			resizeStateRef.current = null;
			isResizingRef.current = false;
			setIsResizing(false);
			PiPStore.setWidth(pipWidthRef.current);
		},
		[cleanupResizeListeners],
	);

	const createResizePointerDownHandler = useCallback(
		(edge: ResizeEdge) => (event: React.PointerEvent<HTMLButtonElement>) => {
			if (event.button !== 0) return;
			event.preventDefault();
			event.stopPropagation();
			stopSnapAnimations();
			isResizingRef.current = true;
			setIsResizing(true);
			resizeStateRef.current = {
				pointerId: event.pointerId,
				edge,
				startX: event.clientX,
				startY: event.clientY,
				startWidth: pipWidthRef.current,
				startPosX: x.get(),
				startPosY: y.get(),
			};

			const listeners: ResizeListeners = {
				move: handleResizePointerMove,
				up: handleResizePointerUp,
			};
			resizeListenersRef.current = listeners;
			window.addEventListener('pointermove', listeners.move);
			window.addEventListener('pointerup', listeners.up);
			window.addEventListener('pointercancel', listeners.up);
		},
		[handleResizePointerMove, handleResizePointerUp, stopSnapAnimations, x, y],
	);

	useEffect(() => cleanupResizeListeners, [cleanupResizeListeners]);

	const handleContainerPointerDown = useCallback(
		(event: React.PointerEvent<HTMLDivElement>) => {
			if (event.button !== 0) return;
			if (isResizingRef.current) return;
			const targetElement = event.target as HTMLElement | null;
			if (targetElement?.closest('button, [data-pip-no-drag="true"]')) return;
			dragControls.start(event);
		},
		[dragControls],
	);

	const handleDragStart = useCallback(() => {
		if (isResizingRef.current) return;
		isDraggingRef.current = true;
		setIsDragging(true);
		stopSnapAnimations();
	}, [stopSnapAnimations]);

	const handleDragEnd = useCallback(
		(_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
			if (isResizingRef.current) {
				isDraggingRef.current = false;
				setIsDragging(false);
				return;
			}
			isDraggingRef.current = false;
			setIsDragging(false);

			const currentX = x.get();
			const currentY = y.get();

			const targetCorner = pickCornerOnRelease(
				currentX,
				currentY,
				info.velocity.x,
				info.velocity.y,
				cornerPositions,
				bounds,
			);
			PiPStore.setCorner(targetCorner);
			snapToCorner(targetCorner);
		},
		[bounds, cornerPositions, snapToCorner, x, y],
	);

	const handleCloseClick = useCallback((e: React.MouseEvent) => {
		e.stopPropagation();
		PiPStore.close();
	}, []);

	const handleDisconnect = useCallback(async (e: React.MouseEvent) => {
		e.stopPropagation();
		await MediaEngineStore.disconnectFromVoiceChannel('user');
		PiPStore.close();
	}, []);

	const returnToCall = useCallback(() => {
		if (content.guildId) {
			NavigationCoordinator.navigateToGuild(content.guildId, content.channelId);
		} else {
			NavigationCoordinator.navigateToDM(content.channelId);
		}
	}, [content.channelId, content.guildId]);

	const handleReturnToCall = useCallback(
		(event: React.MouseEvent<HTMLButtonElement>) => {
			event.stopPropagation();
			returnToCall();
		},
		[returnToCall],
	);

	const handleOverlayDoubleClick = useCallback(
		(event: React.MouseEvent<HTMLDivElement>) => {
			event.stopPropagation();
			if (isDraggingRef.current || isResizingRef.current) return;
			returnToCall();
		},
		[returnToCall],
	);

	const mediaNode = useMemo(() => {
		if (trackRef && isTrackReference(trackRef) && hasVisibleMediaTrack) {
			return (
				<div className={clsx(styles.videoWrapper, isScreenShare && styles.screenShareVideo)}>
					<VideoTrack ref={videoRef} trackRef={trackRef} manageSubscription={!isScreenShare} />
				</div>
			);
		}

		return (
			<div className={styles.avatarPlaceholder} style={{backgroundColor: placeholderBackgroundColor}}>
				{participantUser && (
					<div className={voiceParticipantTileStyles.avatarRing}>
						<Avatar
							user={participantUser}
							size={pipAvatarSize}
							className={voiceParticipantTileStyles.avatarFlexShrink}
							guildId={content.guildId ?? undefined}
						/>
					</div>
				)}
			</div>
		);
	}, [
		content.guildId,
		hasVisibleMediaTrack,
		isScreenShare,
		participantUser,
		pipAvatarSize,
		placeholderBackgroundColor,
		trackRef,
	]);

	return (
		<motion.div
			className={clsx(
				styles.container,
				isResizing && styles.containerResizing,
				(isDragging || isResizing) && styles.containerInteractionActive,
			)}
			style={{x, y, width: pipWidth}}
			drag={!isResizing}
			dragControls={dragControls}
			dragListener={false}
			dragMomentum={false}
			dragElastic={0.18}
			dragConstraints={{left: bounds.minX, right: bounds.maxX, top: bounds.minY, bottom: bounds.maxY}}
			dragTransition={{bounceStiffness: 520, bounceDamping: 32}}
			onPointerDown={handleContainerPointerDown}
			onDragStart={handleDragStart}
			onDragEnd={handleDragEnd}
			onDoubleClick={handleOverlayDoubleClick}
			whileDrag={AccessibilityStore.useReducedMotion ? undefined : {scale: 1.02}}
			transition={AccessibilityStore.useReducedMotion ? {duration: 0} : INTERACTION_SPRING}
		>
			{mediaNode}

			<div className={styles.hoverOverlay}>
				<div className={styles.headerGradient}>
					<div className={styles.headerContent}>
						<div className={styles.headerLeft}>
							<FocusRing offset={-2}>
								<button
									type="button"
									className={styles.returnToCallButton}
									onClick={handleReturnToCall}
									onPointerDown={(e) => e.stopPropagation()}
									aria-label={t`Back to call`}
								>
									<ArrowLeftIcon weight="bold" className={styles.returnToCallIcon} />
									<span className={styles.returnToCallLabel}>{channelName}</span>
								</button>
							</FocusRing>
						</div>
						<Tooltip text={t`Close`} position="left">
							<button
								type="button"
								className={styles.closeButton}
								onClick={handleCloseClick}
								onPointerDown={(e) => e.stopPropagation()}
								aria-label={t`Close`}
							>
								<XIcon weight="bold" className={styles.actionIcon} />
							</button>
						</Tooltip>
					</div>
				</div>

				<div className={styles.footerGradient}>
					<div className={styles.footerContent}>
						<div className={styles.footerLeft}>
							<span className={styles.streamerName}>{displayName}</span>
						</div>
						<div className={styles.footerRight}>
							{!isScreenShare && (
								<button
									type="button"
									className={clsx(styles.actionButton, styles.disconnectButton)}
									onClick={handleDisconnect}
									onPointerDown={(e) => e.stopPropagation()}
									aria-label={t`Disconnect`}
								>
									<PhoneXIcon weight="fill" className={styles.actionIcon} />
								</button>
							)}
						</div>
					</div>
				</div>
			</div>

			<button
				type="button"
				className={styles.resizeHandleTop}
				aria-label={t`Resize Picture-in-Picture`}
				onPointerDown={createResizePointerDownHandler('top')}
				onDoubleClick={(event) => event.stopPropagation()}
			/>
			<button
				type="button"
				className={styles.resizeHandleBottom}
				aria-label={t`Resize Picture-in-Picture`}
				onPointerDown={createResizePointerDownHandler('bottom')}
				onDoubleClick={(event) => event.stopPropagation()}
			/>
			<button
				type="button"
				className={styles.resizeHandleLeft}
				aria-label={t`Resize Picture-in-Picture`}
				onPointerDown={createResizePointerDownHandler('left')}
				onDoubleClick={(event) => event.stopPropagation()}
			/>
			<button
				type="button"
				className={styles.resizeHandleRight}
				aria-label={t`Resize Picture-in-Picture`}
				onPointerDown={createResizePointerDownHandler('right')}
				onDoubleClick={(event) => event.stopPropagation()}
			/>
			<button
				type="button"
				className={styles.resizeHandleTopLeft}
				aria-label={t`Resize Picture-in-Picture`}
				onPointerDown={createResizePointerDownHandler('top-left')}
				onDoubleClick={(event) => event.stopPropagation()}
			/>
			<button
				type="button"
				className={styles.resizeHandleTopRight}
				aria-label={t`Resize Picture-in-Picture`}
				onPointerDown={createResizePointerDownHandler('top-right')}
				onDoubleClick={(event) => event.stopPropagation()}
			/>
			<button
				type="button"
				className={styles.resizeHandleBottomLeft}
				aria-label={t`Resize Picture-in-Picture`}
				onPointerDown={createResizePointerDownHandler('bottom-left')}
				onDoubleClick={(event) => event.stopPropagation()}
			/>
			<button
				type="button"
				className={styles.resizeHandleBottomRight}
				aria-label={t`Resize Picture-in-Picture`}
				onPointerDown={createResizePointerDownHandler('bottom-right')}
				onDoubleClick={(event) => event.stopPropagation()}
			/>
		</motion.div>
	);
});

export const PiPOverlay = observer(function PiPOverlay() {
	const isOpen = PiPStore.getIsOpen();
	const hasActiveOverlay = PiPStore.getHasActiveOverlay();
	const content = PiPStore.getActiveContent();
	const room = MediaEngineStore.room;
	const [activeRoom, setActiveRoom] = useState<Room | null>(room);
	const isMobile = MobileLayoutStore.isMobileLayout();
	const disablePopout = PiPStore.getSessionDisable();

	useEffect(() => {
		if (!isMobile) return;
		if (isOpen) {
			PiPActionCreators.closePiP();
		}
		PiPActionCreators.hideFocusedTileMirror();
	}, [isMobile, isOpen]);

	useEffect(() => {
		if (!room && isOpen) {
			PiPActionCreators.closePiP();
		}
	}, [room, isOpen]);

	useEffect(() => {
		if (!disablePopout) return;
		if (isOpen) {
			PiPActionCreators.closePiP();
		}
		PiPActionCreators.hideFocusedTileMirror();
	}, [disablePopout, isOpen]);

	useEffect(() => {
		if (room) {
			setActiveRoom(room);
		}
	}, [room]);

	return (
		<>
			{activeRoom && !isMobile && !disablePopout && hasActiveOverlay && content && (
				<PiPOverlayInner key="pip-overlay" content={content} room={activeRoom} />
			)}
		</>
	);
});

export {parseIdentity as parseVoicePiPIdentity};
