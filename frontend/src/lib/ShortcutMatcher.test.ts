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

import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest';
import type {KeyCombo} from '~/stores/KeybindStore';
import {
	jsKeyToEventCode,
	type KeybindDescriptor,
	resolveBindingCode,
	ShortcutMatcher,
	webMouseButtonToCanonical,
} from './ShortcutMatcher';

interface RecordedCall {
	action: string;
	type: 'press' | 'release';
	source: 'local' | 'global';
}

function makeDescriptor(
	action: string,
	combo: KeyCombo,
	extra: Partial<KeybindDescriptor> = {},
	recorder?: Array<RecordedCall>,
): KeybindDescriptor {
	return {
		action,
		combo,
		onPress: (source) => recorder?.push({action, type: 'press', source}),
		onRelease: (source) => recorder?.push({action, type: 'release', source}),
		...extra,
	};
}

interface KeyEventInit {
	code: string;
	ctrlKey?: boolean;
	metaKey?: boolean;
	altKey?: boolean;
	shiftKey?: boolean;
	isComposing?: boolean;
	target?: EventTarget | null;
}

function fireKey(matcher: ShortcutMatcher, type: 'keydown' | 'keyup', init: KeyEventInit): KeyboardEvent {
	const event = new KeyboardEvent(type, {
		code: init.code,
		ctrlKey: !!init.ctrlKey,
		metaKey: !!init.metaKey,
		altKey: !!init.altKey,
		shiftKey: !!init.shiftKey,
		isComposing: !!init.isComposing,
		cancelable: true,
		bubbles: true,
	});
	if (init.target) Object.defineProperty(event, 'target', {value: init.target, writable: false});
	if (type === 'keydown') matcher.handleKeyDown(event);
	else matcher.handleKeyUp(event);
	return event;
}

interface MouseEventInit {
	button: number;
	ctrlKey?: boolean;
	metaKey?: boolean;
	altKey?: boolean;
	shiftKey?: boolean;
	target?: EventTarget | null;
}

function fireMouse(matcher: ShortcutMatcher, type: 'mousedown' | 'mouseup', init: MouseEventInit): MouseEvent {
	const event = new MouseEvent(type, {
		button: init.button,
		ctrlKey: !!init.ctrlKey,
		metaKey: !!init.metaKey,
		altKey: !!init.altKey,
		shiftKey: !!init.shiftKey,
		cancelable: true,
		bubbles: true,
	});
	if (init.target) Object.defineProperty(event, 'target', {value: init.target, writable: false});
	if (type === 'mousedown') matcher.handleMouseDown(event);
	else matcher.handleMouseUp(event);
	return event;
}

describe('jsKeyToEventCode', () => {
	test('letters', () => {
		expect(jsKeyToEventCode('k')).toBe('KeyK');
		expect(jsKeyToEventCode('K')).toBe('KeyK');
		expect(jsKeyToEventCode('z')).toBe('KeyZ');
	});

	test('digits', () => {
		expect(jsKeyToEventCode('0')).toBe('Digit0');
		expect(jsKeyToEventCode('9')).toBe('Digit9');
	});

	test('punctuation', () => {
		expect(jsKeyToEventCode('=')).toBe('Equal');
		expect(jsKeyToEventCode('+')).toBe('Equal');
		expect(jsKeyToEventCode('-')).toBe('Minus');
		expect(jsKeyToEventCode('_')).toBe('Minus');
		expect(jsKeyToEventCode('[')).toBe('BracketLeft');
		expect(jsKeyToEventCode(']')).toBe('BracketRight');
		expect(jsKeyToEventCode(',')).toBe('Comma');
		expect(jsKeyToEventCode('.')).toBe('Period');
		expect(jsKeyToEventCode('/')).toBe('Slash');
		expect(jsKeyToEventCode(';')).toBe('Semicolon');
		expect(jsKeyToEventCode("'")).toBe('Quote');
		expect(jsKeyToEventCode('\\')).toBe('Backslash');
		expect(jsKeyToEventCode('`')).toBe('Backquote');
		expect(jsKeyToEventCode(' ')).toBe('Space');
	});

	test('named keys', () => {
		expect(jsKeyToEventCode('Escape')).toBe('Escape');
		expect(jsKeyToEventCode('Esc')).toBe('Escape');
		expect(jsKeyToEventCode('Enter')).toBe('Enter');
		expect(jsKeyToEventCode('Tab')).toBe('Tab');
		expect(jsKeyToEventCode('Backspace')).toBe('Backspace');
		expect(jsKeyToEventCode('ArrowUp')).toBe('ArrowUp');
		expect(jsKeyToEventCode('PageUp')).toBe('PageUp');
	});

	test('function keys', () => {
		expect(jsKeyToEventCode('F1')).toBe('F1');
		expect(jsKeyToEventCode('F12')).toBe('F12');
		expect(jsKeyToEventCode('F24')).toBe('F24');
	});

	test('already an event.code', () => {
		expect(jsKeyToEventCode('KeyM')).toBe('KeyM');
		expect(jsKeyToEventCode('Digit5')).toBe('Digit5');
	});

	test('unknown', () => {
		expect(jsKeyToEventCode('')).toBe(null);
		expect(jsKeyToEventCode(undefined)).toBe(null);
		expect(jsKeyToEventCode('NotAKey')).toBe(null);
	});
});

