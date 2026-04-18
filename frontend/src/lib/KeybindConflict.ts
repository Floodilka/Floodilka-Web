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

import type {MessageDescriptor} from '@lingui/core';
import {msg} from '@lingui/core/macro';
import KeybindStore, {type KeybindAction, type KeyCombo} from '~/stores/KeybindStore';
import {resolveBindingCode} from './ShortcutMatcher';

export type ConflictPlatform = 'mac' | 'win' | 'linux';

export type ConflictKind = 'action' | 'reserved';

export interface ActionConflict {
	kind: 'action';
	action: KeybindAction;
	label: string;
}

export interface ReservedConflict {
	kind: 'reserved';
	label: MessageDescriptor;
}

export type KeybindConflict = ActionConflict | ReservedConflict;

interface ReservedComboSpec {
	combo: KeyCombo;
	label: MessageDescriptor;
	platforms: ReadonlyArray<ConflictPlatform>;
}

const RESERVED_COMBOS: ReadonlyArray<ReservedComboSpec> = [
	{combo: {key: 'q', ctrlOrMeta: true}, label: msg`Quit application`, platforms: ['mac']},
	{combo: {key: 'w', ctrlOrMeta: true}, label: msg`Close window`, platforms: ['mac', 'win', 'linux']},
	{combo: {key: 'n', ctrlOrMeta: true}, label: msg`New window`, platforms: ['mac', 'win', 'linux']},
	{
		combo: {key: 'n', ctrlOrMeta: true, shift: true},
		label: msg`New incognito window`,
		platforms: ['mac', 'win', 'linux'],
	},
	{
		combo: {key: 't', ctrlOrMeta: true, shift: true},
		label: msg`Reopen closed tab`,
		platforms: ['mac', 'win', 'linux'],
	},
	{combo: {key: 'r', ctrlOrMeta: true}, label: msg`Reload page`, platforms: ['mac', 'win', 'linux']},
	{combo: {key: 'r', ctrlOrMeta: true, shift: true}, label: msg`Hard reload`, platforms: ['mac', 'win', 'linux']},
	{combo: {key: 'Tab', ctrl: true}, label: msg`Next tab`, platforms: ['mac', 'win', 'linux']},
	{combo: {key: 'Tab', ctrl: true, shift: true}, label: msg`Previous tab`, platforms: ['mac', 'win', 'linux']},
];

export function detectPlatform(): ConflictPlatform {
	if (typeof navigator === 'undefined') return 'linux';
	const p = navigator.platform ?? '';
	if (/Mac|iPod|iPhone|iPad/.test(p)) return 'mac';
	if (/Win/.test(p)) return 'win';
	return 'linux';
}

function comboHasBinding(combo: KeyCombo): boolean {
	return !!(combo.key || combo.code || combo.mouseButton);
}

export function areCombosEquivalent(a: KeyCombo, b: KeyCombo, platform: ConflictPlatform = detectPlatform()): boolean {
	if ((a.mouseButton ?? null) !== (b.mouseButton ?? null)) return false;
	if (!a.mouseButton) {
		const codeA = resolveBindingCode(a);
		const codeB = resolveBindingCode(b);
		if (codeA === null || codeA !== codeB) return false;
	}

	const isMac = platform === 'mac';
	const aCtrl = !!(a.ctrl || (!isMac && a.ctrlOrMeta));
	const bCtrl = !!(b.ctrl || (!isMac && b.ctrlOrMeta));
	const aMeta = !!(a.meta || (isMac && a.ctrlOrMeta));
	const bMeta = !!(b.meta || (isMac && b.ctrlOrMeta));

	return aCtrl === bCtrl && aMeta === bMeta && !!a.alt === !!b.alt && !!a.shift === !!b.shift;
}

export function findReservedConflict(
	combo: KeyCombo,
	platform: ConflictPlatform = detectPlatform(),
): ReservedConflict | null {
	if (!comboHasBinding(combo)) return null;
	for (const reserved of RESERVED_COMBOS) {
		if (!reserved.platforms.includes(platform)) continue;
		if (areCombosEquivalent(combo, reserved.combo, platform)) {
			return {kind: 'reserved', label: reserved.label};
		}
	}
	return null;
}

export function findActionConflict(
	combo: KeyCombo,
	currentAction: KeybindAction,
	currentIndex: number,
	platform: ConflictPlatform = detectPlatform(),
): ActionConflict | null {
	if (!comboHasBinding(combo)) return null;
	for (const entry of KeybindStore.getAll()) {
		for (let i = 0; i < entry.combos.length; i++) {
			if (entry.action === currentAction && i === currentIndex) continue;
			const existing = entry.combos[i];
			if (!(existing.enabled ?? true)) continue;
			if (!comboHasBinding(existing)) continue;
			if (areCombosEquivalent(combo, existing, platform)) {
				return {kind: 'action', action: entry.action, label: entry.label};
			}
		}
	}
	return null;
}

export function findConflicts(
	combo: KeyCombo,
	currentAction: KeybindAction,
	currentIndex: number,
	platform: ConflictPlatform = detectPlatform(),
): Array<KeybindConflict> {
	const result: Array<KeybindConflict> = [];
	const action = findActionConflict(combo, currentAction, currentIndex, platform);
	if (action) result.push(action);
	const reserved = findReservedConflict(combo, platform);
	if (reserved) result.push(reserved);
	return result;
}
