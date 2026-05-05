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

import type {TrackPublishOptions, VideoCaptureOptions} from 'livekit-client';
import {VideoPreset} from 'livekit-client';

export type CameraResolution = 'low' | 'medium' | 'high';

const CAMERA_RESOLUTIONS = {
	low: {width: 640, height: 360},
	medium: {width: 1280, height: 720},
	high: {width: 1920, height: 1080},
} as const;

const BITRATE_TABLE: Record<CameraResolution, {fps30: number; fps60: number}> = {
	low: {fps30: 500_000, fps60: 800_000},
	medium: {fps30: 2_500_000, fps60: 4_000_000},
	high: {fps30: 4_500_000, fps60: 7_500_000},
};

function clampFrameRate(frameRate: number): number {
	if (!Number.isFinite(frameRate)) return 30;
	return Math.max(15, Math.min(60, Math.round(frameRate)));
}

function getMaxBitrate(resolution: CameraResolution, frameRate: number): number {
	const entry = BITRATE_TABLE[resolution];
	if (frameRate >= 60) return entry.fps60;
	if (frameRate >= 30) return entry.fps30;
	return Math.round(entry.fps30 * (frameRate / 30));
}

export function buildCameraPreset(resolution: CameraResolution, frameRate: number): VideoPreset {
	const fps = clampFrameRate(frameRate);
	const dims = CAMERA_RESOLUTIONS[resolution];
	return new VideoPreset(dims.width, dims.height, getMaxBitrate(resolution, fps), fps);
}

export function buildCameraCaptureOptions(
	resolution: CameraResolution,
	frameRate: number,
	deviceId?: string,
): VideoCaptureOptions {
	const preset = buildCameraPreset(resolution, frameRate);
	const options: VideoCaptureOptions = {
		resolution: preset.resolution,
		frameRate: preset.encoding.maxFramerate,
	};
	if (deviceId) {
		options.deviceId = deviceId;
	}
	return options;
}

export function buildCameraPublishOptions(resolution: CameraResolution, frameRate: number): TrackPublishOptions {
	const preset = buildCameraPreset(resolution, frameRate);
	return {
		videoCodec: 'vp9',
		videoEncoding: preset.encoding,
		backupCodec: {codec: 'vp8', encoding: preset.encoding},
		degradationPreference: 'maintain-framerate',
	};
}

export function getCameraOptions(
	resolution: CameraResolution,
	frameRate: number,
	deviceId?: string,
): {captureOptions: VideoCaptureOptions; publishOptions: TrackPublishOptions} {
	return {
		captureOptions: buildCameraCaptureOptions(resolution, frameRate, deviceId),
		publishOptions: buildCameraPublishOptions(resolution, frameRate),
	};
}
