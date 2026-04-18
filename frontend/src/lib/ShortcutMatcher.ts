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

export type ShortcutSource = 'local' | 'global';

export interface KeybindDescriptor<A extends string = string> {
	action: A;
	combo: KeyCombo;
	onPress: (source: ShortcutSource) => void;
	onRelease: (source: ShortcutSource) => void;
	allowInEditable?: boolean;
	preventDefault?: boolean;
	isActive?: () => boolean;
}

export interface ShortcutMatcherOptions {
	isMac?: boolean;
}

const NON_TEXT_INPUT_TYPES = new Set([
	'button',
	'checkbox',
	'radio',
	'range',
	'color',
	'file',
	'image',
	'submit',
	'reset',
]);

const PUNCT_TO_CODE: Record<string, string> = {
	'=': 'Equal',
	'+': 'Equal',
	'-': 'Minus',
	_: 'Minus',
	'[': 'BracketLeft',
	'{': 'BracketLeft',
	']': 'BracketRight',
	'}': 'BracketRight',
	',': 'Comma',
	'<': 'Comma',
	'.': 'Period',
	'>': 'Period',
	'/': 'Slash',
	'?': 'Slash',
	';': 'Semicolon',
	':': 'Semicolon',
	"'": 'Quote',
	'"': 'Quote',
	'\\': 'Backslash',
	'|': 'Backslash',
	'`': 'Backquote',
	'~': 'Backquote',
	' ': 'Space',
};

const NAMED_TO_CODE: Record<string, string> = {
	Escape: 'Escape',
	Esc: 'Escape',
	Enter: 'Enter',
	NumpadEnter: 'NumpadEnter',
	Tab: 'Tab',
	Backspace: 'Backspace',
	Space: 'Space',
	Spacebar: 'Space',
	ArrowUp: 'ArrowUp',
	ArrowDown: 'ArrowDown',
	ArrowLeft: 'ArrowLeft',
	ArrowRight: 'ArrowRight',
	Up: 'ArrowUp',
	Down: 'ArrowDown',
	Left: 'ArrowLeft',
	Right: 'ArrowRight',
	PageUp: 'PageUp',
	PageDown: 'PageDown',
	Home: 'Home',
	End: 'End',
	Insert: 'Insert',
	Delete: 'Delete',
	CapsLock: 'CapsLock',
};

const KEY_CODE_RE = /^Key[A-Z]$/;
const DIGIT_CODE_RE = /^Digit[0-9]$/;
const F_KEY_RE = /^F([1-9]|1[0-9]|2[0-4])$/;

export function jsKeyToEventCode(key: string | undefined | null): string | null {
	if (!key) return null;
	if (KEY_CODE_RE.test(key)) return key;
	if (DIGIT_CODE_RE.test(key)) return key;
	if (F_KEY_RE.test(key)) return key;
	if (/^[a-zA-Z]$/.test(key)) return `Key${key.toUpperCase()}`;
	if (/^[0-9]$/.test(key)) return `Digit${key}`;
	if (PUNCT_TO_CODE[key]) return PUNCT_TO_CODE[key];
	if (NAMED_TO_CODE[key]) return NAMED_TO_CODE[key];
	return null;
}

export function resolveBindingCode(combo: KeyCombo): string | null {
	if (combo.code && combo.code.length > 0) return combo.code;
	return jsKeyToEventCode(combo.key);
}

export function webMouseButtonToCanonical(webButton: number): number {
	return webButton + 1;
}

function isEditableTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	if (target.isContentEditable) return true;
	const tagName = target.tagName;
	if (tagName === 'TEXTAREA') return true;
	if (tagName === 'INPUT') {
		const type = ((target as HTMLInputElement).type || '').toLowerCase();
		return !NON_TEXT_INPUT_TYPES.has(type);
	}
	return false;
}

interface InternalBinding {
	descriptor: KeybindDescriptor;
	code: string | null;
	mouseButton: number | null;
	needCtrl: boolean;
	needMeta: boolean;
	needAlt: boolean;
	needShift: boolean;
}

const activeKey = (b: InternalBinding): string => (b.mouseButton !== null ? `mouse:${b.mouseButton}` : `key:${b.code}`);

function detectMac(): boolean {
	if (typeof navigator === 'undefined') return false;
	return /Mac|iPod|iPhone|iPad/.test(navigator.platform ?? '');
}

export class ShortcutMatcher {
	private readonly isMac: boolean;
	private bindings: Array<InternalBinding> = [];
	private readonly pressedCodes = new Set<string>();
	private readonly active = new Map<string, InternalBinding>();
	private readonly activeActionCount = new Map<string, number>();
	private attachedRoot: Node | null = null;

	constructor(options: ShortcutMatcherOptions = {}) {
		this.isMac = options.isMac ?? detectMac();
	}

	attach(root: Node): void {
		if (this.attachedRoot) return;
		root.addEventListener('keydown', this.handleKeyDown as EventListener);
		root.addEventListener('keyup', this.handleKeyUp as EventListener);
		root.addEventListener('mousedown', this.handleMouseDown as EventListener);
		root.addEventListener('mouseup', this.handleMouseUp as EventListener);
		if (typeof window !== 'undefined') {
			window.addEventListener('blur', this.handleBlur);
		}
		this.attachedRoot = root;
	}

	detach(): void {
		if (!this.attachedRoot) return;
		this.attachedRoot.removeEventListener('keydown', this.handleKeyDown as EventListener);
		this.attachedRoot.removeEventListener('keyup', this.handleKeyUp as EventListener);
		this.attachedRoot.removeEventListener('mousedown', this.handleMouseDown as EventListener);
		this.attachedRoot.removeEventListener('mouseup', this.handleMouseUp as EventListener);
		if (typeof window !== 'undefined') {
			window.removeEventListener('blur', this.handleBlur);
		}
		this.attachedRoot = null;
		this.releaseAll('local');
		this.pressedCodes.clear();
	}

