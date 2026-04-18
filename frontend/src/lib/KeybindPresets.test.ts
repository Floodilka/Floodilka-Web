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
import {
	applyKeybindPreset,
	KEYBIND_PRESET_VERSION,
	KeybindPresetParseError,
	parseKeybindPreset,
	serializeKeybindPreset,
	stringifyKeybindPreset,
} from './KeybindPresets';

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

describe('serializeKeybindPreset', () => {
	test('includes version, keybinds and PTT settings', () => {
		KeybindStore.setKeybind('push_to_talk', {key: 'v', code: 'KeyV', enabled: true, global: true});
		KeybindStore.setTransmitMode('push_to_talk');
		KeybindStore.setPushToTalkReleaseDelay(150);
		KeybindStore.setPushToTalkLatching(true);

		const preset = serializeKeybindPreset();
		expect(preset.version).toBe(KEYBIND_PRESET_VERSION);
		expect(preset.transmitMode).toBe('push_to_talk');
		expect(preset.pushToTalkReleaseDelay).toBe(150);
		expect(preset.pushToTalkLatching).toBe(true);
		expect(preset.keybinds.push_to_talk?.[0].code).toBe('KeyV');
	});
});

describe('parseKeybindPreset', () => {
	test('roundtrip with serialize', () => {
		KeybindStore.setKeybind('quick_switcher', {key: 'k', ctrlOrMeta: true});
		const preset = serializeKeybindPreset();
		const parsed = parseKeybindPreset(stringifyKeybindPreset(preset));
		expect(parsed.keybinds.quick_switcher?.[0].key).toBe('k');
	});

	test('rejects invalid JSON', () => {
		expect(() => parseKeybindPreset('not json')).toThrow(KeybindPresetParseError);
	});

	test('rejects missing version', () => {
		expect(() => parseKeybindPreset(JSON.stringify({keybinds: {}}))).toThrow(KeybindPresetParseError);
	});

	test('rejects unsupported version', () => {
		expect(() => parseKeybindPreset(JSON.stringify({version: 999, keybinds: {}}))).toThrow(KeybindPresetParseError);
	});

	test('ignores invalid combo entries', () => {
		const parsed = parseKeybindPreset(
			JSON.stringify({
				version: KEYBIND_PRESET_VERSION,
				keybinds: {
					quick_switcher: [{key: 'k', ctrlOrMeta: true}, 'not an object', {noKeyField: true}],
					bogus_action: [{key: 'x'}],
				},
			}),
		);
		expect(parsed.keybinds.quick_switcher).toHaveLength(1);
		expect(parsed.keybinds.quick_switcher?.[0].key).toBe('k');
	});
});

describe('applyKeybindPreset', () => {
	test('applies keybinds and PTT settings', () => {
		const preset = {
			version: KEYBIND_PRESET_VERSION,
			transmitMode: 'push_to_talk' as const,
			pushToTalkReleaseDelay: 250,
			pushToTalkLatching: true,
			keybinds: {
				push_to_talk: [{key: 'b', code: 'KeyB', enabled: true}],
				quick_switcher: [{key: 'j', ctrlOrMeta: true}],
			},
		};
		applyKeybindPreset(preset);

		const ptt = KeybindStore.getByAction('push_to_talk');
		expect(ptt.combos[0].code).toBe('KeyB');

		const qs = KeybindStore.getByAction('quick_switcher');
		expect(qs.combos[0].key).toBe('j');

		expect(KeybindStore.transmitMode).toBe('push_to_talk');
		expect(KeybindStore.pushToTalkReleaseDelay).toBe(250);
		expect(KeybindStore.pushToTalkLatching).toBe(true);
	});
});
