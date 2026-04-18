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
import {msg} from '@lingui/core/macro';
import {makeAutoObservable, runInAction} from 'mobx';
import {makePersistent} from '~/lib/MobXPersistence';
import {isDesktop} from '~/utils/NativeUtils';

export type KeybindAction =
	| 'quick_switcher'
	| 'navigate_history_back'
	| 'navigate_history_forward'
	| 'navigate_server_previous'
	| 'navigate_server_next'
	| 'navigate_channel_previous'
	| 'navigate_channel_next'
	| 'navigate_unread_channel_previous'
	| 'navigate_unread_channel_next'
	| 'navigate_unread_mentions_previous'
	| 'navigate_unread_mentions_next'
	| 'navigate_to_current_call'
	| 'navigate_last_server_or_dm'
	| 'mark_channel_read'
	| 'mark_server_read'
	| 'mark_top_inbox_read'
	| 'toggle_hotkeys'
	| 'return_previous_text_channel'
	| 'return_previous_text_channel_alt'
	| 'return_connected_audio_channel'
	| 'return_connected_audio_channel_alt'
	| 'toggle_pins_popout'
	| 'toggle_mentions_popout'
	| 'toggle_channel_member_list'
	| 'toggle_emoji_picker'
	| 'toggle_gif_picker'
	| 'toggle_sticker_picker'
	| 'toggle_memes_picker'
	| 'scroll_chat_up'
	| 'scroll_chat_down'
	| 'jump_to_oldest_unread'
	| 'create_or_join_server'
	| 'answer_incoming_call'
	| 'decline_incoming_call'
	| 'create_private_group'
	| 'start_pm_call'
	| 'focus_text_area'
	| 'toggle_mute'
	| 'toggle_deafen'
	| 'toggle_video'
	| 'toggle_screen_share'
	| 'toggle_settings'
	| 'search'
	| 'upload_file'
	| 'push_to_talk'
	| 'toggle_push_to_talk_mode'
	| 'toggle_soundboard'
	| 'zoom_in'
	| 'zoom_out'
	| 'zoom_reset';

export interface KeyCombo {
	key: string;
	code?: string;
	mouseButton?: number;
	ctrlOrMeta?: boolean;
	ctrl?: boolean;
	alt?: boolean;
	shift?: boolean;
	meta?: boolean;
	global?: boolean;
	enabled?: boolean;
}

export const MOUSE_BUTTON_BACK = 4;
export const MOUSE_BUTTON_FORWARD = 5;

export type KeybindScope = 'app' | 'chat' | 'call-ringing' | 'voice-connected';

export interface KeybindConfig {
	action: KeybindAction;
	label: string;
	description?: string;
	defaultCombo: KeyCombo;
	allowGlobal?: boolean;
	scope?: KeybindScope;
	category: 'navigation' | 'voice' | 'messaging' | 'popouts' | 'calls' | 'system';
}

export interface ActiveKeybind extends KeybindConfig {
	combos: Array<KeyCombo>;
	combo: KeyCombo;
}

export const MAX_COMBOS_PER_ACTION = 2;

const TRANSMIT_MODES = ['voice_activity', 'push_to_talk'] as const;
type TransmitMode = (typeof TRANSMIT_MODES)[number];

const DEFAULT_RELEASE_DELAY_MS = 20;
const MIN_RELEASE_DELAY_MS = 20;
const MAX_RELEASE_DELAY_MS = 2000;
const LATCH_TAP_THRESHOLD_MS = 200;