describe('resolveBindingCode', () => {
	test('prefers combo.code when set', () => {
		expect(resolveBindingCode({key: 'к', code: 'KeyK'})).toBe('KeyK');
		expect(resolveBindingCode({key: '', code: 'Equal'})).toBe('Equal');
	});

	test('falls back to combo.key', () => {
		expect(resolveBindingCode({key: '='})).toBe('Equal');
		expect(resolveBindingCode({key: 'k'})).toBe('KeyK');
		expect(resolveBindingCode({key: 'Escape'})).toBe('Escape');
	});

	test('returns null for empty combo', () => {
		expect(resolveBindingCode({key: ''})).toBe(null);
	});
});

describe('ShortcutMatcher — letter shortcut', () => {
	let matcher: ShortcutMatcher;
	let calls: Array<RecordedCall>;

	beforeEach(() => {
		calls = [];
		matcher = new ShortcutMatcher({isMac: false});
	});

	afterEach(() => matcher.detach());

	test('Ctrl+K fires press then release', () => {
		matcher.setBindings([makeDescriptor('quick_switcher', {key: 'k', ctrlOrMeta: true}, {}, calls)]);

		fireKey(matcher, 'keydown', {code: 'KeyK', ctrlKey: true});
		expect(calls).toEqual([{action: 'quick_switcher', type: 'press', source: 'local'}]);

		fireKey(matcher, 'keyup', {code: 'KeyK'});
		expect(calls).toEqual([
			{action: 'quick_switcher', type: 'press', source: 'local'},
			{action: 'quick_switcher', type: 'release', source: 'local'},
		]);
	});

	test('wrong modifier state does not match', () => {
		matcher.setBindings([makeDescriptor('quick_switcher', {key: 'k', ctrlOrMeta: true}, {}, calls)]);
		fireKey(matcher, 'keydown', {code: 'KeyK'});
		fireKey(matcher, 'keydown', {code: 'KeyK', ctrlKey: true, shiftKey: true});
		expect(calls).toEqual([]);
	});

	test('preventDefault is called by default', () => {
		matcher.setBindings([makeDescriptor('quick_switcher', {key: 'k', ctrlOrMeta: true}, {}, calls)]);
		const event = fireKey(matcher, 'keydown', {code: 'KeyK', ctrlKey: true});
		expect(event.defaultPrevented).toBe(true);
	});

	test('preventDefault is skipped when preventDefault: false', () => {
		matcher.setBindings([makeDescriptor('push_to_talk', {key: 'k', code: 'KeyK'}, {preventDefault: false}, calls)]);
		const event = fireKey(matcher, 'keydown', {code: 'KeyK'});
		expect(event.defaultPrevented).toBe(false);
	});
});

