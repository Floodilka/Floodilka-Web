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

import {spawn} from 'node:child_process';
import crypto from 'node:crypto';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {Logger} from '~/Logger';

const FFMPEG_TIMEOUT_MS = 30_000;
const FFPROBE_TIMEOUT_MS = 5_000;

export interface TranscodeNameplateOptions {
	input: Uint8Array;
	targetWidth: number;
	targetHeight: number;
	maxDurationSeconds: number;
	targetBitrateKbps: number;
}

export interface TranscodeNameplateResult {
	webm: Uint8Array;
	poster: Uint8Array;
	durationSeconds: number;
}

export interface ProbeResult {
	width: number;
	height: number;
	durationSeconds: number;
	hasVideoStream: boolean;
	hasAnimation: boolean;
}

const runCommand = async (
	binary: string,
	args: ReadonlyArray<string>,
	timeoutMs: number,
	stdinData?: Uint8Array,
): Promise<{stdout: Buffer; stderr: string; code: number}> => {
	return new Promise((resolve, reject) => {
		const child = spawn(binary, args, {
			stdio: [stdinData ? 'pipe' : 'ignore', 'pipe', 'pipe'],
		});

		const stdoutChunks: Array<Buffer> = [];
		const stderrChunks: Array<Buffer> = [];
		let settled = false;

		const settle = (result: {stdout: Buffer; stderr: string; code: number} | Error) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			if (result instanceof Error) {
				reject(result);
			} else {
				resolve(result);
			}
		};

		child.stdout?.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
		child.stderr?.on('data', (chunk: Buffer) => stderrChunks.push(chunk));
		child.stdout?.on('error', () => {
			/* ignore stream errors — we rely on close event */
		});
		child.stderr?.on('error', () => {
			/* ignore stream errors — we rely on close event */
		});

		const timer = setTimeout(() => {
			child.kill('SIGKILL');
			settle(new Error(`${binary} timed out after ${timeoutMs}ms`));
		}, timeoutMs);

		child.on('error', (error) => {
			settle(error);
		});

		child.on('close', (code) => {
			settle({
				stdout: Buffer.concat(stdoutChunks),
				stderr: Buffer.concat(stderrChunks).toString('utf8'),
				code: code ?? -1,
			});
		});

		if (stdinData && child.stdin) {
			child.stdin.on('error', (error: NodeJS.ErrnoException) => {
				if (error.code === 'EPIPE') {
					return;
				}
				Logger.warn({error, binary}, 'Child stdin errored');
			});
			child.stdin.end(Buffer.from(stdinData));
		}
	});
};

const probeMediaFile = async (filePath: string): Promise<ProbeResult> => {
	const {stdout, stderr, code} = await runCommand(
		'ffprobe',
		[
			'-v',
			'error',
			'-select_streams',
			'v:0',
			'-show_entries',
			'stream=width,height,nb_frames,r_frame_rate:format=duration',
			'-of',
			'json',
			filePath,
		],
		FFPROBE_TIMEOUT_MS,
	);

	if (code !== 0) {
		throw new Error(`ffprobe failed (code ${code}): ${stderr}`);
	}

	let parsed: {
		streams?: Array<{width?: number; height?: number; nb_frames?: string; r_frame_rate?: string}>;
		format?: {duration?: string};
	};
	try {
		parsed = JSON.parse(stdout.toString('utf8'));
	} catch (error) {
		throw new Error(`ffprobe output not parseable: ${error}`);
	}

	const stream = parsed.streams?.[0];
	if (!stream) {
		return {width: 0, height: 0, durationSeconds: 0, hasVideoStream: false, hasAnimation: false};
	}

	const width = stream.width ?? 0;
	const height = stream.height ?? 0;
	const durationSeconds = parsed.format?.duration ? Number.parseFloat(parsed.format.duration) : 0;
	const nbFrames = stream.nb_frames ? Number.parseInt(stream.nb_frames, 10) : 0;
	const hasAnimation = nbFrames > 1 || durationSeconds > 0.1;

	return {width, height, durationSeconds, hasVideoStream: true, hasAnimation};
};

export const transcodeToNameplateWebM = async (
	options: TranscodeNameplateOptions,
): Promise<TranscodeNameplateResult> => {
	const {input, targetWidth, targetHeight, maxDurationSeconds, targetBitrateKbps} = options;

	const workDir = await mkdtemp(path.join(os.tmpdir(), `nameplate-${crypto.randomUUID()}-`));
	const inputPath = path.join(workDir, 'input.bin');
	const webmPath = path.join(workDir, 'out.webm');
	const posterPath = path.join(workDir, 'poster.png');

	try {
		await writeFile(inputPath, Buffer.from(input));

		const videoFilter = [
			`scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=increase`,
			`crop=${targetWidth}:${targetHeight}`,
		].join(',');

		const webmArgs = [
			'-hide_banner',
			'-loglevel',
			'error',
			'-y',
			'-i',
			inputPath,
			'-t',
			String(maxDurationSeconds),
			'-an',
			'-vf',
			videoFilter,
			'-c:v',
			'libvpx-vp9',
			'-b:v',
			`${targetBitrateKbps}k`,
			'-maxrate',
			`${Math.round(targetBitrateKbps * 1.5)}k`,
			'-bufsize',
			`${targetBitrateKbps * 2}k`,
			'-deadline',
			'good',
			'-cpu-used',
			'4',
			'-row-mt',
			'1',
			'-pix_fmt',
			'yuv420p',
			webmPath,
		];

		const webmRun = await runCommand('ffmpeg', webmArgs, FFMPEG_TIMEOUT_MS);
		if (webmRun.code !== 0) {
			Logger.error({stderr: webmRun.stderr}, 'ffmpeg webm transcode failed');
			throw new Error(`ffmpeg webm transcode failed: ${webmRun.stderr}`);
		}

		const posterArgs = [
			'-hide_banner',
			'-loglevel',
			'error',
			'-y',
			'-i',
			inputPath,
			'-frames:v',
			'1',
			'-vf',
			videoFilter,
			'-c:v',
			'png',
			posterPath,
		];

		const posterRun = await runCommand('ffmpeg', posterArgs, FFMPEG_TIMEOUT_MS);
		if (posterRun.code !== 0) {
			Logger.error({stderr: posterRun.stderr}, 'ffmpeg poster extraction failed');
			throw new Error(`ffmpeg poster extraction failed: ${posterRun.stderr}`);
		}

		const [webm, poster] = await Promise.all([readFile(webmPath), readFile(posterPath)]);

		let durationSeconds = 0;
		try {
			const probed = await probeMediaFile(webmPath);
			durationSeconds = probed.durationSeconds;
		} catch (error) {
			Logger.warn({error, webmPath}, 'Failed to probe transcoded nameplate; defaulting duration to 0');
		}

		return {
			webm: new Uint8Array(webm),
			poster: new Uint8Array(poster),
			durationSeconds,
		};
	} finally {
		await rm(workDir, {recursive: true, force: true}).catch((error) => {
			Logger.warn({error, workDir}, 'Failed to clean up ffmpeg temp directory');
		});
	}
};