const getDefaultKeybinds = (i18n: I18n): ReadonlyArray<KeybindConfig> =>
	[
		{
			action: 'quick_switcher',
			label: i18n._(msg`Find or Start a Direct Message`),
			description: i18n._(msg`Open the quick switcher overlay`),
			defaultCombo: {key: 'k', ctrlOrMeta: true},
			category: 'navigation',
		},
		{
			action: 'navigate_server_previous',
			label: i18n._(msg`Previous Community`),
			description: i18n._(msg`Navigate to the previous community`),
			defaultCombo: {key: 'ArrowUp', ctrlOrMeta: true, alt: true},
			category: 'navigation',
		},
		{
			action: 'navigate_server_next',
			label: i18n._(msg`Next Community`),
			description: i18n._(msg`Navigate to the next community`),
			defaultCombo: {key: 'ArrowDown', ctrlOrMeta: true, alt: true},
			category: 'navigation',
		},
		{
			action: 'navigate_channel_previous',
			label: i18n._(msg`Previous Channel`),
			description: i18n._(msg`Navigate to the previous channel in the community`),
			defaultCombo: {key: 'ArrowUp', alt: true},
			category: 'navigation',
		},
		{
			action: 'navigate_channel_next',
			label: i18n._(msg`Next Channel`),
			description: i18n._(msg`Navigate to the next channel in the community`),
			defaultCombo: {key: 'ArrowDown', alt: true},
			category: 'navigation',
		},
		{
			action: 'navigate_unread_channel_previous',
			label: i18n._(msg`Previous Unread Channel`),
			description: i18n._(msg`Jump to the previous unread channel`),
			defaultCombo: {key: 'ArrowUp', alt: true, shift: true},
			category: 'navigation',
		},
		{
			action: 'navigate_unread_channel_next',
			label: i18n._(msg`Next Unread Channel`),
			description: i18n._(msg`Jump to the next unread channel`),
			defaultCombo: {key: 'ArrowDown', alt: true, shift: true},
			category: 'navigation',
		},
		{
			action: 'navigate_unread_mentions_previous',
			label: i18n._(msg`Previous Unread Mention`),
			description: i18n._(msg`Jump to the previous unread channel with mentions`),
			defaultCombo: {key: 'ArrowUp', alt: true, shift: true, ctrlOrMeta: true},
			category: 'navigation',
		},
		{
			action: 'navigate_unread_mentions_next',
			label: i18n._(msg`Next Unread Mention`),
			description: i18n._(msg`Jump to the next unread channel with mentions`),
			defaultCombo: {key: 'ArrowDown', alt: true, shift: true, ctrlOrMeta: true},
			category: 'navigation',
		},
		{
			action: 'navigate_history_back',
			label: i18n._(msg`Navigate Back`),
			description: i18n._(msg`Go back in navigation history`),
			defaultCombo: {key: '[', ctrlOrMeta: true},
			category: 'navigation',
		},
		{
			action: 'navigate_history_forward',
			label: i18n._(msg`Navigate Forward`),
			description: i18n._(msg`Go forward in navigation history`),
			defaultCombo: {key: ']', ctrlOrMeta: true},
			category: 'navigation',
		},
		{
			action: 'navigate_to_current_call',
			label: i18n._(msg`Go to Current Call`),
			description: i18n._(msg`Jump to the channel of the active call`),
			defaultCombo: {key: 'v', alt: true, shift: true, ctrlOrMeta: true},
			category: 'navigation',
		},
		{
			action: 'navigate_last_server_or_dm',
			label: i18n._(msg`Toggle Last Community / DMs`),
			description: i18n._(msg`Switch between the last community and direct messages`),
			defaultCombo: {key: 'ArrowRight', alt: true, ctrlOrMeta: true},
			category: 'navigation',
		},
		{
			action: 'return_previous_text_channel',
			label: i18n._(msg`Return to Previous Text Channel`),
			description: i18n._(msg`Go back to the previously focused text channel`),
			defaultCombo: {key: 'b', ctrlOrMeta: true},
			category: 'navigation',
		},
		{
			action: 'return_previous_text_channel_alt',
			label: i18n._(msg`Return to Previous Text Channel (Alt)`),
			description: i18n._(msg`Alternate binding to jump back to the previously focused text channel`),
			defaultCombo: {key: 'ArrowRight', alt: true},
			category: 'navigation',
		},
		{
			action: 'return_connected_audio_channel',
			label: i18n._(msg`Return to Active Audio Channel`),
			description: i18n._(msg`Focus the audio channel you are currently connected to`),
			defaultCombo: {key: 'a', alt: true, ctrlOrMeta: true},
			category: 'voice',
		},
		{
			action: 'return_connected_audio_channel_alt',
			label: i18n._(msg`Return to Connected Audio Channel`),
			description: i18n._(msg`Alternate binding to focus the audio channel you are connected to`),
			defaultCombo: {key: 'ArrowLeft', alt: true},
			category: 'voice',
		},
		{
			action: 'toggle_settings',
			label: i18n._(msg`Open User Settings`),
			description: i18n._(msg`Open user settings modal`),
			defaultCombo: {key: ',', ctrlOrMeta: true},
			category: 'navigation',
		},
		{
			action: 'toggle_hotkeys',
			label: i18n._(msg`Toggle Hotkeys`),
			description: i18n._(msg`Show or hide keyboard shortcut help`),
			defaultCombo: {key: '/', ctrlOrMeta: true},
			category: 'system',
		},
		{
			action: 'toggle_pins_popout',
			label: i18n._(msg`Toggle Pins Popout`),
			description: i18n._(msg`Open or close pinned messages`),
			defaultCombo: {key: 'p', ctrlOrMeta: true},
			category: 'popouts',
		},
		{
			action: 'toggle_mentions_popout',
			label: i18n._(msg`Toggle Mentions Popout`),
			description: i18n._(msg`Open or close recent mentions`),
			defaultCombo: {key: 'i', ctrlOrMeta: true},
			category: 'popouts',
		},
		{
			action: 'toggle_channel_member_list',
			label: i18n._(msg`Toggle Channel Member List`),
			description: i18n._(msg`Show or hide the member list for the current channel`),
			defaultCombo: {key: 'u', ctrlOrMeta: true},
			category: 'popouts',
		},
		{
			action: 'toggle_emoji_picker',
			label: i18n._(msg`Toggle Emoji Picker`),
			description: i18n._(msg`Open or close the emoji picker`),
			defaultCombo: {key: 'e', ctrlOrMeta: true},
			category: 'popouts',
		},
		{
			action: 'toggle_gif_picker',
			label: i18n._(msg`Toggle GIF Picker`),
			description: i18n._(msg`Open or close the GIF picker`),
			defaultCombo: {key: 'g', ctrlOrMeta: true},
			category: 'popouts',
		},
		{
			action: 'toggle_sticker_picker',
			label: i18n._(msg`Toggle Sticker Picker`),
			description: i18n._(msg`Open or close the sticker picker`),
			defaultCombo: {key: 's', ctrlOrMeta: true},
			category: 'popouts',
		},
		{
			action: 'toggle_memes_picker',
			label: i18n._(msg`Toggle Memes Picker`),
			description: i18n._(msg`Open or close the memes picker`),
			defaultCombo: {key: 'm', ctrlOrMeta: true},
			category: 'popouts',
		},
		{
			action: 'scroll_chat_up',
			label: i18n._(msg`Scroll Chat Up`),
			description: i18n._(msg`Scroll the chat history up`),
			defaultCombo: {key: 'PageUp'},
			category: 'messaging',
		},
		{
			action: 'scroll_chat_down',
			label: i18n._(msg`Scroll Chat Down`),
			description: i18n._(msg`Scroll the chat history down`),
			defaultCombo: {key: 'PageDown'},
			category: 'messaging',
		},
		{
			action: 'jump_to_oldest_unread',
			label: i18n._(msg`Jump to Oldest Unread Message`),
			description: i18n._(msg`Jump to the oldest unread message in the channel`),
			defaultCombo: {key: 'PageUp', shift: true},
			category: 'messaging',
		},
		{
			action: 'mark_channel_read',
			label: i18n._(msg`Mark Channel as Read`),
			description: i18n._(msg`Mark the current channel as read`),
			defaultCombo: {key: 'Escape'},
			category: 'messaging',
		},
		{
			action: 'mark_server_read',
			label: i18n._(msg`Mark Community as Read`),
			description: i18n._(msg`Mark the current community as read`),
			defaultCombo: {key: 'Escape', shift: true},
			category: 'messaging',
		},
		{
			action: 'mark_top_inbox_read',
			label: i18n._(msg`Mark Top Inbox Channel as Read`),
			description: i18n._(msg`Mark the first unread channel in your inbox as read`),
			defaultCombo: {key: 'e', ctrlOrMeta: true, shift: true},
			category: 'messaging',
		},
		{
			action: 'create_or_join_server',
			label: i18n._(msg`Create or Join a Community`),
			description: i18n._(msg`Open the create or join community flow`),
			defaultCombo: {key: 'n', ctrlOrMeta: true, shift: true},
			category: 'system',
		},
		{
			action: 'create_private_group',
			label: i18n._(msg`Create a Private Group`),
			description: i18n._(msg`Start a new private group`),
			defaultCombo: {key: 't', ctrlOrMeta: true, shift: true},
			category: 'system',
		},
		{
			action: 'start_pm_call',
			label: i18n._(msg`Start Call in Private Message or Group`),
			description: i18n._(msg`Begin a call in the current private conversation`),
			defaultCombo: {key: "'", ctrlOrMeta: true},
			category: 'calls',
		},
		{
			action: 'answer_incoming_call',
			label: i18n._(msg`Answer Incoming Call`),
			description: i18n._(msg`Accept the incoming call`),
			defaultCombo: {key: 'Enter', ctrlOrMeta: true},
			scope: 'call-ringing',
			category: 'calls',
		},
		{
			action: 'decline_incoming_call',
			label: i18n._(msg`Decline Incoming Call`),
			description: i18n._(msg`Decline or dismiss the incoming call`),
			defaultCombo: {key: 'Escape'},
			scope: 'call-ringing',
			category: 'calls',
		},
		{
			action: 'focus_text_area',
			label: i18n._(msg`Focus Text Area`),
			description: i18n._(msg`Move focus to the message composer`),
			defaultCombo: {key: 'Tab'},
			category: 'messaging',
		},
		{
			action: 'toggle_mute',
			label: i18n._(msg`Toggle Mute`),
			description: i18n._(msg`Mute / unmute microphone`),
			defaultCombo: {key: 'm', ctrlOrMeta: true, shift: true, global: true, enabled: true},
			allowGlobal: true,
			category: 'voice',
		},
		{
			action: 'toggle_deafen',
			label: i18n._(msg`Toggle Deaf`),
			description: i18n._(msg`Deafen / undeafen`),
			defaultCombo: {key: 'd', ctrlOrMeta: true, shift: true, global: true, enabled: true},
			allowGlobal: true,
			category: 'voice',
		},
		{
			action: 'toggle_video',
			label: i18n._(msg`Toggle Camera`),
			description: i18n._(msg`Turn camera on or off`),
			defaultCombo: {key: 'v', ctrlOrMeta: true, shift: true},
			category: 'voice',
		},
		{
			action: 'toggle_screen_share',
			label: i18n._(msg`Toggle Screen Share`),
			description: i18n._(msg`Start / stop screen sharing`),
			defaultCombo: {key: 's', ctrlOrMeta: true, shift: true},
			category: 'voice',
		},
		{
			action: 'search',
			label: i18n._(msg`Search`),
			description: i18n._(msg`Search within the current view`),
			defaultCombo: {key: 'f', ctrlOrMeta: true},
			category: 'system',
		},
		{
			action: 'upload_file',
			label: i18n._(msg`Upload a File`),
			description: i18n._(msg`Open the upload file dialog`),
			defaultCombo: {key: 'u', ctrlOrMeta: true, shift: true},
			category: 'messaging',
		},
		{
			action: 'push_to_talk',
			label: i18n._(msg`Push-To-Talk (hold)`),
			description: i18n._(msg`Hold to temporarily unmute when push-to-talk is enabled`),
			defaultCombo: {key: '', enabled: false, global: false},
			allowGlobal: true,
			category: 'voice',
		},
		{
			action: 'toggle_push_to_talk_mode',
			label: i18n._(msg`Toggle Push-To-Talk Mode`),
			description: i18n._(msg`Enable or disable push-to-talk`),
			defaultCombo: {key: 'p', ctrlOrMeta: true, shift: true},
			category: 'voice',
		},
		{
			action: 'zoom_in',
			label: i18n._(msg`Zoom In`),
			description: i18n._(msg`Increase app zoom level`),
			defaultCombo: {key: '=', ctrlOrMeta: true},
			category: 'system',
		},
		{
			action: 'zoom_out',
			label: i18n._(msg`Zoom Out`),
			description: i18n._(msg`Decrease app zoom level`),
			defaultCombo: {key: '-', ctrlOrMeta: true},
			category: 'system',
		},
		{
			action: 'zoom_reset',
			label: i18n._(msg`Reset Zoom`),
			description: i18n._(msg`Reset zoom to 100%`),
			defaultCombo: {key: '0', ctrlOrMeta: true},
			category: 'system',
		},
	] as const;