	setBindings(descriptors: ReadonlyArray<KeybindDescriptor>): void {
		this.releaseAll('local');
		this.bindings = [];
		for (const descriptor of descriptors) {
			const mouseButton = descriptor.combo.mouseButton ?? null;
			const code = mouseButton !== null ? null : resolveBindingCode(descriptor.combo);
			if (mouseButton === null && !code) continue;
			this.bindings.push({
				descriptor,
				code,
				mouseButton,
				needCtrl: !!(descriptor.combo.ctrl || (!this.isMac && descriptor.combo.ctrlOrMeta)),
				needMeta: !!(descriptor.combo.meta || (this.isMac && descriptor.combo.ctrlOrMeta)),
				needAlt: !!descriptor.combo.alt,
				needShift: !!descriptor.combo.shift,
			});
		}
	}

	resetPressedState(): void {
		this.releaseAll('local');
		this.pressedCodes.clear();
	}

	triggerFromGlobal(action: string, type: 'press' | 'release'): void {
		const binding = this.bindings.find((b) => b.descriptor.action === action);
		if (!binding) return;
		if (type === 'press') this.firePress(binding, 'global');
		else this.fireRelease(binding, 'global');
	}

	private firePress(binding: InternalBinding, source: ShortcutSource): void {
		const action = binding.descriptor.action;
		const count = this.activeActionCount.get(action) ?? 0;
		this.activeActionCount.set(action, count + 1);
		if (count === 0) binding.descriptor.onPress(source);
	}

	private fireRelease(binding: InternalBinding, source: ShortcutSource): void {
		const action = binding.descriptor.action;
		const count = this.activeActionCount.get(action) ?? 0;
		if (count <= 1) {
			this.activeActionCount.delete(action);
			binding.descriptor.onRelease(source);
		} else {
			this.activeActionCount.set(action, count - 1);
		}
	}

	private releaseAll(source: ShortcutSource): void {
		for (const [, binding] of this.active) {
			this.fireRelease(binding, source);
		}
		this.active.clear();
		this.activeActionCount.clear();
	}

	private handleBlur = () => {
		this.releaseAll('local');
		this.pressedCodes.clear();
	};

	readonly handleKeyDown = (event: KeyboardEvent): void => {
		if (event.isComposing) return;
		if (!event.code) return;

		this.pressedCodes.add(event.code);

		let lastMatch: InternalBinding | null = null;
		for (const binding of this.bindings) {
			if (binding.mouseButton !== null) continue;
			if (binding.code !== event.code) continue;
			if (!this.modifiersMatch(event, binding)) continue;
			if (!binding.descriptor.allowInEditable && isEditableTarget(event.target)) continue;
			if (binding.descriptor.isActive && !binding.descriptor.isActive()) continue;
			lastMatch = binding;
		}

		if (!lastMatch) return;

		this.active.set(activeKey(lastMatch), lastMatch);
		this.firePress(lastMatch, 'local');

		if (lastMatch.descriptor.preventDefault !== false) {
			event.preventDefault();
		}
	};

	readonly handleKeyUp = (event: KeyboardEvent): void => {
		if (!event.code) return;

		this.pressedCodes.delete(event.code);

		for (const [key, binding] of Array.from(this.active)) {
			if (binding.mouseButton !== null) continue;
			if (this.shouldReleaseKey(event, binding)) {
				this.active.delete(key);
				this.fireRelease(binding, 'local');
			}
		}
	};

	readonly handleMouseDown = (event: MouseEvent): void => {
		const canonical = webMouseButtonToCanonical(event.button);

		let lastMatch: InternalBinding | null = null;
		for (const binding of this.bindings) {
			if (binding.mouseButton === null) continue;
			if (binding.mouseButton !== canonical) continue;
			if (!this.modifiersMatch(event, binding)) continue;
			if (!binding.descriptor.allowInEditable && isEditableTarget(event.target)) continue;
			if (binding.descriptor.isActive && !binding.descriptor.isActive()) continue;
			lastMatch = binding;
		}

		if (!lastMatch) return;

		this.active.set(activeKey(lastMatch), lastMatch);
		this.firePress(lastMatch, 'local');

		if (lastMatch.descriptor.preventDefault !== false) {
			event.preventDefault();
		}
	};

	readonly handleMouseUp = (event: MouseEvent): void => {
		const canonical = webMouseButtonToCanonical(event.button);

		for (const [key, binding] of Array.from(this.active)) {
			if (binding.mouseButton === null) continue;
			if (binding.mouseButton === canonical) {
				this.active.delete(key);
				this.fireRelease(binding, 'local');
			}
		}
	};

	private modifiersMatch(
		event: {ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean},
		binding: InternalBinding,
	): boolean {
		if (binding.needCtrl !== event.ctrlKey) return false;
		if (binding.needMeta !== event.metaKey) return false;
		if (binding.needAlt !== event.altKey) return false;
		if (binding.needShift !== event.shiftKey) return false;
		return true;
	}

	private shouldReleaseKey(event: KeyboardEvent, binding: InternalBinding): boolean {
		if (event.code === binding.code) return true;

		const code = event.code;
		if (binding.needCtrl && (code === 'ControlLeft' || code === 'ControlRight')) return true;
		if (binding.needMeta && (code === 'MetaLeft' || code === 'MetaRight')) return true;
		if (binding.needAlt && (code === 'AltLeft' || code === 'AltRight')) return true;
		if (binding.needShift && (code === 'ShiftLeft' || code === 'ShiftRight')) return true;
		return false;
	}
}
