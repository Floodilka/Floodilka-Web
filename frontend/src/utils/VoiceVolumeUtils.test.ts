import {describe, expect, it} from 'vitest';
import {clampVoiceVolumePercent, composeVolumePercent, voiceVolumePercentToTrackVolume} from './VoiceVolumeUtils';

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

describe('voiceVolumePercentToTrackVolume', () => {
	it('converts 0% to 0.0', () => {
		expect(voiceVolumePercentToTrackVolume(0)).toBe(0);
	});

	it('converts 50% to 0.5', () => {
		expect(voiceVolumePercentToTrackVolume(50)).toBe(0.5);
	});

	it('converts 100% to 1.0', () => {
		expect(voiceVolumePercentToTrackVolume(100)).toBe(1);
	});

	it('caps at 1.0 for values above 100%', () => {
		expect(voiceVolumePercentToTrackVolume(150)).toBe(1);
		expect(voiceVolumePercentToTrackVolume(200)).toBe(1);
	});

	it('returns 0 for negative values', () => {
		expect(voiceVolumePercentToTrackVolume(-10)).toBe(0);
	});

	it('returns 1.0 for NaN (defaults to 100)', () => {
		expect(voiceVolumePercentToTrackVolume(NaN)).toBe(1);
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
		// 100 * (50/100) = 50
		expect(composeVolumePercent(50)).toBe(50);

		// 100 * (50/100) * (50/100) = 25
		expect(composeVolumePercent(50, 50)).toBe(25);

		// 100 * (100/100) * (100/100) = 100
		expect(composeVolumePercent(100, 100)).toBe(100);
	});

	it('handles per-user boost (200%) with global output', () => {
		// 100 * (200/100) * (100/100) = 200
		expect(composeVolumePercent(200, 100)).toBe(200);

		// 100 * (200/100) * (50/100) = 100
		expect(composeVolumePercent(200, 50)).toBe(100);

		// 100 * (150/100) * (80/100) = 120
		expect(composeVolumePercent(150, 80)).toBe(120);
	});

	it('clamps result to 200', () => {
		// Would exceed 200 without clamping: 100 * (200/100) * (200/100) = 400 -> clamped to 200
		expect(composeVolumePercent(200, 200)).toBe(200);
	});

	it('composes three volume sources', () => {
		// 100 * (100/100) * (100/100) * (100/100) = 100
		expect(composeVolumePercent(100, 100, 100)).toBe(100);

		// 100 * (50/100) * (50/100) * (50/100) = 12.5
		expect(composeVolumePercent(50, 50, 50)).toBe(12.5);
	});
});

describe('end-to-end volume calculation', () => {
	it('output volume 0% silences all audio', () => {
		const userVolume = 100;
		const outputVolume = 0;
		const trackVolume = voiceVolumePercentToTrackVolume(composeVolumePercent(userVolume, outputVolume));
		expect(trackVolume).toBe(0);
	});

	it('output volume 100% with user volume 100% = full volume', () => {
		const userVolume = 100;
		const outputVolume = 100;
		const trackVolume = voiceVolumePercentToTrackVolume(composeVolumePercent(userVolume, outputVolume));
		expect(trackVolume).toBe(1);
	});

	it('output volume 50% halves the effective volume', () => {
		const userVolume = 100;
		const outputVolume = 50;
		const trackVolume = voiceVolumePercentToTrackVolume(composeVolumePercent(userVolume, outputVolume));
		expect(trackVolume).toBe(0.5);
	});

	it('per-user boost compensates for low output volume', () => {
		const userVolume = 200; // 2x boost
		const outputVolume = 50; // half global
		// composed: 100 * 2 * 0.5 = 100 -> track: 1.0
		const trackVolume = voiceVolumePercentToTrackVolume(composeVolumePercent(userVolume, outputVolume));
		expect(trackVolume).toBe(1);
	});

	it('output volume 10% makes audio very quiet', () => {
		const userVolume = 100;
		const outputVolume = 10;
		const trackVolume = voiceVolumePercentToTrackVolume(composeVolumePercent(userVolume, outputVolume));
		expect(trackVolume).toBe(0.1);
	});
});