type StoredCombos = KeyCombo | Array<KeyCombo>;
type KeybindState = Record<KeybindAction, StoredCombos>;

const PERSIST_KEY = 'KeybindStore';

const normalizeCombos = (value: StoredCombos | undefined): Array<KeyCombo> | undefined => {
	if (!value) return undefined;
	return Array.isArray(value) ? value : [value];
};

const applyPttAutoGlobal = (action: KeybindAction, combos: Array<KeyCombo>): Array<KeyCombo> => {
	if (action !== 'push_to_talk' || !isDesktop()) return combos;
	return combos.map((c) => (c.key || c.code ? {...c, global: true} : c));
};

export function migrateLegacyKeybindPersist(storage: Pick<Storage, 'getItem' | 'setItem'>): boolean {
	try {
		const raw = storage.getItem(PERSIST_KEY);
		if (!raw) return false;
		const parsed = JSON.parse(raw);
		const keybinds = parsed?.keybinds;
		if (!keybinds || typeof keybinds !== 'object' || Array.isArray(keybinds)) return false;

		let changed = false;
		for (const [action, value] of Object.entries(keybinds)) {
			if (value && !Array.isArray(value) && typeof value === 'object') {
				(keybinds as Record<string, unknown>)[action] = [value];
				changed = true;
			}
		}

		if (!changed) return false;
		storage.setItem(PERSIST_KEY, JSON.stringify(parsed));
		return true;
	} catch {
		return false;
	}
}