describe('ShortcutMatcher — ctrlOrMeta platform resolution', () => {
	test('on Mac, ctrlOrMeta matches metaKey', () => {
		const calls: Array<RecordedCall> = [];
		const matcher = new ShortcutMatcher({isMac: true});
		matcher.setBindings([makeDescriptor('quick_switcher', {key: 'k', ctrlOrMeta: true}, {}, calls)]);

		fireKey(matcher, 'keydown', {code: 'KeyK', metaKey: true});
		expect(calls).toHaveLength(1);

		fireKey(matcher, 'keyup', {code: 'KeyK'});
		matcher.detach();
	});

	test('on Mac, ctrlOrMeta does NOT match ctrlKey', () => {
		const calls: Array<RecordedCall> = [];
		const matcher = new ShortcutMatcher({isMac: true});
		matcher.setBindings([makeDescriptor('quick_switcher', {key: 'k', ctrlOrMeta: true}, {}, calls)]);

		fireKey(matcher, 'keydown', {code: 'KeyK', ctrlKey: true});
		expect(calls).toHaveLength(0);
		matcher.detach();
	});

	test('on non-Mac, ctrlOrMeta matches ctrlKey', () => {
		const calls: Array<RecordedCall> = [];
		const matcher = new ShortcutMatcher({isMac: false});
		matcher.setBindings([makeDescriptor('quick_switcher', {key: 'k', ctrlOrMeta: true}, {}, calls)]);

		fireKey(matcher, 'keydown', {code: 'KeyK', ctrlKey: true});
		expect(calls).toHaveLength(1);

		matcher.detach();
	});
});

describe('ShortcutMatcher — punctuation (the =/- combokeys regression)', () => {
	test('Ctrl+= fires when event.code=Equal', () => {
		const calls: Array<RecordedCall> = [];
		const matcher = new ShortcutMatcher({isMac: false});
		matcher.setBindings([makeDescriptor('zoom_in', {key: '=', ctrlOrMeta: true}, {}, calls)]);

		fireKey(matcher, 'keydown', {code: 'Equal', ctrlKey: true});
		expect(calls).toHaveLength(1);

		matcher.detach();
	});

	test('Ctrl+- fires when event.code=Minus', () => {
		const calls: Array<RecordedCall> = [];
		const matcher = new ShortcutMatcher({isMac: false});
		matcher.setBindings([makeDescriptor('zoom_out', {key: '-', ctrlOrMeta: true}, {}, calls)]);

		fireKey(matcher, 'keydown', {code: 'Minus', ctrlKey: true});
		expect(calls).toHaveLength(1);

		matcher.detach();
	});

	test('Ctrl+[ fires when event.code=BracketLeft', () => {
		const calls: Array<RecordedCall> = [];
		const matcher = new ShortcutMatcher({isMac: false});
		matcher.setBindings([makeDescriptor('navigate_history_back', {key: '[', ctrlOrMeta: true}, {}, calls)]);

		fireKey(matcher, 'keydown', {code: 'BracketLeft', ctrlKey: true});
		expect(calls).toHaveLength(1);

		matcher.detach();
	});
});

describe('ShortcutMatcher — editable gating', () => {
	test('blocked in textarea by default (no allowInEditable)', () => {
		const calls: Array<RecordedCall> = [];
		const matcher = new ShortcutMatcher({isMac: false});
		matcher.setBindings([makeDescriptor('scroll_chat_up', {key: 'PageUp'}, {}, calls)]);

		const textarea = document.createElement('textarea');
		fireKey(matcher, 'keydown', {code: 'PageUp', target: textarea});
		expect(calls).toHaveLength(0);

		matcher.detach();
	});

	test('allowed in textarea when allowInEditable=true', () => {
		const calls: Array<RecordedCall> = [];
		const matcher = new ShortcutMatcher({isMac: false});
		matcher.setBindings([makeDescriptor('push_to_talk', {key: 'v', code: 'KeyV'}, {allowInEditable: true}, calls)]);

		const textarea = document.createElement('textarea');
		fireKey(matcher, 'keydown', {code: 'KeyV', target: textarea});
		expect(calls).toHaveLength(1);

		matcher.detach();
	});

	test('allowed outside editable even without allowInEditable', () => {
		const calls: Array<RecordedCall> = [];
		const matcher = new ShortcutMatcher({isMac: false});
		matcher.setBindings([makeDescriptor('scroll_chat_up', {key: 'PageUp'}, {}, calls)]);

		const div = document.createElement('div');
		fireKey(matcher, 'keydown', {code: 'PageUp', target: div});
		expect(calls).toHaveLength(1);

		matcher.detach();
	});

	test('isContentEditable counts as editable', () => {
		const calls: Array<RecordedCall> = [];
		const matcher = new ShortcutMatcher({isMac: false});
		matcher.setBindings([makeDescriptor('scroll_chat_up', {key: 'PageUp'}, {}, calls)]);

		const div = document.createElement('div');
		Object.defineProperty(div, 'isContentEditable', {value: true});
		fireKey(matcher, 'keydown', {code: 'PageUp', target: div});
		expect(calls).toHaveLength(0);

		matcher.detach();
	});

	test('checkbox input is NOT editable', () => {
		const calls: Array<RecordedCall> = [];
		const matcher = new ShortcutMatcher({isMac: false});
		matcher.setBindings([makeDescriptor('scroll_chat_up', {key: 'PageUp'}, {}, calls)]);

		const input = document.createElement('input');
		input.type = 'checkbox';
		fireKey(matcher, 'keydown', {code: 'PageUp', target: input});
		expect(calls).toHaveLength(1);

		matcher.detach();
	});
});

