/*
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright (C) 2020-2026 Fluxer Contributors
 * Copyright (C) 2026 Floodilka Contributors
 * Modified by Floodilka Contributors starting March 2026. See LICENSE and NOTICE.
 */

import type {I18n} from '@lingui/core';
import {runInAction} from 'mobx';
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest';
import CallStateStore from '~/stores/CallStateStore';
import type {KeybindAction} from '~/stores/KeybindStore';
import KeybindStore from '~/stores/KeybindStore';
import {UiohookKeycode} from '~/utils/UiohookKeycodes';
import KeybindManager from './KeybindManager';

const mockI18n = {_: (descriptor: any) => descriptor?.message ?? descriptor ?? ''} as unknown as I18n;

function dispatchKey(
	type: 'keydown' | 'keyup',
	init: {
		code: string;
		ctrlKey?: boolean;
		metaKey?: boolean;
		altKey?: boolean;
		shiftKey?: boolean;
		target?: EventTarget;
	},
): KeyboardEvent {
	const event = new KeyboardEvent(type, {
		code: init.code,
		ctrlKey: !!init.ctrlKey,
		metaKey: !!init.metaKey,
		altKey: !!init.altKey,
		shiftKey: !!init.shiftKey,
		bubbles: true,
		cancelable: true,
	});
	(init.target ?? document.documentElement).dispatchEvent(event);
	return event;
}

function resetStores(): void {
	runInAction(() => {
		(KeybindStore as any).initialized = false;
		(KeybindStore as any).keybinds = {};
		(KeybindStore as any).i18n = null;
		KeybindStore.transmitMode = 'voice_activity';
		KeybindStore.pushToTalkHeld = false;
		(CallStateStore as any).calls?.clear?.();
		(CallStateStore as any).pendingRinging?.clear?.();
	});
}

function spyOnHandler(action: KeybindAction) {
	const spy = vi.fn();
	KeybindManager.register(action, spy);
	(KeybindManager as any).refreshLocalShortcuts();
	return spy;
}

function setNavigatorPlatform(platform: string): void {
	Object.defineProperty(navigator, 'platform', {value: platform, configurable: true});
}

