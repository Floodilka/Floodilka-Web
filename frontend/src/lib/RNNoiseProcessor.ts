/*
 * Copyright (C) 2026 Fluxer Contributors
 *
 * This file is part of Fluxer.
 *
 * Fluxer is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Fluxer is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Fluxer. If not, see <https://www.gnu.org/licenses/>.
 */

import type {AudioProcessorOptions, TrackProcessor} from 'livekit-client';
import {Track} from 'livekit-client';

const RNNOISE_SAMPLE_RATE = 48000;
const RNNOISE_FRAME_SIZE = 480;
const RENDER_QUANTUM = 128;

// AudioWorklet processor code — runs in the worklet scope
const workletCode = `
const FRAME_SIZE = ${RNNOISE_FRAME_SIZE};
const RENDER_QUANTUM = ${RENDER_QUANTUM};
const FLOAT_SIZE = 4;
// Ring buffer size: must hold at least 2 full frames to avoid overlap
const BUFFER_SIZE = FRAME_SIZE * 4;

class RNNoiseWorklet extends AudioWorkletProcessor {
	constructor() {
		super();
		this.ready = false;
		this.wasmExports = null;
		this.memory = null;
		this.state = 0;
		this.wasmInput = 0;
		this.wasmOutput = 0;

		// Ring buffers
		this.inputBuffer = new Float32Array(BUFFER_SIZE);
		this.outputBuffer = new Float32Array(BUFFER_SIZE);
		this.inputReadPos = 0;
		this.inputWritePos = 0;
		this.inputCount = 0;
		this.outputReadPos = 0;
		this.outputWritePos = 0;
		this.outputCount = 0;

		this.port.onmessage = (e) => {
			if (e.data.type === 'init') {
				this._initWasm(e.data.wasmBinary).then(() => {
					this.ready = true;
					this.port.postMessage({ type: 'ready' });
				}).catch((err) => {
					this.port.postMessage({ type: 'error', message: String(err) });
				});
			}
		};
	}

	async _initWasm(wasmBinary) {
		let memory = null;

		const importObj = {
			a: {
				a: () => {
					// emscripten_resize_heap — not needed, memory is pre-allocated
					return 0;
				},
				b: (dest, src, len) => {
					// emscripten_memcpy_big
					const heap = new Uint8Array(memory.buffer);
					heap.copyWithin(dest, src, src + len);
				},
			},
		};

		const result = await WebAssembly.instantiate(wasmBinary, importObj);
		const exports = result.instance.exports;

		memory = exports.c; // exported Memory
		this.wasmExports = exports;
		this.memory = memory;

		// __wasm_call_ctors (required emscripten init)
		exports.d();
		// rnnoise_create(NULL) — allocates state with default model
		this.state = exports.f(0);
		// malloc input/output buffers in WASM heap
		this.wasmInput = exports.g(FRAME_SIZE * FLOAT_SIZE);
		this.wasmOutput = exports.g(FRAME_SIZE * FLOAT_SIZE);
	}

	process(inputs, outputs) {
		const input = inputs[0]?.[0];
		const output = outputs[0]?.[0];

		if (!input || !output) return true;

		if (!this.ready) {
			// Pass through while WASM is loading
			output.set(input);
			return true;
		}

		// Write input to ring buffer, scaled to [-32768, 32767]
		for (let i = 0; i < input.length; i++) {
			this.inputBuffer[this.inputWritePos] = input[i] * 32768;
			this.inputWritePos = (this.inputWritePos + 1) % BUFFER_SIZE;
		}
		this.inputCount += input.length;

		// Process all available full frames
		while (this.inputCount >= FRAME_SIZE) {
			this._processFrame();
		}

		// Read processed output from ring buffer
		if (this.outputCount >= RENDER_QUANTUM) {
			for (let i = 0; i < RENDER_QUANTUM; i++) {
				output[i] = this.outputBuffer[this.outputReadPos] / 32768;
				this.outputReadPos = (this.outputReadPos + 1) % BUFFER_SIZE;
			}
			this.outputCount -= RENDER_QUANTUM;
		} else {
			// Not enough processed output yet — pass through
			output.set(input);
		}

		return true;
	}

	_processFrame() {
		const heap = new Float32Array(this.memory.buffer);
		const inOff = this.wasmInput / FLOAT_SIZE;
		const outOff = this.wasmOutput / FLOAT_SIZE;

		// Copy FRAME_SIZE samples from input ring buffer to WASM heap
		for (let i = 0; i < FRAME_SIZE; i++) {
			heap[inOff + i] = this.inputBuffer[this.inputReadPos];
			this.inputReadPos = (this.inputReadPos + 1) % BUFFER_SIZE;
		}
		this.inputCount -= FRAME_SIZE;

		// rnnoise_process_frame(state, out_ptr, in_ptr) → returns VAD probability
		this.wasmExports.j(this.state, this.wasmOutput, this.wasmInput);

		// Copy processed samples from WASM heap to output ring buffer
		for (let i = 0; i < FRAME_SIZE; i++) {
			this.outputBuffer[this.outputWritePos] = heap[outOff + i];
			this.outputWritePos = (this.outputWritePos + 1) % BUFFER_SIZE;
		}
		this.outputCount += FRAME_SIZE;
	}
}

registerProcessor('rnnoise-processor', RNNoiseWorklet);
`;