if (typeof window !== 'undefined' && 'localStorage' in window) {
	migrateLegacyKeybindPersist(window.localStorage);
}

class KeybindStore {
	keybinds: KeybindState = {} as KeybindState;

	transmitMode: TransmitMode = 'voice_activity';
	pushToTalkHeld = false;
	pushToTalkReleaseDelay = DEFAULT_RELEASE_DELAY_MS;
	pushToTalkLatching = false;

	private pushToTalkLatched = false;
	private pushToTalkPressTime = 0;
	private i18n: I18n | null = null;
	private initialized = false;

	constructor() {
		makeAutoObservable(this, {}, {autoBind: true});

		void makePersistent(
			this,
			PERSIST_KEY,
			['keybinds', 'transmitMode', 'pushToTalkReleaseDelay', 'pushToTalkLatching'],
			{version: 3},
		);
	}

	setI18n(i18n: I18n): void {
		this.i18n = i18n;
		if (!this.initialized) {
			// Only populate defaults on first-ever use. If keybinds were already
			// hydrated from persistence we must not overwrite them — the PTT
			// keybind (and any other user-customised shortcut) would be wiped
			// because the default PTT combo has no key assigned.
			if (Object.keys(this.keybinds).length === 0) {
				this.resetToDefaults();
			}
			this.migratePttGlobal();
			this.initialized = true;
		}
	}

