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

import type {KeyCombo} from '~/stores/KeybindStore';
import {SHIFT_KEY_SYMBOL} from './KeyboardUtils';

const isMac = () => /Mac|iPod|iPhone|iPad/.test(navigator.platform);
const CONTROL_KEY_SYMBOL = '⌃';

const KEY_CODE_RE = /^Key[A-Z]$/;
const DIGIT_CODE_RE = /^Digit[0-9]$/;

/**
 * Normalizes event.code values (physical key identifiers) to standard key names.
 * e.g. 'KeyM' → 'M', 'Digit5' → '5'
 *
 * Numpad codes (NumpadEnter, Numpad0, etc.) are intentionally NOT normalized
 * because they represent distinct physical keys that should not be conflated
 * with their non-numpad equivalents.
 */
export const resolveComboKey = (combo: {code?: string; key?: string}): string => {
	const raw = combo.code ?? combo.key ?? '';
	if (KEY_CODE_RE.test(raw)) return raw.slice(3);
	if (DIGIT_CODE_RE.test(raw)) return raw.slice(5);
	return raw;
};

export const formatKeyCombo = (combo: KeyCombo): string => {
	const parts: Array<string> = [];
	if (combo.ctrl) {
		parts.push(isMac() ? CONTROL_KEY_SYMBOL : 'Ctrl');
	} else if (combo.ctrlOrMeta) {
		parts.push(isMac() ? '⌘' : 'Ctrl');
	}
	if (combo.meta) {
		parts.push(isMac() ? '⌘' : 'Win');
	}
	if (combo.shift) {
		const shiftLabel = isMac() ? SHIFT_KEY_SYMBOL : 'Shift';
		parts.push(shiftLabel);
	}
	if (combo.alt) parts.push(isMac() ? '⌥' : 'Alt');
	if (combo.mouseButton) {
		parts.push(`Mouse ${combo.mouseButton}`);
		return parts.join(' + ');
	}
	const key = resolveComboKey(combo);
	if (key === ' ') {
		parts.push('Space');
	} else if (key.length === 1) {
		parts.push(key.toUpperCase());
	} else {
		parts.push(key);
	}
	return parts.join(' + ');
};
