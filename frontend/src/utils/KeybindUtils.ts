/*
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright (C) 2020-2026 Fluxer Contributors
 * Copyright (C) 2026 Floodilka Contributors
 * Modified by Floodilka Contributors starting March 2026. See LICENSE and NOTICE.
 */

import type {KeyCombo} from '~/stores/KeybindStore';
import {SHIFT_KEY_SYMBOL} from './KeyboardUtils';

const isMac = () => /Mac|iPod|iPhone|iPad/.test(navigator.platform);
const CONTROL_KEY_SYMBOL = '⌃';

const KEY_CODE_RE = /^Key[A-Z]$/;
const DIGIT_CODE_RE = /^Digit[0-9]$/;
const MODIFIER_LABELS: Record<string, {mac: string; other: string}> = {
	Control: {mac: CONTROL_KEY_SYMBOL, other: 'Ctrl'},
	ControlLeft: {mac: CONTROL_KEY_SYMBOL, other: 'Ctrl'},
	ControlRight: {mac: CONTROL_KEY_SYMBOL, other: 'Ctrl'},
	Ctrl: {mac: CONTROL_KEY_SYMBOL, other: 'Ctrl'},
	Shift: {mac: SHIFT_KEY_SYMBOL, other: 'Shift'},
	ShiftLeft: {mac: SHIFT_KEY_SYMBOL, other: 'Shift'},
	ShiftRight: {mac: SHIFT_KEY_SYMBOL, other: 'Shift'},
	Alt: {mac: 'вЊҐ', other: 'Alt'},
	AltLeft: {mac: 'вЊҐ', other: 'Alt'},
	AltRight: {mac: 'вЊҐ', other: 'Alt'},
	Meta: {mac: 'вЊ', other: 'Win'},
	MetaLeft: {mac: 'вЊ', other: 'Win'},
	MetaRight: {mac: 'вЊ', other: 'Win'},
	OS: {mac: 'вЊ', other: 'Win'},
	Command: {mac: 'вЊ', other: 'Win'},
};

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

const getModifierKeyLabel = (key: string): string | null => {
	const labels = MODIFIER_LABELS[key];
	if (!labels) return null;
	return isMac() ? labels.mac : labels.other;
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
	const modifierKeyLabel = getModifierKeyLabel(key);
	if (modifierKeyLabel) {
		if (!parts.includes(modifierKeyLabel)) {
			parts.push(modifierKeyLabel);
		}
		return parts.join(' + ');
	}
	if (key === ' ') {
		parts.push('Space');
	} else if (key.length === 1) {
		parts.push(key.toUpperCase());
	} else {
		parts.push(key);
	}
	return parts.join(' + ');
};

const CODE_TO_ACCELERATOR_KEY: Record<string, string> = {
	Backquote: '`',
	Minus: '-',
	Equal: '=',
	Backspace: 'Backspace',
	Tab: 'Tab',
	BracketLeft: '[',
	BracketRight: ']',
	Backslash: '\\',
	CapsLock: 'CapsLock',
	Semicolon: ';',
	Quote: "'",
	Enter: 'Enter',
	Comma: ',',
	Period: '.',
	Slash: '/',
	Space: 'Space',
	Delete: 'Delete',
	Insert: 'Insert',
	Home: 'Home',
	End: 'End',
	PageUp: 'PageUp',
	PageDown: 'PageDown',
	NumpadHome: 'Home',
	NumpadEnd: 'End',
	NumpadPageUp: 'PageUp',
	NumpadPageDown: 'PageDown',
	NumpadInsert: 'Insert',
	NumpadDelete: 'Delete',
	NumpadArrowUp: 'Up',
	NumpadArrowDown: 'Down',
	NumpadArrowLeft: 'Left',
	NumpadArrowRight: 'Right',
	ArrowUp: 'Up',
	ArrowDown: 'Down',
	ArrowLeft: 'Left',
	ArrowRight: 'Right',
	Escape: 'Escape',
};

const codeToAcceleratorKey = (code: string): string | null => {
	if (KEY_CODE_RE.test(code)) return code.slice(3);
	if (DIGIT_CODE_RE.test(code)) return code.slice(5);
	if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) return code;
	if (/^[a-zA-Z]$/.test(code)) return code.toUpperCase();
	if (/^[0-9]$/.test(code)) return code;
	return CODE_TO_ACCELERATOR_KEY[code] ?? null;
};

export const toElectronAccelerator = (combo: KeyCombo): string | null => {
	if (combo.mouseButton) return null;

	const parts: Array<string> = [];
	if (combo.ctrlOrMeta) {
		parts.push('CommandOrControl');
	}
	if (combo.ctrl) {
		parts.push('Ctrl');
	}
	if (combo.meta) {
		parts.push('Super');
	}
	if (combo.alt) {
		parts.push('Alt');
	}
	if (combo.shift) {
		parts.push('Shift');
	}

	const key = combo.code ? codeToAcceleratorKey(combo.code) : null;
	const fallbackKey = combo.key ? codeToAcceleratorKey(combo.key) : null;
	const acceleratorKey = key ?? fallbackKey;
	if (!acceleratorKey) return null;

	parts.push(acceleratorKey);
	return parts.join('+');
};
