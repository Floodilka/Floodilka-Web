import {describe, expect, it} from 'vitest';
import {
	clampVoiceVolumePercent,
	composeVolumePercent,
	MAX_VOICE_TRACK_GAIN,
	voiceVolumePercentToBoostedGain,
	voiceVolumePercentToCappedVolume,
} from './VoiceVolumeUtils';

describe('clampVoiceVolumePercent', () => {
	it('returns 100 for NaN', () => {
		expect(clampVoiceVolumePercent(NaN)).toBe(100);
	});

	it('returns 100 for Infinity', () => {
		expect(clampVoiceVolumePercent(Infinity)).toBe(100);
		expect(clampVoiceVolumePercent(-Infinity)).toBe(100);
	});

	it('clamps to 0 minimum', () => {
		expect(clampVoiceVolumePercent(-10)).toBe(0);
		expect(clampVoiceVolumePercent(-1)).toBe(0);
	});

	it('clamps to 200 maximum', () => {
		expect(clampVoiceVolumePercent(250)).toBe(200);
		expect(clampVoiceVolumePercent(300)).toBe(200);
	});

	it('passes through valid values', () => {
		expect(clampVoiceVolumePercent(0)).toBe(0);
		expect(clampVoiceVolumePercent(50)).toBe(50);
		expect(clampVoiceVolumePercent(100)).toBe(100);
		expect(clampVoiceVolumePercent(150)).toBe(150);
		expect(clampVoiceVolumePercent(200)).toBe(200);
	});
});

describe('voiceVolumePercentToCappedVolume', () => {
	it('converts 0% to 0.0', () => {
		expect(voiceVolumePercentToCappedVolume(0)).toBe(0);
	});

	it('converts 50% to 0.5', () => {
		expect(voiceVolumePercentToCappedVolume(50)).toBe(0.5);
	});

	it('converts 100% to 1.0', () => {
		expect(voiceVolumePercentToCappedVolume(100)).toBe(1);
	});

	it('caps at 1.0 for values above 100%', () => {
		expect(voiceVolumePercentToCappedVolume(150)).toBe(1);
		expect(voiceVolumePercentToCappedVolume(200)).toBe(1);
		expect(voiceVolumePercentToCappedVolume(10000)).toBe(1);
	});

	it('returns 0 for negative values', () => {
		expect(voiceVolumePercentToCappedVolume(-10)).toBe(0);
	});

	it('returns 1.0 for NaN (defaults to 100)', () => {
		expect(voiceVolumePercentToCappedVolume(NaN)).toBe(1);
	});
});

describe('voiceVolumePercentToBoostedGain', () => {
	it('converts 0% to 0.0', () => {
		expect(voiceVolumePercentToBoostedGain(0)).toBe(0);
	});

	it('converts 100% to 1.0 (unity gain)', () => {
		expect(voiceVolumePercentToBoostedGain(100)).toBe(1);
	});

	it('converts 150% to 1.5 (boost)', () => {
		expect(voiceVolumePercentToBoostedGain(150)).toBe(1.5);
	});

	it('converts 200% to 2.0 (max boost)', () => {
		expect(voiceVolumePercentToBoostedGain(200)).toBe(2);
	});

	it('caps at MAX_VOICE_TRACK_GAIN for values above 200%', () => {
		expect(voiceVolumePercentToBoostedGain(250)).toBe(MAX_VOICE_TRACK_GAIN);
		expect(voiceVolumePercentToBoostedGain(10000)).toBe(MAX_VOICE_TRACK_GAIN);
	});

	it('returns 0 for negative values', () => {
		expect(voiceVolumePercentToBoostedGain(-10)).toBe(0);
	});

	it('returns 1.0 for NaN (defaults to 100)', () => {
		expect(voiceVolumePercentToBoostedGain(NaN)).toBe(1);
	});
});

