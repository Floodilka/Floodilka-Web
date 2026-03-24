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