	private migratePttGlobal(): void {
		if (!isDesktop()) return;
		const stored = this.keybinds.push_to_talk;
		const combos = normalizeCombos(stored);
		if (!combos || combos.length === 0) return;
		const needsMigration = combos.some((ptt) => (ptt.key || ptt.code) && !ptt.global);
		if (!needsMigration) return;
		console.info('[KeybindStore] Migrating PTT keybind to global: true');
		runInAction(() => {
			this.keybinds.push_to_talk = combos.map((ptt) => (ptt.key || ptt.code ? {...ptt, global: true} : ptt));
		});
	}

	private getCombosForAction(action: KeybindAction, defaultCombo: KeyCombo): Array<KeyCombo> {
		return normalizeCombos(this.keybinds[action]) ?? [defaultCombo];
	}

	private toActiveKeybind(entry: KeybindConfig): ActiveKeybind {
		const combos = this.getCombosForAction(entry.action, entry.defaultCombo);
		return {
			...entry,
			combos,
			combo: combos[0] ?? entry.defaultCombo,
		};
	}

	getAll(): Array<ActiveKeybind> {
		if (!this.i18n) {
			throw new Error('KeybindStore: i18n not initialized');
		}
		return getDefaultKeybinds(this.i18n).map((entry) => this.toActiveKeybind(entry));
	}