describe('ShortcutMatcher — IME and blur', () => {
	test('isComposing=true is ignored', () => {
		const calls: Array<RecordedCall> = [];
		const matcher = new ShortcutMatcher({isMac: false});
		matcher.setBindings([makeDescriptor('quick_switcher', {key: 'k', ctrlOrMeta: true}, {}, calls)]);

		fireKey(matcher, 'keydown', {code: 'KeyK', ctrlKey: true, isComposing: true});
		expect(calls).toHaveLength(0);

		matcher.detach();
	});

	test('window blur releases all active bindings', () => {
		const calls: Array<RecordedCall> = [];
		const matcher = new ShortcutMatcher({isMac: false});
		matcher.attach(document.documentElement);
		matcher.setBindings([makeDescriptor('push_to_talk', {key: 'v', code: 'KeyV'}, {}, calls)]);

		fireKey(matcher, 'keydown', {code: 'KeyV'});
		expect(calls).toEqual([{action: 'push_to_talk', type: 'press', source: 'local'}]);

		window.dispatchEvent(new Event('blur'));
		expect(calls).toEqual([
			{action: 'push_to_talk', type: 'press', source: 'local'},
			{action: 'push_to_talk', type: 'release', source: 'local'},
		]);

		matcher.detach();
	});
});

describe('ShortcutMatcher — release semantics', () => {
	test('release fires when main key released', () => {
		const calls: Array<RecordedCall> = [];
		const matcher = new ShortcutMatcher({isMac: false});
		matcher.setBindings([makeDescriptor('push_to_talk', {key: 'v', code: 'KeyV'}, {}, calls)]);

		fireKey(matcher, 'keydown', {code: 'KeyV'});
		fireKey(matcher, 'keyup', {code: 'KeyV'});
		expect(calls.map((c) => c.type)).toEqual(['press', 'release']);

		matcher.detach();
	});

	test('release fires when required modifier released (Mac Cmd+Letter)', () => {
		const calls: Array<RecordedCall> = [];
		const matcher = new ShortcutMatcher({isMac: true});
		matcher.setBindings([makeDescriptor('push_to_talk', {key: 'v', code: 'KeyV', ctrlOrMeta: true}, {}, calls)]);

		fireKey(matcher, 'keydown', {code: 'KeyV', metaKey: true});
		expect(calls.map((c) => c.type)).toEqual(['press']);

		fireKey(matcher, 'keyup', {code: 'MetaLeft'});
		expect(calls.map((c) => c.type)).toEqual(['press', 'release']);

		matcher.detach();
	});

	test('irrelevant keyup does not trigger release', () => {
		const calls: Array<RecordedCall> = [];
		const matcher = new ShortcutMatcher({isMac: false});
		matcher.setBindings([makeDescriptor('push_to_talk', {key: 'v', code: 'KeyV'}, {}, calls)]);

		fireKey(matcher, 'keydown', {code: 'KeyV'});
		fireKey(matcher, 'keyup', {code: 'KeyX'});
		expect(calls.map((c) => c.type)).toEqual(['press']);

		matcher.detach();
	});
});

describe('ShortcutMatcher — duplicate combos (last wins)', () => {
	test('when two bindings share the same combo, the later one fires', () => {
		const calls: Array<RecordedCall> = [];
		const matcher = new ShortcutMatcher({isMac: false});
		matcher.setBindings([
			makeDescriptor('mark_channel_read', {key: 'Escape'}, {}, calls),
			makeDescriptor('decline_incoming_call', {key: 'Escape'}, {}, calls),
		]);

		fireKey(matcher, 'keydown', {code: 'Escape'});
		expect(calls).toEqual([{action: 'decline_incoming_call', type: 'press', source: 'local'}]);

		matcher.detach();
	});
});

