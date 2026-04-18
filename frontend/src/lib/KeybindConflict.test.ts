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

import type {I18n} from '@lingui/core';
import {runInAction} from 'mobx';
import {beforeEach, describe, expect, test} from 'vitest';
import KeybindStore from '~/stores/KeybindStore';
import {areCombosEquivalent, findActionConflict, findConflicts, findReservedConflict} from './KeybindConflict';

const mockI18n = {_: (descriptor: any) => descriptor?.message ?? descriptor ?? ''} as unknown as I18n;

function resetStore(): void {
	runInAction(() => {
		(KeybindStore as any).initialized = false;
		(KeybindStore as any).keybinds = {};
		(KeybindStore as any).i18n = null;
	});
}

beforeEach(() => {
	resetStore();
	KeybindStore.setI18n(mockI18n);
});

describe('areCombosEquivalent', () => {
	test('same letter combo with same modifiers', () => {
		expect(areCombosEquivalent({key: 'k', ctrlOrMeta: true}, {key: 'k', ctrlOrMeta: true}, 'mac')).toBe(true);
	});

	test('code preferred over key for layout independence', () => {
		expect(
			areCombosEquivalent(
				{key: 'к', code: 'KeyK', ctrlOrMeta: true},
				{key: 'k', code: 'KeyK', ctrlOrMeta: true},
				'mac',
			),
		).toBe(true);
	});

	test('different modifiers → not equivalent', () => {
		expect(areCombosEquivalent({key: 'k', ctrlOrMeta: true}, {key: 'k', ctrlOrMeta: true, shift: true}, 'mac')).toBe(
			false,
		);
	});

	test('ctrl vs ctrlOrMeta on Mac are different (Ctrl only vs Cmd)', () => {
		expect(areCombosEquivalent({key: 'k', ctrl: true}, {key: 'k', ctrlOrMeta: true}, 'mac')).toBe(false);
	});

	test('ctrl vs ctrlOrMeta on Linux/Win resolve the same (both Ctrl)', () => {
		expect(areCombosEquivalent({key: 'k', ctrl: true}, {key: 'k', ctrlOrMeta: true}, 'linux')).toBe(true);
	});

	test('mouse button combos', () => {
		expect(areCombosEquivalent({key: '', mouseButton: 4}, {key: '', mouseButton: 4}, 'mac')).toBe(true);
		expect(areCombosEquivalent({key: '', mouseButton: 4}, {key: '', mouseButton: 5}, 'mac')).toBe(false);
	});

	test('mouse vs keyboard → not equivalent', () => {
		expect(areCombosEquivalent({key: '', mouseButton: 4}, {key: 'v', code: 'KeyV'}, 'mac')).toBe(false);
	});
});

describe('findReservedConflict', () => {
	test('Cmd+Q on Mac is reserved (Quit)', () => {
		const conflict = findReservedConflict({key: 'q', ctrlOrMeta: true}, 'mac');
		expect(conflict?.kind).toBe('reserved');
		expect(conflict?.label).toBe('Quit application');
	});

	test('Cmd+Q on Linux is NOT reserved', () => {
		expect(findReservedConflict({key: 'q', ctrlOrMeta: true}, 'linux')).toBe(null);
	});

	test('Ctrl+Shift+T everywhere is reserved (reopen tab)', () => {
		const mac = findReservedConflict({key: 't', ctrlOrMeta: true, shift: true}, 'mac');
		const linux = findReservedConflict({key: 't', ctrlOrMeta: true, shift: true}, 'linux');
		expect(mac?.kind).toBe('reserved');
		expect(linux?.kind).toBe('reserved');
	});

	test('empty combo returns null', () => {
		expect(findReservedConflict({key: '', enabled: false}, 'mac')).toBe(null);
	});
});

describe('findActionConflict', () => {
	test('returns conflicting action when combo collides', () => {
		KeybindStore.setKeybind('quick_switcher', {key: 'k', ctrlOrMeta: true, enabled: true});
		const conflict = findActionConflict({key: 'k', ctrlOrMeta: true}, 'toggle_mute', 0, 'mac');
		expect(conflict?.kind).toBe('action');
		expect(conflict?.action).toBe('quick_switcher');
	});

	test('does not flag its own slot', () => {
		KeybindStore.setKeybind('quick_switcher', {key: 'k', ctrlOrMeta: true, enabled: true});
		const conflict = findActionConflict({key: 'k', ctrlOrMeta: true}, 'quick_switcher', 0, 'mac');
		expect(conflict).toBe(null);
	});

	test('disabled combos are ignored', () => {
		runInAction(() => {
			(KeybindStore as any).keybinds.quick_switcher = [{key: 'k', ctrlOrMeta: true, enabled: false}];
		});
		const conflict = findActionConflict({key: 'k', ctrlOrMeta: true}, 'toggle_mute', 0, 'mac');
		expect(conflict).toBe(null);
	});
});

describe('findConflicts (composite)', () => {
	test('returns both action + reserved conflicts when applicable', () => {
		KeybindStore.setKeybind('quick_switcher', {key: 'q', ctrlOrMeta: true, enabled: true});
		const conflicts = findConflicts({key: 'q', ctrlOrMeta: true}, 'toggle_mute', 0, 'mac');
		expect(conflicts).toHaveLength(2);
		expect(conflicts.map((c) => c.kind).sort()).toEqual(['action', 'reserved']);
	});

	test('returns empty when combo is safe', () => {
		const conflicts = findConflicts({key: 'j', ctrlOrMeta: true, alt: true}, 'toggle_mute', 0, 'mac');
		expect(conflicts).toEqual([]);
	});
});