describe('composeVolumePercent', () => {
	it('returns 100 for single 100% input', () => {
		expect(composeVolumePercent(100)).toBe(100);
	});

	it('returns 0 for any zero input', () => {
		expect(composeVolumePercent(0)).toBe(0);
		expect(composeVolumePercent(100, 0)).toBe(0);
		expect(composeVolumePercent(0, 100)).toBe(0);
		expect(composeVolumePercent(100, 100, 0)).toBe(0);
	});

	it('multiplies percentages correctly', () => {
		expect(composeVolumePercent(50)).toBe(50);
		expect(composeVolumePercent(50, 50)).toBe(25);
		expect(composeVolumePercent(100, 100)).toBe(100);
	});

	it('handles per-user boost (200%) with global output', () => {
		expect(composeVolumePercent(200, 100)).toBe(200);
		expect(composeVolumePercent(200, 50)).toBe(100);
		expect(composeVolumePercent(150, 80)).toBe(120);
	});

	it('clamps result to 200', () => {
		expect(composeVolumePercent(200, 200)).toBe(200);
	});

	it('composes three volume sources', () => {
		expect(composeVolumePercent(100, 100, 100)).toBe(100);
		expect(composeVolumePercent(50, 50, 50)).toBe(12.5);
	});
});

describe('end-to-end volume calculation (capped path — pre-WebAudio / fallback)', () => {
	it('output volume 0% silences all audio', () => {
		const trackVolume = voiceVolumePercentToCappedVolume(composeVolumePercent(100, 0));
		expect(trackVolume).toBe(0);
	});

	it('output volume 100% with user volume 100% = full volume', () => {
		const trackVolume = voiceVolumePercentToCappedVolume(composeVolumePercent(100, 100));
		expect(trackVolume).toBe(1);
	});

	it('output volume 50% halves the effective volume', () => {
		const trackVolume = voiceVolumePercentToCappedVolume(composeVolumePercent(100, 50));
		expect(trackVolume).toBe(0.5);
	});

	it('per-user boost compensates for low output volume up to 1.0', () => {
		const trackVolume = voiceVolumePercentToCappedVolume(composeVolumePercent(200, 50));
		expect(trackVolume).toBe(1);
	});

	it('output volume 10% makes audio very quiet', () => {
		const trackVolume = voiceVolumePercentToCappedVolume(composeVolumePercent(100, 10));
		expect(trackVolume).toBeCloseTo(0.1);
	});

	it('never exceeds 1.0 even with extreme inputs (safe for HTMLMediaElement)', () => {
		expect(voiceVolumePercentToCappedVolume(composeVolumePercent(200, 200))).toBe(1);
		expect(voiceVolumePercentToCappedVolume(composeVolumePercent(200, 100))).toBe(1);
	});
});

describe('end-to-end volume calculation (boosted path — WebAudio GainNode)', () => {
	it('output volume 100%, user 200% -> 2x gain', () => {
		const trackVolume = voiceVolumePercentToBoostedGain(composeVolumePercent(200, 100));
		expect(trackVolume).toBe(2);
	});

	it('output volume 50%, user 200% -> composed 100% -> 1.0 gain', () => {
		const trackVolume = voiceVolumePercentToBoostedGain(composeVolumePercent(200, 50));
		expect(trackVolume).toBe(1);
	});

	it('output volume 100%, user 150% -> 1.5x gain', () => {
		const trackVolume = voiceVolumePercentToBoostedGain(composeVolumePercent(150, 100));
		expect(trackVolume).toBe(1.5);
	});

	it('never exceeds MAX_VOICE_TRACK_GAIN even with extreme inputs', () => {
		expect(voiceVolumePercentToBoostedGain(composeVolumePercent(200, 200))).toBe(MAX_VOICE_TRACK_GAIN);
	});

	it('still silences at output 0 or user 0', () => {
		expect(voiceVolumePercentToBoostedGain(composeVolumePercent(200, 0))).toBe(0);
		expect(voiceVolumePercentToBoostedGain(composeVolumePercent(0, 100))).toBe(0);
	});
});
