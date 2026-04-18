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
import {autorun, reaction, runInAction} from 'mobx';
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest';
import KeybindStore, {migrateLegacyKeybindPersist} from '~/stores/KeybindStore';
import LocalVoiceStateStore from '~/stores/LocalVoiceStateStore';

const mockI18n = {_: (descriptor: any) => descriptor?.message ?? descriptor ?? ''} as unknown as I18n;

/**
 * Reset KeybindStore internal state between tests.
 *
 * The module-level singleton keeps `initialized` across tests which would
 * make the second call to `setI18n` a no-op.  We reach into the instance
 * and clear the flag so each test starts fresh.
 */
function resetKeybindStore(): void {
	runInAction(() => {
		(KeybindStore as any).initialized = false;
		(KeybindStore as any).keybinds = {};
		(KeybindStore as any).i18n = null;
		KeybindStore.transmitMode = 'voice_activity' as any;
		KeybindStore.pushToTalkHeld = false;
		KeybindStore.pushToTalkReleaseDelay = 20;
		KeybindStore.pushToTalkLatching = false;
	});
}

beforeEach(() => resetKeybindStore());

// ---------------------------------------------------------------------------
// Persistence: setI18n must not wipe hydrated keybinds
// ---------------------------------------------------------------------------

describe('KeybindStore persistence', () => {
	test('setI18n populates defaults on first-ever use (empty keybinds)', () => {
		KeybindStore.setI18n(mockI18n);

		const ptt = KeybindStore.getByAction('push_to_talk');
		expect(ptt.combo.key).toBe('');
		expect(ptt.combo.enabled).toBe(false);

		// All default keybinds should be populated
		const all = KeybindStore.getAll();
		expect(all.length).toBeGreaterThan(0);
	});

	test('setI18n preserves already-hydrated keybinds (simulated persistence load)', () => {
		// Simulate makePersistable having hydrated the store BEFORE setI18n runs
		runInAction(() => {
			(KeybindStore as any).keybinds = {
				push_to_talk: {key: 'v', code: 'KeyV', enabled: true, global: true},
				toggle_mute: {key: 'm', ctrlOrMeta: true, shift: true, global: true, enabled: true},
			};
		});

		KeybindStore.setI18n(mockI18n);

		// PTT keybind must survive — not be wiped to the empty default
		const ptt = KeybindStore.getByAction('push_to_talk');
		expect(ptt.combo.key).toBe('v');
		expect(ptt.combo.code).toBe('KeyV');
		expect(ptt.combo.enabled).toBe(true);
		expect(ptt.combo.global).toBe(true);
	});

	test('setI18n does not run resetToDefaults twice in the same session', () => {
		KeybindStore.setI18n(mockI18n);

		// User customises a keybind
		KeybindStore.setKeybind('push_to_talk', {key: 'b', code: 'KeyB', enabled: true, global: false});

		// Calling setI18n again (e.g. locale change) must NOT reset keybinds
		KeybindStore.setI18n(mockI18n);
		const ptt = KeybindStore.getByAction('push_to_talk');
		expect(ptt.combo.key).toBe('b');
	});
});

// ---------------------------------------------------------------------------
// PTT state management
// ---------------------------------------------------------------------------