describe('ShortcutMatcher — scope (isActive)', () => {
	test('inactive scope skips binding, lower-priority binding fires instead', () => {
		const calls: Array<RecordedCall> = [];
		const matcher = new ShortcutMatcher({isMac: false});
		let callRinging = false;
		matcher.setBindings([
			makeDescriptor('mark_channel_read', {key: 'Escape'}, {}, calls),
			makeDescriptor('decline_incoming_call', {key: 'Escape'}, {isActive: () => callRinging}, calls),
		]);

		fireKey(matcher, 'keydown', {code: 'Escape'});
		expect(calls.map((c) => c.action)).toEqual(['mark_channel_read']);

		callRinging = true;
		calls.length = 0;
		fireKey(matcher, 'keydown', {code: 'Escape'});
		expect(calls.map((c) => c.action)).toEqual(['decline_incoming_call']);

		matcher.detach();
	});

	test('scope returning false on press prevents handler from firing', () => {
		const calls: Array<RecordedCall> = [];
		const matcher = new ShortcutMatcher({isMac: false});
		matcher.setBindings([
			makeDescriptor('answer_incoming_call', {key: 'Enter', ctrlOrMeta: true}, {isActive: () => false}, calls),
		]);

		fireKey(matcher, 'keydown', {code: 'Enter', ctrlKey: true});
		expect(calls).toEqual([]);

		matcher.detach();
	});
});

describe('ShortcutMatcher — mouse buttons', () => {
	test('webMouseButtonToCanonical: back=4, forward=5', () => {
		expect(webMouseButtonToCanonical(0)).toBe(1);
		expect(webMouseButtonToCanonical(1)).toBe(2);
		expect(webMouseButtonToCanonical(2)).toBe(3);
		expect(webMouseButtonToCanonical(3)).toBe(4);
		expect(webMouseButtonToCanonical(4)).toBe(5);
	});

	test('Mouse4 binding fires on mousedown button=3 and releases on mouseup', () => {
		const calls: Array<RecordedCall> = [];
		const matcher = new ShortcutMatcher({isMac: false});
		matcher.setBindings([makeDescriptor('push_to_talk', {key: '', mouseButton: 4}, {}, calls)]);

		fireMouse(matcher, 'mousedown', {button: 3});
		expect(calls.map((c) => c.type)).toEqual(['press']);

		fireMouse(matcher, 'mouseup', {button: 3});
		expect(calls.map((c) => c.type)).toEqual(['press', 'release']);

		matcher.detach();
	});

	test('left/middle/right clicks do not trigger Mouse4 binding', () => {
		const calls: Array<RecordedCall> = [];
		const matcher = new ShortcutMatcher({isMac: false});
		matcher.setBindings([makeDescriptor('push_to_talk', {key: '', mouseButton: 4}, {}, calls)]);

		fireMouse(matcher, 'mousedown', {button: 0});
		fireMouse(matcher, 'mousedown', {button: 1});
		fireMouse(matcher, 'mousedown', {button: 2});
		expect(calls).toHaveLength(0);

		matcher.detach();
	});

	test('mouse binding with modifiers only fires when modifiers present', () => {
		const calls: Array<RecordedCall> = [];
		const matcher = new ShortcutMatcher({isMac: false});
		matcher.setBindings([makeDescriptor('push_to_talk', {key: '', mouseButton: 5, ctrlOrMeta: true}, {}, calls)]);

		fireMouse(matcher, 'mousedown', {button: 4});
		expect(calls).toHaveLength(0);

		fireMouse(matcher, 'mousedown', {button: 4, ctrlKey: true});
		expect(calls).toHaveLength(1);

		matcher.detach();
	});

	test('mouse binding blocked in editable by default', () => {
		const calls: Array<RecordedCall> = [];
		const matcher = new ShortcutMatcher({isMac: false});
		matcher.setBindings([makeDescriptor('toggle_pins_popout', {key: '', mouseButton: 4}, {}, calls)]);

		const textarea = document.createElement('textarea');
		fireMouse(matcher, 'mousedown', {button: 3, target: textarea});
		expect(calls).toHaveLength(0);

		matcher.detach();
	});

	test('PTT-style mouse binding allowed in editable with allowInEditable', () => {
		const calls: Array<RecordedCall> = [];
		const matcher = new ShortcutMatcher({isMac: false});
		matcher.setBindings([makeDescriptor('push_to_talk', {key: '', mouseButton: 4}, {allowInEditable: true}, calls)]);

		const textarea = document.createElement('textarea');
		fireMouse(matcher, 'mousedown', {button: 3, target: textarea});
		expect(calls).toHaveLength(1);

		matcher.detach();
	});
});

