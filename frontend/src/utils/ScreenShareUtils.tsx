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

import type {ScreenShareCaptureOptions, TrackPublishOptions} from 'livekit-client';
import {VideoPreset} from 'livekit-client';
import * as ModalActionCreators from '~/actions/ModalActionCreators';
import {modal} from '~/actions/ModalActionCreators';
import {ScreenRecordingPermissionDeniedModal} from '~/components/alerts/ScreenRecordingPermissionDeniedModal';
import {ScreenShareUnsupportedModal} from '~/components/alerts/ScreenShareUnsupportedModal';
import {ScreenRecordingPermissionDeniedError} from '~/utils/errors/ScreenRecordingPermissionDeniedError';

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
	return {
		captureOptions: {
			audio: includeAudio
				? {
						autoGainControl: false,
						echoCancellation: false,
						noiseSuppression: false,
					}
				: false,
			selfBrowserSurface: 'include' as const,
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