describe('KeybindStore push-to-talk state', () => {
	beforeEach(() => {
		KeybindStore.setI18n(mockI18n);
		KeybindStore.setTransmitMode('push_to_talk');
		KeybindStore.setKeybind('push_to_talk', {key: 'v', code: 'KeyV', enabled: true, global: false});
	});

	test('press sets pushToTalkHeld and returns shouldUnmute=true', () => {
		const shouldUnmute = KeybindStore.handlePushToTalkPress();
		expect(shouldUnmute).toBe(true);
		expect(KeybindStore.pushToTalkHeld).toBe(true);
	});

	test('release after press clears pushToTalkHeld and returns shouldMute=true', () => {
		KeybindStore.handlePushToTalkPress(1000);
		const shouldMute = KeybindStore.handlePushToTalkRelease(1500);
		expect(shouldMute).toBe(true);
		expect(KeybindStore.pushToTalkHeld).toBe(false);
	});

	test('latching: quick tap latches (stays unmuted), second tap unlatches', () => {
		KeybindStore.setPushToTalkLatching(true);

		// Quick tap (< 200ms threshold)
		KeybindStore.handlePushToTalkPress(1000);
		const shouldMuteAfterTap = KeybindStore.handlePushToTalkRelease(1050);
		expect(shouldMuteAfterTap).toBe(false); // latched — don't mute
		expect(KeybindStore.isPushToTalkLatched()).toBe(true);
		expect(KeybindStore.pushToTalkHeld).toBe(true); // still "held" via latch

		// Second press unlatches
		const shouldUnmuteAgain = KeybindStore.handlePushToTalkPress(2000);
		expect(shouldUnmuteAgain).toBe(false); // unlatching — don't unmute
		expect(KeybindStore.isPushToTalkLatched()).toBe(false);
		expect(KeybindStore.pushToTalkHeld).toBe(false);
	});

	test('isPushToTalkEffective requires both mode and keybind', () => {
		expect(KeybindStore.isPushToTalkEffective()).toBe(true);

		// Clear keybind → no longer effective
		KeybindStore.setKeybind('push_to_talk', {key: '', enabled: false});
		expect(KeybindStore.isPushToTalkEffective()).toBe(false);

		// Restore keybind but switch mode → no longer effective
		KeybindStore.setKeybind('push_to_talk', {key: 'v', code: 'KeyV', enabled: true});
		KeybindStore.setTransmitMode('voice_activity');
		expect(KeybindStore.isPushToTalkEffective()).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Reaction vs autorun: selfMute changes must NOT trigger PTT mode handler
// ---------------------------------------------------------------------------

describe('PTT reaction does not feedback-loop on selfMute changes', () => {
	let handler: ReturnType<typeof vi.fn<() => void>>;
	let dispose: () => void;

	beforeEach(() => {
		KeybindStore.setI18n(mockI18n);
		KeybindStore.setTransmitMode('push_to_talk');
		KeybindStore.setKeybind('push_to_talk', {key: 'v', code: 'KeyV', enabled: true, global: false});

		handler = vi.fn();

		// This mirrors the reaction used in KeybindManager after the fix.
		dispose = reaction(
			() => ({
				mode: KeybindStore.transmitMode,
				hasKeybind: KeybindStore.hasPushToTalkKeybind(),
			}),
			() => handler(),
			{fireImmediately: true},
		);

		// Reset after the fireImmediately call
		handler.mockClear();
	});

	afterEach(() => dispose());

	test('changing selfMute does NOT trigger the reaction', () => {
		runInAction(() => LocalVoiceStateStore.updateSelfMute(false));
		runInAction(() => LocalVoiceStateStore.updateSelfMute(true));

		expect(handler).not.toHaveBeenCalled();
	});

	test('changing transmitMode DOES trigger the reaction', () => {
		KeybindStore.setTransmitMode('voice_activity');
		expect(handler).toHaveBeenCalledTimes(1);

		handler.mockClear();
		KeybindStore.setTransmitMode('push_to_talk');
		expect(handler).toHaveBeenCalledTimes(1);
	});

	test('changing PTT keybind DOES trigger the reaction', () => {
		// Clear keybind (hasPushToTalkKeybind: true → false)
		KeybindStore.setKeybind('push_to_talk', {key: '', enabled: false});
		expect(handler).toHaveBeenCalledTimes(1);

		handler.mockClear();
		// Set keybind (hasPushToTalkKeybind: false → true)
		KeybindStore.setKeybind('push_to_talk', {key: 'b', code: 'KeyB', enabled: true});
		expect(handler).toHaveBeenCalledTimes(1);
	});

	test('(regression) an autorun WOULD have triggered on selfMute — proving the old code was broken', () => {
		const autorunHandler = vi.fn();

		// Simulate what the old code did: autorun that reads selfMute transitively
		const disposeAutorun = autorun(() => {
			// These reads mirror what handlePushToTalkModeChange accesses
			KeybindStore.isPushToTalkEffective();
			LocalVoiceStateStore.getSelfMute();
			autorunHandler();
		});

		autorunHandler.mockClear();

		runInAction(() => LocalVoiceStateStore.updateSelfMute(false));
		expect(autorunHandler).toHaveBeenCalled(); // autorun DID fire — this was the bug

		disposeAutorun();
	});
});

describe('KeybindStore multibinding', () => {
	beforeEach(() => KeybindStore.setI18n(mockI18n));

	test('addKeybind appends a second combo (up to MAX_COMBOS_PER_ACTION)', () => {
		KeybindStore.setKeybind('push_to_talk', {key: 'v', code: 'KeyV', enabled: true});
		KeybindStore.addKeybind('push_to_talk', {key: 'b', code: 'KeyB', enabled: true});

		const ptt = KeybindStore.getByAction('push_to_talk');
		expect(ptt.combos).toHaveLength(2);
		expect(ptt.combos[0].code).toBe('KeyV');
		expect(ptt.combos[1].code).toBe('KeyB');
	});

	test('addKeybind does not exceed MAX_COMBOS_PER_ACTION', () => {
		KeybindStore.setKeybind('push_to_talk', {key: 'v', code: 'KeyV', enabled: true});
		KeybindStore.addKeybind('push_to_talk', {key: 'b', code: 'KeyB', enabled: true});
		KeybindStore.addKeybind('push_to_talk', {key: 'n', code: 'KeyN', enabled: true});

		const ptt = KeybindStore.getByAction('push_to_talk');
		expect(ptt.combos).toHaveLength(2);
	});

	test('removeKeybindAt drops the requested combo', () => {
		KeybindStore.setKeybinds('push_to_talk', [
			{key: 'v', code: 'KeyV', enabled: true},
			{key: 'b', code: 'KeyB', enabled: true},
		]);
		KeybindStore.removeKeybindAt('push_to_talk', 0);

		const ptt = KeybindStore.getByAction('push_to_talk');
		expect(ptt.combos).toHaveLength(1);
		expect(ptt.combos[0].code).toBe('KeyB');
	});

	test('setKeybindAt replaces one combo without touching siblings', () => {
		KeybindStore.setKeybinds('push_to_talk', [
			{key: 'v', code: 'KeyV', enabled: true},
			{key: 'b', code: 'KeyB', enabled: true},
		]);
		KeybindStore.setKeybindAt('push_to_talk', 1, {key: 'n', code: 'KeyN', enabled: true});

		const ptt = KeybindStore.getByAction('push_to_talk');
		expect(ptt.combos[0].code).toBe('KeyV');
		expect(ptt.combos[1].code).toBe('KeyN');
	});

	test('legacy singular persist shape reads as array', () => {
		runInAction(() => {
			(KeybindStore as any).keybinds = {
				push_to_talk: {key: 'v', code: 'KeyV', enabled: true, global: true},
			};
		});

		const ptt = KeybindStore.getByAction('push_to_talk');
		expect(Array.isArray(ptt.combos)).toBe(true);
		expect(ptt.combos).toHaveLength(1);
		expect(ptt.combos[0].code).toBe('KeyV');
		expect(ptt.combo.code).toBe('KeyV');
	});

	test('toggleGlobal applies to every combo for the action', () => {
		KeybindStore.setKeybinds('toggle_mute', [
			{key: 'm', ctrlOrMeta: true, shift: true, enabled: true, global: false},
			{key: 'n', ctrlOrMeta: true, shift: true, enabled: true, global: false},
		]);
		KeybindStore.toggleGlobal('toggle_mute', true);

		const entry = KeybindStore.getByAction('toggle_mute');
		expect(entry.combos.every((c) => c.global === true)).toBe(true);
	});

	test('hasPushToTalkKeybind returns true if any combo has a key', () => {
		KeybindStore.setKeybinds('push_to_talk', [
			{key: '', enabled: false},
			{key: 'v', code: 'KeyV', enabled: true},
		]);
		expect(KeybindStore.hasPushToTalkKeybind()).toBe(true);

		KeybindStore.setKeybinds('push_to_talk', [{key: '', enabled: false}]);
		expect(KeybindStore.hasPushToTalkKeybind()).toBe(false);
	});
});

describe('migrateLegacyKeybindPersist', () => {
	function makeStorage(initial: Record<string, string> = {}) {
		const data = {...initial};
		return {
			data,
			getItem: (key: string) => data[key] ?? null,
			setItem: (key: string, value: string) => {
				data[key] = value;
			},
		};
	}

	test('wraps singular legacy entries in arrays', () => {
		const storage = makeStorage({
			KeybindStore: JSON.stringify({
				keybinds: {
					push_to_talk: {key: 'v', code: 'KeyV', enabled: true},
					quick_switcher: {key: 'k', ctrlOrMeta: true},
				},
			}),
		});
		expect(migrateLegacyKeybindPersist(storage)).toBe(true);
		const parsed = JSON.parse(storage.data.KeybindStore!);
		expect(Array.isArray(parsed.keybinds.push_to_talk)).toBe(true);
		expect(parsed.keybinds.push_to_talk[0].code).toBe('KeyV');
		expect(Array.isArray(parsed.keybinds.quick_switcher)).toBe(true);
	});

	test('is a no-op if data already in new shape', () => {
		const storage = makeStorage({
			KeybindStore: JSON.stringify({
				keybinds: {
					push_to_talk: [{key: 'v', code: 'KeyV', enabled: true}],
				},
			}),
		});
		expect(migrateLegacyKeybindPersist(storage)).toBe(false);
	});

	test('survives missing or malformed storage', () => {
		expect(migrateLegacyKeybindPersist(makeStorage())).toBe(false);
		expect(migrateLegacyKeybindPersist(makeStorage({KeybindStore: '{{{'}))).toBe(false);
		expect(migrateLegacyKeybindPersist(makeStorage({KeybindStore: 'null'}))).toBe(false);
	});
});