describe('KeybindManager integration', () => {
	beforeEach(async () => {
		resetStores();
		KeybindStore.setI18n(mockI18n);
		await KeybindManager.init(mockI18n);
	});

	afterEach(() => {
		KeybindManager.destroy();
		delete (window as any).electron;
	});

	test('Ctrl+K fires quick_switcher handler', () => {
		const spy = spyOnHandler('quick_switcher');
		dispatchKey('keydown', {code: 'KeyK', ctrlKey: true});
		expect(spy).toHaveBeenCalledWith(expect.objectContaining({type: 'press', source: 'local'}));
	});

	test('Ctrl+= fires zoom_in handler (Phase-1 regression for combokeys =/-)', () => {
		const spy = spyOnHandler('zoom_in');
		dispatchKey('keydown', {code: 'Equal', ctrlKey: true});
		expect(spy).toHaveBeenCalledWith(expect.objectContaining({type: 'press'}));
	});

	test('Ctrl+- fires zoom_out handler', () => {
		const spy = spyOnHandler('zoom_out');
		dispatchKey('keydown', {code: 'Minus', ctrlKey: true});
		expect(spy).toHaveBeenCalledWith(expect.objectContaining({type: 'press'}));
	});

	test('Escape without ringing call: mark_channel_read fires, decline does not', () => {
		const markSpy = spyOnHandler('mark_channel_read');
		const declineSpy = spyOnHandler('decline_incoming_call');

		dispatchKey('keydown', {code: 'Escape'});
		expect(markSpy).toHaveBeenCalled();
		expect(declineSpy).not.toHaveBeenCalled();
	});

	test('Escape with ringing call (scope=call-ringing): decline wins, mark does not fire', () => {
		const channelId = 'c1';
		const userId = 'u1';
		runInAction(() => {
			(CallStateStore as any).calls.set(channelId, {
				channelId,
				messageId: 'msg1',
				region: 'local',
				ringing: [userId],
				layout: 0,
				participants: [],
			});
			(CallStateStore as any).pendingRinging.set(channelId, new Set([userId]));
		});

		const originalUserIdDescriptor = Object.getOwnPropertyDescriptor(
			Object.getPrototypeOf(Object.getPrototypeOf(KeybindManager as any)),
			'currentChannelId',
		);
		void originalUserIdDescriptor;

		// Force AuthenticationStore.currentUserId via a manager helper override
		const managerAny = KeybindManager as any;
		const originalGetRinging = managerAny.getIncomingRingingChannelId;
		managerAny.getIncomingRingingChannelId = () => channelId;
		(KeybindManager as any).refreshLocalShortcuts();

		try {
			const markSpy = spyOnHandler('mark_channel_read');
			const declineSpy = spyOnHandler('decline_incoming_call');

			dispatchKey('keydown', {code: 'Escape'});
			expect(declineSpy).toHaveBeenCalled();
			expect(markSpy).not.toHaveBeenCalled();
		} finally {
			managerAny.getIncomingRingingChannelId = originalGetRinging;
		}
	});

	test('Shortcut without modifier is ignored in textarea', () => {
		const spy = spyOnHandler('scroll_chat_up');
		const textarea = document.createElement('textarea');
		document.body.appendChild(textarea);

		dispatchKey('keydown', {code: 'PageUp', target: textarea});
		expect(spy).not.toHaveBeenCalled();

		textarea.remove();
	});

	test('PTT on Mac: release fires on Meta keyup while main key still held', () => {
		KeybindStore.setTransmitMode('push_to_talk');
		KeybindStore.setKeybind('push_to_talk', {
			key: 'v',
			code: 'KeyV',
			ctrlOrMeta: true,
			enabled: true,
			global: false,
		});
		(KeybindManager as any).matcher.isMac = true;
		(KeybindManager as any).refreshLocalShortcuts();

		const spy = spyOnHandler('push_to_talk');

		dispatchKey('keydown', {code: 'KeyV', metaKey: true});
		expect(spy).toHaveBeenCalledWith(expect.objectContaining({type: 'press'}));

		spy.mockClear();
		dispatchKey('keyup', {code: 'MetaLeft'});
		expect(spy).toHaveBeenCalledWith(expect.objectContaining({type: 'release'}));
	});

	test('multibinding: two shortcuts on same action, each tap fires handler', () => {
		KeybindStore.setKeybinds('quick_switcher', [
			{key: 'k', ctrlOrMeta: true, enabled: true},
			{key: 'l', ctrlOrMeta: true, enabled: true},
		]);
		const spy = spyOnHandler('quick_switcher');

		dispatchKey('keydown', {code: 'KeyK', ctrlKey: true});
		dispatchKey('keyup', {code: 'KeyK'});
		expect(spy).toHaveBeenCalledTimes(2);

		spy.mockClear();
		dispatchKey('keydown', {code: 'KeyL', ctrlKey: true});
		dispatchKey('keyup', {code: 'KeyL'});
		expect(spy).toHaveBeenCalledTimes(2);
	});

	test('Windows global keyboard shortcuts use the native hook when available', async () => {
		setNavigatorPlatform('Win32');
		const electronApi = {
			platform: 'win32',
			globalKeyHookStart: vi.fn(async () => true),
			globalKeyHookStop: vi.fn(),
			globalKeyHookUnregisterAll: vi.fn(async () => undefined),
			unregisterAllGlobalShortcuts: vi.fn(async () => undefined),
			registerGlobalShortcut: vi.fn(async () => true),
			globalKeyHookRegister: vi.fn(async () => undefined),
		};
		Object.defineProperty(window, 'electron', {value: electronApi, configurable: true});

		await (KeybindManager as any).refreshGlobalShortcuts([
			{
				id: 'toggle_mute:0',
				action: 'toggle_mute',
				combo: {key: ' ', code: 'Space', enabled: true, global: true},
				allowGlobal: true,
			},
			{
				id: 'toggle_deafen:0',
				action: 'toggle_deafen',
				combo: {key: 'm', code: 'KeyM', ctrl: true, enabled: true, global: true},
				allowGlobal: true,
			},
		]);

		expect(electronApi.registerGlobalShortcut).not.toHaveBeenCalled();
		expect(electronApi.globalKeyHookStart).toHaveBeenCalled();
		expect(electronApi.globalKeyHookRegister).toHaveBeenCalledWith(
			expect.objectContaining({
				id: 'toggle_mute:0',
				keycode: UiohookKeycode.Space,
			}),
		);
		expect(electronApi.globalKeyHookRegister).toHaveBeenCalledWith(
			expect.objectContaining({
				id: 'toggle_deafen:0',
				keycode: UiohookKeycode.KeyM,
				ctrl: true,
			}),
		);
	});
});