let cachedWasmBinary: ArrayBuffer | null = null;
let preloadPromise: Promise<ArrayBuffer> | null = null;

async function loadWasmBinary(): Promise<ArrayBuffer> {
	if (cachedWasmBinary) return cachedWasmBinary;
	const response = await fetch('/assets/rnnoise/rnnoise.wasm');
	if (!response.ok) throw new Error(`Failed to load RNNoise WASM: ${response.status}`);
	cachedWasmBinary = await response.arrayBuffer();
	return cachedWasmBinary;
}

/**
 * Preload WASM binary so it's ready when the user joins a voice channel.
 * Call this early (e.g. on app startup).
 */
export function preloadRNNoiseWasm(): void {
	if (!preloadPromise && typeof WebAssembly !== 'undefined') {
		preloadPromise = loadWasmBinary().catch(() => null as unknown as ArrayBuffer);
	}
}

export class RNNoiseProcessor implements TrackProcessor<Track.Kind.Audio, AudioProcessorOptions> {
	name = 'rnnoise-processor';
	processedTrack?: MediaStreamTrack;

	private audioContext: AudioContext | null = null;
	private sourceNode: MediaStreamAudioSourceNode | null = null;
	private workletNode: AudioWorkletNode | null = null;
	private destination: MediaStreamAudioDestinationNode | null = null;
	private workletUrl: string | null = null;

	static isSupported(): boolean {
		return typeof AudioWorkletNode !== 'undefined' && typeof WebAssembly !== 'undefined';
	}

	init = async (opts: AudioProcessorOptions): Promise<void> => {
		const track = opts.track;
		await this.ensureGraph(track);
	};

	restart = async (opts: AudioProcessorOptions): Promise<void> => {
		await this.teardownGraph();
		const track = opts.track;
		await this.ensureGraph(track);
	};

	destroy = async (): Promise<void> => {
		await this.teardownGraph();
	};

	private async ensureGraph(track: MediaStreamTrack): Promise<void> {
		console.log('[RNNoise] Initializing audio graph...');
		this.audioContext = new AudioContext({sampleRate: RNNOISE_SAMPLE_RATE});
		console.log('[RNNoise] AudioContext state after creation:', this.audioContext.state);

		// Register worklet
		const blob = new Blob([workletCode], {type: 'application/javascript'});
		this.workletUrl = URL.createObjectURL(blob);
		await this.audioContext.audioWorklet.addModule(this.workletUrl);

		// Create nodes
		this.sourceNode = this.audioContext.createMediaStreamSource(new MediaStream([track]));
		this.workletNode = new AudioWorkletNode(this.audioContext, 'rnnoise-processor', {
			numberOfInputs: 1,
			numberOfOutputs: 1,
			outputChannelCount: [1],
		});
		this.destination = this.audioContext.createMediaStreamDestination();

		// Load and send WASM binary to worklet
		const wasmBinary = await loadWasmBinary();

		await new Promise<void>((resolve, reject) => {
			const timeout = setTimeout(() => reject(new Error('RNNoise worklet init timeout')), 10000);

			this.workletNode!.port.onmessage = (e: MessageEvent) => {
				if (e.data.type === 'ready') {
					clearTimeout(timeout);
					resolve();
				} else if (e.data.type === 'error') {
					clearTimeout(timeout);
					reject(new Error(e.data.message));
				}
			};

			this.workletNode!.port.postMessage({type: 'init', wasmBinary}, [wasmBinary.slice(0)]);
		});

		// Connect audio graph
		this.sourceNode.connect(this.workletNode);
		this.workletNode.connect(this.destination);

		this.processedTrack = this.destination.stream.getAudioTracks()[0];
		console.log('[RNNoise] Processor ready and connected');
	}

	private async teardownGraph(): Promise<void> {
		if (this.sourceNode) {
			this.sourceNode.disconnect();
			this.sourceNode = null;
		}
		if (this.workletNode) {
			this.workletNode.disconnect();
			this.workletNode.port.close();
			this.workletNode = null;
		}
		if (this.destination) {
			this.destination.stream.getTracks().forEach((t) => t.stop());
			this.destination = null;
		}
		if (this.audioContext) {
			await this.audioContext.close().catch(() => {});
			this.audioContext = null;
		}
		if (this.workletUrl) {
			URL.revokeObjectURL(this.workletUrl);
			this.workletUrl = null;
		}
		this.processedTrack = undefined;
	}
}

export function createRNNoiseProcessor(): RNNoiseProcessor {
	return new RNNoiseProcessor();
}
