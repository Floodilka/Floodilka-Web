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
import {formatKeyCombo, resolveComboKey} from '~/utils/KeybindUtils';

describe('resolveComboKey', () => {
	describe('KeyX code normalization', () => {
		test('normalizes KeyM to M', () => {
			expect(resolveComboKey({code: 'KeyM', key: 'M'})).toBe('M');
		});

		test('normalizes KeyA to A', () => {
			expect(resolveComboKey({code: 'KeyA', key: 'a'})).toBe('A');
		});

		test('normalizes KeyZ to Z', () => {
			expect(resolveComboKey({code: 'KeyZ', key: 'z'})).toBe('Z');
		});

		test('normalizes all letter codes KeyA through KeyZ', () => {
			for (let i = 0; i < 26; i++) {
				const letter = String.fromCharCode(65 + i);
				expect(resolveComboKey({code: `Key${letter}`})).toBe(letter);
			}
		});
	});

	describe('DigitX code normalization', () => {
		test('normalizes Digit0 to 0', () => {
			expect(resolveComboKey({code: 'Digit0', key: '0'})).toBe('0');
		});

		test('normalizes Digit9 to 9', () => {
			expect(resolveComboKey({code: 'Digit9', key: '9'})).toBe('9');
		});

		test('normalizes all digit codes Digit0 through Digit9', () => {
			for (let i = 0; i <= 9; i++) {
				expect(resolveComboKey({code: `Digit${i}`})).toBe(String(i));
			}
		});
	});

	describe('Numpad codes are NOT normalized', () => {
		test('keeps NumpadEnter as NumpadEnter', () => {
			expect(resolveComboKey({code: 'NumpadEnter', key: 'Enter'})).toBe('NumpadEnter');
		});

		test('keeps Numpad0 as Numpad0', () => {
			expect(resolveComboKey({code: 'Numpad0', key: '0'})).toBe('Numpad0');
		});

		test('keeps Numpad5 as Numpad5', () => {
			expect(resolveComboKey({code: 'Numpad5', key: '5'})).toBe('Numpad5');
		});

		test('keeps NumpadAdd as NumpadAdd', () => {
			expect(resolveComboKey({code: 'NumpadAdd', key: '+'})).toBe('NumpadAdd');
		});
	});

	describe('fallback to key when code is absent', () => {
		test('uses key when code is undefined', () => {
			expect(resolveComboKey({key: 'm'})).toBe('m');
		});

		test('returns empty string when both are undefined', () => {
			expect(resolveComboKey({})).toBe('');
		});

		test('uses key when code is undefined for special keys', () => {
			expect(resolveComboKey({key: 'Enter'})).toBe('Enter');
		});
	});

	describe('passthrough for non-KeyX/DigitX codes', () => {
		test('passes through Space', () => {
			expect(resolveComboKey({code: 'Space', key: ' '})).toBe('Space');
		});

		test('passes through Enter', () => {
			expect(resolveComboKey({code: 'Enter', key: 'Enter'})).toBe('Enter');
		});

		test('passes through ArrowUp', () => {
			expect(resolveComboKey({code: 'ArrowUp', key: 'ArrowUp'})).toBe('ArrowUp');
		});

		test('passes through Escape', () => {
			expect(resolveComboKey({code: 'Escape', key: 'Escape'})).toBe('Escape');
		});

		test('passes through F1', () => {
			expect(resolveComboKey({code: 'F1', key: 'F1'})).toBe('F1');
		});
	});

	describe('bug reproduction: re-recorded shortcuts', () => {
		test('re-recorded Ctrl+Shift+M produces M not KeyM', () => {
			const reRecordedCombo = {code: 'KeyM', key: 'M'};
			expect(resolveComboKey(reRecordedCombo)).toBe('M');
		});

		test('default combo without code still works', () => {
			const defaultCombo = {key: 'm'};
			expect(resolveComboKey(defaultCombo)).toBe('m');
		});

		test('re-recorded Ctrl+Shift+5 produces 5 not Digit5', () => {
			const reRecordedCombo = {code: 'Digit5', key: '5'};
			expect(resolveComboKey(reRecordedCombo)).toBe('5');
		});
	});
});

describe('formatKeyCombo', () => {
	describe('basic key display', () => {
		test('formats single letter key', () => {
			expect(formatKeyCombo({key: 'm'})).toBe('M');
		});

		test('formats space key', () => {
			expect(formatKeyCombo({key: ' '})).toBe('Space');
		});

		test('formats named key', () => {
			expect(formatKeyCombo({key: 'Enter'})).toBe('Enter');
		});
	});

	describe('modifier combinations (non-Mac)', () => {
		test('formats Ctrl+Shift+M default combo', () => {
			const result = formatKeyCombo({key: 'm', ctrlOrMeta: true, shift: true});
			expect(result).toBe('Ctrl + Shift + M');
		});

		test('formats Alt+key', () => {
			const result = formatKeyCombo({key: 'a', alt: true});
			expect(result).toBe('Alt + A');
		});

		test('formats Ctrl+key', () => {
			const result = formatKeyCombo({key: 'c', ctrl: true});
			expect(result).toBe('Ctrl + C');
		});
	});

	describe('bug reproduction: code normalization in display', () => {
		test('re-recorded Ctrl+Shift+M shows M not KeyM', () => {
			const reRecordedCombo = {key: 'M', code: 'KeyM', ctrlOrMeta: true, shift: true};
			const result = formatKeyCombo(reRecordedCombo);
			expect(result).toBe('Ctrl + Shift + M');
		});

		test('re-recorded Ctrl+5 shows 5 not Digit5', () => {
			const reRecordedCombo = {key: '5', code: 'Digit5', ctrlOrMeta: true};
			const result = formatKeyCombo(reRecordedCombo);
			expect(result).toBe('Ctrl + 5');
		});

		test('default combo without code displays identically to re-recorded', () => {
			const defaultCombo = {key: 'm', ctrlOrMeta: true, shift: true};
			const reRecordedCombo = {key: 'M', code: 'KeyM', ctrlOrMeta: true, shift: true};
			expect(formatKeyCombo(defaultCombo)).toBe(formatKeyCombo(reRecordedCombo));
		});
	});

	describe('NumpadEnter display', () => {
		test('displays NumpadEnter as NumpadEnter (distinct from Enter)', () => {
			const result = formatKeyCombo({key: 'Enter', code: 'NumpadEnter'});
			expect(result).toBe('NumpadEnter');
		});

		test('displays regular Enter as Enter', () => {
			const result = formatKeyCombo({key: 'Enter', code: 'Enter'});
			expect(result).toBe('Enter');
		});
	});
});