	getByAction(action: KeybindAction): ActiveKeybind {
		if (!this.i18n) {
			throw new Error('KeybindStore: i18n not initialized');
		}
		const base = getDefaultKeybinds(this.i18n).find((k) => k.action === action);
		if (!base) throw new Error(`Unknown keybind action: ${action}`);
		return this.toActiveKeybind(base);
	}

	setKeybinds(action: KeybindAction, combos: Array<KeyCombo>): void {
		runInAction(() => {
			this.keybinds[action] = applyPttAutoGlobal(action, combos);
		});
	}

	setKeybind(action: KeybindAction, combo: KeyCombo): void {
		this.setKeybinds(action, [combo]);
	}

	setKeybindAt(action: KeybindAction, index: number, combo: KeyCombo): void {
		const current = normalizeCombos(this.keybinds[action]) ?? [];
		const updated = [...current];
		if (index < 0 || index > MAX_COMBOS_PER_ACTION - 1) return;
		updated[index] = combo;
		this.setKeybinds(action, updated);
	}

	addKeybind(action: KeybindAction, combo: KeyCombo): void {
		const current = normalizeCombos(this.keybinds[action]) ?? [];
		if (current.length >= MAX_COMBOS_PER_ACTION) return;
		this.setKeybinds(action, [...current, combo]);
	}

	removeKeybindAt(action: KeybindAction, index: number): void {
		const current = normalizeCombos(this.keybinds[action]) ?? [];
		if (index < 0 || index >= current.length) return;
		this.setKeybinds(
			action,
			current.filter((_, i) => i !== index),
		);
	}

	toggleGlobal(action: KeybindAction, enabled: boolean): void {
		const config = this.getByAction(action);
		if (!config.allowGlobal) return;
		this.setKeybinds(
			action,
			config.combos.map((c) => ({...c, global: enabled})),
		);
	}

	resetToDefaults(): void {
		if (!this.i18n) {
			throw new Error('KeybindStore: i18n not initialized');
		}
		const defaultKeybinds = getDefaultKeybinds(this.i18n);
		runInAction(() => {
			this.keybinds = defaultKeybinds.reduce<KeybindState>((acc, entry) => {
				acc[entry.action] = [{...entry.defaultCombo}];
				return acc;
			}, {} as KeybindState);
		});
	}