describe('ShortcutMatcher — multibinding overlap', () => {
	test('release fires only when last held combo for the action drops', () => {
		const calls: Array<RecordedCall> = [];
		const matcher = new ShortcutMatcher({isMac: false});
		matcher.setBindings([
			makeDescriptor('push_to_talk', {key: 'v', code: 'KeyV'}, {allowInEditable: true}, calls),
			makeDescriptor('push_to_talk', {key: '', mouseButton: 4}, {allowInEditable: true}, calls),
		]);

		fireKey(matcher, 'keydown', {code: 'KeyV'});
		expect(calls.map((c) => c.type)).toEqual(['press']);

		fireMouse(matcher, 'mousedown', {button: 3});
		expect(calls.map((c) => c.type)).toEqual(['press', 'press']);

		fireKey(matcher, 'keyup', {code: 'KeyV'});
		expect(calls.map((c) => c.type)).toEqual(['press', 'press']);

		fireMouse(matcher, 'mouseup', {button: 3});
		expect(calls.map((c) => c.type)).toEqual(['press', 'press', 'release']);

		matcher.detach();
	});

	test('tap sequence survives a missed keyup (Mac Cmd+Letter keyup swallow)', () => {
		const calls: Array<RecordedCall> = [];
		const matcher = new ShortcutMatcher({isMac: true});
		matcher.setBindings([makeDescriptor('toggle_settings', {key: ',', ctrlOrMeta: true}, {}, calls)]);

		fireKey(matcher, 'keydown', {code: 'Comma', metaKey: true});
		expect(calls.map((c) => c.type)).toEqual(['press']);
		// keyup for Comma swallowed by macOS while Cmd held

		fireKey(matcher, 'keydown', {code: 'Comma', metaKey: true});
		expect(calls.map((c) => c.type)).toEqual(['press', 'press']);

		matcher.detach();
	});

	test('auto-repeat keydown does not fan out onPress', () => {
		const calls: Array<RecordedCall> = [];
		const matcher = new ShortcutMatcher({isMac: false});
		matcher.setBindings([makeDescriptor('quick_switcher', {key: 'k', ctrlOrMeta: true}, {}, calls)]);

		fireKey(matcher, 'keydown', {code: 'KeyK', ctrlKey: true});
		const repeat = new KeyboardEvent('keydown', {
			code: 'KeyK',
			ctrlKey: true,
			bubbles: true,
			cancelable: true,
			repeat: true,
		});
		matcher.handleKeyDown(repeat);
		expect(calls.map((c) => c.type)).toEqual(['press']);

		matcher.detach();
	});
});

describe('ShortcutMatcher — attach/detach', () => {
	test('detach removes listeners', () => {
		const matcher = new ShortcutMatcher({isMac: false});
		const root = document.createElement('div');
		const spy = vi.fn();
		matcher.setBindings([
			makeDescriptor('quick_switcher', {key: 'k', ctrlOrMeta: true}, {onPress: spy, onRelease: () => {}}),
		]);
		matcher.attach(root);

		const down = new KeyboardEvent('keydown', {code: 'KeyK', ctrlKey: true, bubbles: true, cancelable: true});
		root.dispatchEvent(down);
		expect(spy).toHaveBeenCalledOnce();

		matcher.detach();
		const down2 = new KeyboardEvent('keydown', {code: 'KeyK', ctrlKey: true, bubbles: true, cancelable: true});
		root.dispatchEvent(down2);
		expect(spy).toHaveBeenCalledOnce();
	});

	test('setBindings while active releases previous bindings', () => {
		const calls: Array<RecordedCall> = [];
		const matcher = new ShortcutMatcher({isMac: false});
		matcher.setBindings([makeDescriptor('push_to_talk', {key: 'v', code: 'KeyV'}, {}, calls)]);

		fireKey(matcher, 'keydown', {code: 'KeyV'});
		expect(calls.map((c) => c.type)).toEqual(['press']);

		matcher.setBindings([]);
		expect(calls.map((c) => c.type)).toEqual(['press', 'release']);

		matcher.detach();
	});
});
