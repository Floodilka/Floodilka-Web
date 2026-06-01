/*
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright (C) 2020-2026 Fluxer Contributors
 * Copyright (C) 2026 Floodilka Contributors
 * Modified by Floodilka Contributors starting March 2026. See LICENSE and NOTICE.
 */

import type {ScreenShareCaptureOptions, TrackPublishOptions} from 'livekit-client';
import {VideoPreset} from 'livekit-client';
import * as ModalActionCreators from '~/actions/ModalActionCreators';
import {modal} from '~/actions/ModalActionCreators';
import {ScreenRecordingPermissionDeniedModal} from '~/components/alerts/ScreenRecordingPermissionDeniedModal';
import {ScreenShareUnsupportedModal} from '~/components/alerts/ScreenShareUnsupportedModal';
import {ScreenRecordingPermissionDeniedError} from '~/utils/errors/ScreenRecordingPermissionDeniedError';
import {isDesktop} from '~/utils/NativeUtils';

export type ScreenShareResolution = 'low' | 'medium' | 'high';

const SCREEN_SHARE_RESOLUTIONS = {
	low: {width: 640, height: 360, baseBitrate: 1_000_000},
	medium: {width: 1280, height: 720, baseBitrate: 4_000_000},
	high: {width: 1920, height: 1080, baseBitrate: 8_000_000},
} as const;

function getScreenSharePreset(resolution: ScreenShareResolution, frameRate: number): VideoPreset {
	const res = SCREEN_SHARE_RESOLUTIONS[resolution];
	const bitrate = frameRate >= 60 ? Math.round(res.baseBitrate * 1.5) : res.baseBitrate;
	return new VideoPreset(res.width, res.height, bitrate, frameRate);
}

function getScreenShareSimulcastLayers(resolution: ScreenShareResolution, frameRate: number): VideoPreset[] {
	const layers: VideoPreset[] = [];
	const resolutionOrder: ScreenShareResolution[] = ['low', 'medium', 'high'];
	const targetIndex = resolutionOrder.indexOf(resolution);

	for (let i = 0; i < targetIndex; i++) {
		const res = SCREEN_SHARE_RESOLUTIONS[resolutionOrder[i]];
		const fps = Math.min(frameRate, 30);
		layers.push(new VideoPreset(res.width, res.height, res.baseBitrate, fps));
	}

	return layers;
}

export function getScreenShareOptions(
	resolution: ScreenShareResolution,
	frameRate: number,
	includeAudio: boolean,
): {captureOptions: ScreenShareCaptureOptions; publishOptions: TrackPublishOptions} {
	const preset = getScreenSharePreset(resolution, frameRate);
	const excludeFloodilkaBrowserTab = !isDesktop();
	const audioOptions = includeAudio
		? isDesktop()
			? {
					autoGainControl: false,
					echoCancellation: false,
					noiseSuppression: false,
				}
			: true
		: false;

	return {
		captureOptions: {
			audio: audioOptions,
			video: excludeFloodilkaBrowserTab && includeAudio ? {displaySurface: 'browser'} : true,
			selfBrowserSurface: excludeFloodilkaBrowserTab ? 'exclude' : 'include',
			surfaceSwitching: excludeFloodilkaBrowserTab ? 'exclude' : 'include',
			preferCurrentTab: false,
			systemAudio: includeAudio ? 'include' : 'exclude',
			contentHint: 'motion' as const,
			resolution: preset.resolution,
		},
		publishOptions: {
			videoCodec: 'h264' as const,
			screenShareEncoding: preset.encoding,
			degradationPreference: 'maintain-framerate' as const,
			...(resolution !== 'low' && {
				screenShareSimulcastLayers: getScreenShareSimulcastLayers(resolution, frameRate),
			}),
		},
	};
}

const isScreenShareUnsupportedError = (error: unknown): boolean => {
	if (!(error instanceof Error)) return false;

	return (
		error.name === 'DeviceUnsupportedError' ||
		error.message.includes('getDisplayMedia not supported') ||
		error.message.includes('NotSupportedError') ||
		error.message.includes('NotAllowedError')
	);
};

const handleScreenShareError = (error: unknown): void => {
	if (error instanceof ScreenRecordingPermissionDeniedError) {
		ModalActionCreators.push(modal(() => <ScreenRecordingPermissionDeniedModal />));
		return;
	}
	if (isScreenShareUnsupportedError(error)) {
		ModalActionCreators.push(modal(() => <ScreenShareUnsupportedModal />));
	} else {
		console.error('Failed to start screen share:', error);
	}
};

export const executeScreenShareOperation = async (
	operation: () => Promise<void>,
	onError?: (error: unknown) => void,
): Promise<void> => {
	try {
		await operation();
	} catch (error) {
		handleScreenShareError(error);
		if (onError) {
			onError(error);
		}
		throw error;
	}
};