	setTransmitMode(mode: TransmitMode): void {
		runInAction(() => {
			this.transmitMode = mode;
		});
	}

	isPushToTalkEnabled(): boolean {
		return this.transmitMode === 'push_to_talk';
	}

	setPushToTalkHeld(held: boolean): void {
		runInAction(() => {
			this.pushToTalkHeld = held;
		});
	}

	isPushToTalkMuted(userMuted: boolean): boolean {
		if (!this.isPushToTalkEnabled()) return false;
		if (userMuted) return false;
		if (this.pushToTalkLatched) return false;
		return !this.pushToTalkHeld;
	}

	hasPushToTalkKeybind(): boolean {
		const {combos} = this.getByAction('push_to_talk');
		return combos.some((c) => Boolean(c.key || c.code));
	}

	isPushToTalkEffective(): boolean {
		return this.isPushToTalkEnabled() && this.hasPushToTalkKeybind();
	}

	setPushToTalkReleaseDelay(delayMs: number): void {
		const clamped = Math.max(MIN_RELEASE_DELAY_MS, Math.min(MAX_RELEASE_DELAY_MS, delayMs));

		runInAction(() => {
			this.pushToTalkReleaseDelay = clamped;
		});
	}

	setPushToTalkLatching(enabled: boolean): void {
		runInAction(() => {
			this.pushToTalkLatching = enabled;
			if (!enabled) this.pushToTalkLatched = false;
		});
	}

	handlePushToTalkPress(nowMs: number = Date.now()): boolean {
		this.pushToTalkPressTime = nowMs;

		console.info('[PTT:KeybindStore] handlePushToTalkPress', {
			latching: this.pushToTalkLatching,
			latched: this.pushToTalkLatched,
			held: this.pushToTalkHeld,
		});

		if (this.pushToTalkLatching && this.pushToTalkLatched) {
			console.info('[PTT:KeybindStore] Press while latched → unlatching, returning false');
			runInAction(() => {
				this.pushToTalkLatched = false;
				this.pushToTalkHeld = false;
			});
			return false;
		}

		runInAction(() => {
			this.pushToTalkHeld = true;
		});
		console.info('[PTT:KeybindStore] Press → held=true, returning true (should unmute)');
		return true;
	}

	handlePushToTalkRelease(nowMs: number = Date.now()): boolean {
		const pressDuration = nowMs - this.pushToTalkPressTime;

		console.info('[PTT:KeybindStore] handlePushToTalkRelease', {
			pressDuration,
			latching: this.pushToTalkLatching,
			latched: this.pushToTalkLatched,
			latchThreshold: LATCH_TAP_THRESHOLD_MS,
		});

		if (this.pushToTalkLatching && pressDuration < LATCH_TAP_THRESHOLD_MS && !this.pushToTalkLatched) {
			console.info('[PTT:KeybindStore] Quick tap → latching, returning false');
			runInAction(() => {
				this.pushToTalkLatched = true;
			});
			return false;
		}

		runInAction(() => {
			this.pushToTalkHeld = false;
		});
		console.info('[PTT:KeybindStore] Release → held=false, returning true (should mute)');
		return true;
	}

	isPushToTalkLatched(): boolean {
		return this.pushToTalkLatched;
	}

	resetPushToTalkState(): void {
		runInAction(() => {
			this.pushToTalkHeld = false;
			this.pushToTalkLatched = false;
			this.pushToTalkPressTime = 0;
		});
	}
}

export default new KeybindStore();

export const getDefaultKeybind = (action: KeybindAction, i18n: I18n): KeyCombo | null => {
	const defaultKeybinds = getDefaultKeybinds(i18n);
	const found = defaultKeybinds.find((k) => k.action === action);
	return found ? {...found.defaultCombo} : null;
};
