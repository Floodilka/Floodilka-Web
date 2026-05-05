/*
 * Copyright (C) 2020-2026 Fluxer Contributors
 * Copyright (C) 2026 Floodilka Contributors
 *
 * This file is part of Floodilka, a fork of Fluxer
 * (https://github.com/fluxerapp/fluxer).
 * Modified by Floodilka Contributors starting March 2026.
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
import {useLocalParticipant} from '@livekit/components-react';
import {
	CameraIcon,
	CameraSlashIcon,
	CaretDownIcon,
	DotsThreeIcon,
	MicrophoneIcon,
	MicrophoneSlashIcon,
	MonitorIcon,
	PhoneXIcon,
	RadioIcon,
	SpeakerHighIcon,
	SpeakerSlashIcon,
} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useEffect, useRef, useState} from 'react';
import * as ContextMenuActionCreators from '~/actions/ContextMenuActionCreators';
import * as ModalActionCreators from '~/actions/ModalActionCreators';
import {modal} from '~/actions/ModalActionCreators';
import * as VoiceStateActionCreators from '~/actions/VoiceStateActionCreators';
import {
	VoiceAudioSettingsBottomSheet,
	VoiceCameraSettingsBottomSheet,
	VoiceMoreOptionsBottomSheet,
} from '~/components/bottomsheets/VoiceSettingsBottomSheets';
import {CameraPreviewModalInRoom} from '~/components/modals/CameraPreviewModal';
import {ScreenShareSettingsModal} from '~/components/modals/ScreenShareSettingsModal';
import FocusRing from '~/components/uikit/FocusRing/FocusRing';
import {TooltipWithKeybind} from '~/components/uikit/KeybindHint/KeybindHint';
import {Tooltip} from '~/components/uikit/Tooltip/Tooltip';
import {useAudioSettingsMenu} from '~/hooks/useAudioSettingsMenu';
import {useMediaDevices} from '~/hooks/useMediaDevices';
import KeybindStore from '~/stores/KeybindStore';
import LocalVoiceStateStore from '~/stores/LocalVoiceStateStore';
import MobileLayoutStore from '~/stores/MobileLayoutStore';
import VoiceSettingsStore from '~/stores/VoiceSettingsStore';
import MediaEngineStore from '~/stores/voice/MediaEngineFacade';
import {formatKeyCombo} from '~/utils/KeybindUtils';
import {executeScreenShareOperation, getScreenShareOptions} from '~/utils/ScreenShareUtils';
import styles from './VoiceControlBar.module.css';
import {VoiceCameraSettingsMenu, VoiceMoreOptionsMenu} from './VoiceSettingsMenus';

const VoiceControlBarInner = observer(function VoiceControlBarInner() {
	const {t} = useLingui();
	const {localParticipant, isCameraEnabled, isMicrophoneEnabled, isScreenShareEnabled} = useLocalParticipant();

	const voiceState = MediaEngineStore.getCurrentUserVoiceState();
	const localSelfMute = LocalVoiceStateStore.selfMute;
	const localSelfDeaf = LocalVoiceStateStore.selfDeaf;

	const voiceSettings = VoiceSettingsStore;
	const isMobile = MobileLayoutStore.isMobileLayout();

	const {inputDevices, outputDevices, videoDevices} = useMediaDevices();

	const [audioSettingsOpen, setAudioSettingsOpen] = useState(false);
	const [cameraSettingsOpen, setCameraSettingsOpen] = useState(false);
	const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);

	const isMuted = voiceState ? voiceState.self_mute : localSelfMute;
	const isDeafened = voiceState ? voiceState.self_deaf : localSelfDeaf;
	const isGuildMuted = voiceState?.mute ?? false;
	const isGuildDeafened = voiceState?.deaf ?? false;

	const isPushToTalkEffective = KeybindStore.isPushToTalkEffective();
	const isPushToTalkTransmitting = KeybindStore.isPushToTalkTransmitting();
	const pushToTalkCombo = KeybindStore.getByAction('push_to_talk').combo;
	const pushToTalkHint = isPushToTalkEffective ? formatKeyCombo(pushToTalkCombo) : '';

	const showExplicitMute = isGuildMuted || isMuted;
	const showPttIcon = !showExplicitMute && isPushToTalkEffective;

	const {renderAudioSettingsMenu, handleAudioSettingsContextMenu} = useAudioSettingsMenu({
		inputDevices,
		outputDevices,
		isMobile,
		onOpenMobile: () => setAudioSettingsOpen(true),
	});

	const isMicrophoneEnabledRef = useRef(isMicrophoneEnabled);
	const isCameraEnabledRef = useRef(isCameraEnabled);
	const lastInputDeviceIdRef = useRef<string | null>(null);
	const lastVideoDeviceIdRef = useRef<string | null>(null);

	useEffect(() => {
		isMicrophoneEnabledRef.current = isMicrophoneEnabled;
		isCameraEnabledRef.current = isCameraEnabled;
	});

	useEffect(() => {
		if (!localParticipant) return;
		const nextDeviceId = voiceSettings.inputDeviceId;
		if (lastInputDeviceIdRef.current === nextDeviceId) return;
		lastInputDeviceIdRef.current = nextDeviceId;
		if (!isMicrophoneEnabledRef.current || !nextDeviceId) return;

		(async () => {
			try {
				await localParticipant.setMicrophoneEnabled(true, {
					deviceId: nextDeviceId,
					echoCancellation: true,
					noiseSuppression: true,
					autoGainControl: true,
				});
				MediaEngineStore.reconcileTransmissionState();
			} catch (error) {
				console.error('Failed to switch microphone:', error);
			}
		})();
	}, [voiceSettings.inputDeviceId, localParticipant]);

	useEffect(() => {
		if (!localParticipant) return;
		const nextDeviceId = voiceSettings.videoDeviceId;
		if (lastVideoDeviceIdRef.current === nextDeviceId) return;
		lastVideoDeviceIdRef.current = nextDeviceId;
		if (!isCameraEnabledRef.current || !nextDeviceId) return;

		(async () => {
			try {
				await MediaEngineStore.setCameraEnabled(true, {deviceId: nextDeviceId});
			} catch (error) {
				console.error('Failed to switch camera:', error);
			}
		})();
	}, [voiceSettings.videoDeviceId, localParticipant]);

	const handleToggleMute = useCallback(() => {
		VoiceStateActionCreators.toggleSelfMute(null);
	}, []);

	const handleToggleDeafen = useCallback(() => {
		VoiceStateActionCreators.toggleSelfDeaf(null);
	}, []);

	const handleToggleVideo = useCallback(async () => {
		if (!localParticipant) return;

		try {
			if (isCameraEnabled) {
				await MediaEngineStore.setCameraEnabled(false);
			} else {
				ModalActionCreators.push(
					modal(() => (
						<CameraPreviewModalInRoom
							onEnabled={async () => {
								await MediaEngineStore.setCameraEnabled(true, {
									deviceId: VoiceSettingsStore.getVideoDeviceId() || undefined,
								});
							}}
						/>
					)),
				);
			}
		} catch (error) {
			console.error('Failed to toggle camera:', error);
		}
	}, [localParticipant, isCameraEnabled]);

	const handleScreenShare = useCallback(async () => {
		if (!localParticipant) return;

		try {
			if (isScreenShareEnabled) {
				await MediaEngineStore.setScreenShareEnabled(false);
			} else {
				ModalActionCreators.push(
					modal(() => (
						<ScreenShareSettingsModal
							onStartShare={async (resolution, frameRate, includeAudio) => {
								await executeScreenShareOperation(async () => {
									const {captureOptions, publishOptions} = getScreenShareOptions(resolution, frameRate, includeAudio);
									await MediaEngineStore.setScreenShareEnabled(true, captureOptions, publishOptions);
								});
							}}
						/>
					)),
				);
			}
		} catch (error) {
			console.error('Failed to toggle screen share:', error);
		}
	}, [localParticipant, isScreenShareEnabled]);

	const handleDisconnect = useCallback(async () => {
		await MediaEngineStore.disconnectFromVoiceChannel('user');
	}, []);

	const handleAudioSettingsClick = useCallback(
		(event: React.MouseEvent<HTMLButtonElement>) => {
			if (isMobile) {
				setAudioSettingsOpen(true);
			} else {
				ContextMenuActionCreators.openFromEvent(event, renderAudioSettingsMenu);
			}
		},
		[isMobile, renderAudioSettingsMenu],
	);

	const handleCameraSettingsClick = useCallback(
		(event: React.MouseEvent<HTMLButtonElement>) => {
			if (isMobile) {
				setCameraSettingsOpen(true);
			} else {
				ContextMenuActionCreators.openFromEvent(event, ({onClose}) => (
					<VoiceCameraSettingsMenu videoDevices={videoDevices} onClose={onClose} />
				));
			}
		},
		[videoDevices, isMobile],
	);

	const handleMoreOptionsClick = useCallback(
		(event: React.MouseEvent<HTMLButtonElement>) => {
			if (isMobile) {
				setMoreOptionsOpen(true);
			} else {
				ContextMenuActionCreators.openFromEvent(event, ({onClose}) => <VoiceMoreOptionsMenu onClose={onClose} />);
			}
		},
		[isMobile],
	);

	const getMuteTooltipLabel = useCallback(() => {
		if (isGuildMuted) return t`Community Muted`;

		if (showPttIcon && pushToTalkHint) {
			return t`Push-to-talk enabled — hold ${pushToTalkHint} to speak`;
		}

		return isMuted ? t`Unmute` : t`Mute`;
	}, [isMuted, isGuildMuted, showPttIcon, pushToTalkHint, t]);

	const getDeafenTooltipLabel = useCallback(() => {
		if (isGuildDeafened) return t`Community Deafened`;

		switch (isDeafened) {
			case true:
				return t`Undeafen`;
			default:
				return t`Deafen`;
		}
	}, [isDeafened, isGuildDeafened, t]);

	return (
		<div className={styles.container}>
			<div className={styles.buttonContainer}>
				<Tooltip
					text={() => (
						<TooltipWithKeybind label={getMuteTooltipLabel()} action={isGuildMuted ? undefined : 'toggle_mute'} />
					)}
				>
					<FocusRing offset={-2}>
						<div>
							<button
								type="button"
								className={clsx(
									styles.button,
									showExplicitMute
										? styles.buttonMuted
										: showPttIcon && isPushToTalkTransmitting
											? styles.buttonPttActive
											: styles.buttonUnmuted,
									isGuildMuted && 'disabled',
								)}
								onClick={isGuildMuted ? undefined : handleToggleMute}
								onContextMenu={handleAudioSettingsContextMenu}
								disabled={isGuildMuted}
							>
								{showExplicitMute ? (
									<MicrophoneSlashIcon weight="fill" className={styles.icon} />
								) : showPttIcon ? (
									<RadioIcon weight="fill" className={styles.icon} />
								) : (
									<MicrophoneIcon weight="fill" className={styles.icon} />
								)}
							</button>
						</div>
					</FocusRing>
				</Tooltip>

				<Tooltip text={t`Audio Settings`}>
					<FocusRing offset={-2}>
						<button type="button" className={styles.settingsButton} onClick={handleAudioSettingsClick}>
							<CaretDownIcon weight="bold" className={styles.iconSmall} />
						</button>
					</FocusRing>
				</Tooltip>
			</div>

			<Tooltip
				text={() => (
					<TooltipWithKeybind label={getDeafenTooltipLabel()} action={isGuildDeafened ? undefined : 'toggle_deafen'} />
				)}
			>
				<FocusRing offset={-2}>
					<div>
						<button
							type="button"
							className={clsx(
								styles.button,
								isDeafened || isGuildDeafened ? styles.buttonDeafened : styles.buttonUndeafened,
								isGuildDeafened && 'disabled',
							)}
							onClick={isGuildDeafened ? undefined : handleToggleDeafen}
							onContextMenu={handleAudioSettingsContextMenu}
							disabled={isGuildDeafened}
						>
							{isDeafened || isGuildDeafened ? (
								<SpeakerSlashIcon weight="fill" className={styles.icon} />
							) : (
								<SpeakerHighIcon weight="fill" className={styles.icon} />
							)}
						</button>
					</div>
				</FocusRing>
			</Tooltip>

			<div className={styles.buttonContainer}>
				<Tooltip text={isCameraEnabled ? t`Turn Off Camera` : t`Turn On Camera`}>
					<FocusRing offset={-2}>
						<button
							type="button"
							className={clsx(styles.button, isCameraEnabled ? styles.buttonCameraOn : styles.buttonCameraOff)}
							onClick={handleToggleVideo}
						>
							{isCameraEnabled ? (
								<CameraIcon weight="fill" className={styles.icon} />
							) : (
								<CameraSlashIcon weight="fill" className={styles.icon} />
							)}
						</button>
					</FocusRing>
				</Tooltip>

				<Tooltip text={t`Camera Settings`}>
					<FocusRing offset={-2}>
						<button type="button" className={styles.settingsButton} onClick={handleCameraSettingsClick}>
							<CaretDownIcon weight="bold" className={styles.iconSmall} />
						</button>
					</FocusRing>
				</Tooltip>
			</div>

			<Tooltip text={isScreenShareEnabled ? t`Stop Sharing` : t`Share Your Screen`}>
				<FocusRing offset={-2}>
					<button
						type="button"
						className={clsx(
							styles.button,
							isScreenShareEnabled ? styles.buttonScreenShareOn : styles.buttonScreenShareOff,
						)}
						onClick={handleScreenShare}
					>
						<MonitorIcon weight="fill" className={styles.icon} />
					</button>
				</FocusRing>
			</Tooltip>

			<Tooltip text={t`More Options`}>
				<FocusRing offset={-2}>
					<button
						type="button"
						className={clsx(styles.button, styles.buttonMoreOptions)}
						onClick={handleMoreOptionsClick}
					>
						<DotsThreeIcon weight="bold" className={styles.icon} />
					</button>
				</FocusRing>
			</Tooltip>

			<Tooltip text={t`Disconnect`}>
				<FocusRing offset={-2}>
					<button type="button" className={clsx(styles.button, styles.buttonDisconnect)} onClick={handleDisconnect}>
						<PhoneXIcon weight="fill" className={styles.icon} />
					</button>
				</FocusRing>
			</Tooltip>

			{isMobile && (
				<>
					<VoiceAudioSettingsBottomSheet isOpen={audioSettingsOpen} onClose={() => setAudioSettingsOpen(false)} />
					<VoiceCameraSettingsBottomSheet isOpen={cameraSettingsOpen} onClose={() => setCameraSettingsOpen(false)} />
					<VoiceMoreOptionsBottomSheet isOpen={moreOptionsOpen} onClose={() => setMoreOptionsOpen(false)} />
				</>
			)}
		</div>
	);
});

export const VoiceControlBar = observer(() => {
	const room = MediaEngineStore.room;
	if (!room) return null;
	return <VoiceControlBarInner />;
});
