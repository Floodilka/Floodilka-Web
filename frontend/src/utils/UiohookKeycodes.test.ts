/*
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright (C) 2020-2026 Fluxer Contributors
 * Copyright (C) 2026 Floodilka Contributors
 * Modified by Floodilka Contributors starting March 2026. See LICENSE and NOTICE.
 */

import {describe, expect, test} from 'vitest';
import {jsKeyToUiohookKeycode, UiohookKeycode} from '~/utils/UiohookKeycodes';

describe('jsKeyToUiohookKeycode', () => {
	describe('event.code values (from recorded combos)', () => {
		test('maps KeyM code to correct keycode', () => {
			expect(jsKeyToUiohookKeycode('KeyM')).toBe(UiohookKeycode.KeyM);
		});

		test('maps KeyA code to correct keycode', () => {
			expect(jsKeyToUiohookKeycode('KeyA')).toBe(UiohookKeycode.KeyA);
		});

		test('maps Digit5 code to correct keycode', () => {
			expect(jsKeyToUiohookKeycode('Digit5')).toBe(UiohookKeycode.Digit5);
		});

		test('maps NumpadEnter code to correct keycode', () => {
			expect(jsKeyToUiohookKeycode('NumpadEnter')).toBe(UiohookKeycode.NumpadEnter);
		});

		test('maps NumpadEnter to a DIFFERENT keycode than Enter', () => {
			expect(jsKeyToUiohookKeycode('NumpadEnter')).not.toBe(jsKeyToUiohookKeycode('Enter'));
		});

		test('maps Enter code to correct keycode', () => {
			expect(jsKeyToUiohookKeycode('Enter')).toBe(UiohookKeycode.Enter);
		});

		test('maps Space code to correct keycode', () => {
			expect(jsKeyToUiohookKeycode('Space')).toBe(UiohookKeycode.Space);
		});

		test('maps modifier codes to correct keycodes', () => {
			expect(jsKeyToUiohookKeycode('ControlLeft')).toBe(UiohookKeycode.ControlLeft);
			expect(jsKeyToUiohookKeycode('AltLeft')).toBe(UiohookKeycode.AltLeft);
			expect(jsKeyToUiohookKeycode('ShiftLeft')).toBe(UiohookKeycode.ShiftLeft);
		});
	});

	describe('event.key values (from default combos without code)', () => {
		test('maps uppercase M to KeyM keycode', () => {
			expect(jsKeyToUiohookKeycode('M')).toBe(UiohookKeycode.KeyM);
		});

		test('maps lowercase m to KeyM keycode', () => {
			expect(jsKeyToUiohookKeycode('m')).toBe(UiohookKeycode.KeyM);
		});

		test('maps digit character 5 to Digit5 keycode', () => {
			expect(jsKeyToUiohookKeycode('5')).toBe(UiohookKeycode.Digit5);
		});

		test('maps space character to Space keycode', () => {
			expect(jsKeyToUiohookKeycode(' ')).toBe(UiohookKeycode.Space);
		});

		test('maps modifier key names to left-side keycodes', () => {
			expect(jsKeyToUiohookKeycode('Control')).toBe(UiohookKeycode.ControlLeft);
			expect(jsKeyToUiohookKeycode('ctrl')).toBe(UiohookKeycode.ControlLeft);
			expect(jsKeyToUiohookKeycode('Alt')).toBe(UiohookKeycode.AltLeft);
			expect(jsKeyToUiohookKeycode('Shift')).toBe(UiohookKeycode.ShiftLeft);
		});
	});

	describe('numpad keys are distinct', () => {
		test('Numpad0 through Numpad9 map to unique keycodes', () => {
			for (let i = 0; i <= 9; i++) {
				const keycode = jsKeyToUiohookKeycode(`Numpad${i}`);
				expect(keycode).not.toBeNull();
				expect(keycode).toBe(UiohookKeycode[`Numpad${i}` as keyof typeof UiohookKeycode]);
			}
		});

		test('NumpadAdd maps correctly', () => {
			expect(jsKeyToUiohookKeycode('NumpadAdd')).toBe(UiohookKeycode.NumpadAdd);
		});

		test('NumpadSubtract maps correctly', () => {
			expect(jsKeyToUiohookKeycode('NumpadSubtract')).toBe(UiohookKeycode.NumpadSubtract);
		});

		test('NumpadMultiply maps correctly', () => {
			expect(jsKeyToUiohookKeycode('NumpadMultiply')).toBe(UiohookKeycode.NumpadMultiply);
		});

		test('NumpadDivide maps correctly', () => {
			expect(jsKeyToUiohookKeycode('NumpadDivide')).toBe(UiohookKeycode.NumpadDivide);
		});

		test('NumpadDecimal maps correctly', () => {
			expect(jsKeyToUiohookKeycode('NumpadDecimal')).toBe(UiohookKeycode.NumpadDecimal);
		});
	});

	describe('all letter keys', () => {
		test('all uppercase letters A-Z map to keycodes', () => {
			for (let i = 0; i < 26; i++) {
				const letter = String.fromCharCode(65 + i);
				expect(jsKeyToUiohookKeycode(letter)).not.toBeNull();
			}
		});

		test('all lowercase letters a-z map to keycodes', () => {
			for (let i = 0; i < 26; i++) {
				const letter = String.fromCharCode(97 + i);
				expect(jsKeyToUiohookKeycode(letter)).not.toBeNull();
			}
		});

		test('uppercase and lowercase map to the same keycode', () => {
			for (let i = 0; i < 26; i++) {
				const upper = String.fromCharCode(65 + i);
				const lower = String.fromCharCode(97 + i);
				expect(jsKeyToUiohookKeycode(upper)).toBe(jsKeyToUiohookKeycode(lower));
			}
		});
	});

	describe('edge cases', () => {
		test('returns null for undefined', () => {
			expect(jsKeyToUiohookKeycode(undefined)).toBeNull();
		});

		test('returns null for empty string', () => {
			expect(jsKeyToUiohookKeycode('')).toBeNull();
		});

		test('returns null for unknown key', () => {
			expect(jsKeyToUiohookKeycode('SomeUnknownKey')).toBeNull();
		});
	});

	describe('combo.code ?? combo.key usage pattern', () => {
		test('default combo (key only): m resolves to correct keycode', () => {
			const combo = {code: undefined, key: 'm'};
			expect(jsKeyToUiohookKeycode(combo.code ?? combo.key)).toBe(UiohookKeycode.KeyM);
		});

		test('re-recorded combo (code present): KeyM resolves to correct keycode', () => {
			const combo = {code: 'KeyM', key: 'M'};
			expect(jsKeyToUiohookKeycode(combo.code ?? combo.key)).toBe(UiohookKeycode.KeyM);
		});

		test('default and re-recorded combos resolve to same keycode', () => {
			const defaultCombo = {code: undefined, key: 'm'};
			const reRecordedCombo = {code: 'KeyM', key: 'M'};
			expect(jsKeyToUiohookKeycode(defaultCombo.code ?? defaultCombo.key)).toBe(
				jsKeyToUiohookKeycode(reRecordedCombo.code ?? reRecordedCombo.key),
			);
		});

		test('NumpadEnter combo resolves to NumpadEnter keycode', () => {
			const combo = {code: 'NumpadEnter', key: 'Enter'};
			expect(jsKeyToUiohookKeycode(combo.code ?? combo.key)).toBe(UiohookKeycode.NumpadEnter);
		});
	});
});
