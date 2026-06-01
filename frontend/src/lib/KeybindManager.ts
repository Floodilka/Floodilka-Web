/*
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright (C) 2020-2026 Fluxer Contributors
 * Copyright (C) 2026 Floodilka Contributors
 * Modified by Floodilka Contributors starting March 2026. See LICENSE and NOTICE.
 */

import type {I18n} from '@lingui/core';
import {msg} from '@lingui/core/macro';
import {autorun, reaction} from 'mobx';
import React from 'react';
import * as CallActionCreators from '~/actions/CallActionCreators';
import * as ModalActionCreators from '~/actions/ModalActionCreators';
import {modal} from '~/actions/ModalActionCreators';
import * as NavigationActionCreators from '~/actions/NavigationActionCreators';
import * as ReadStateActionCreators from '~/actions/ReadStateActionCreators';
import * as SoundActionCreators from '~/actions/SoundActionCreators';
import * as VoiceStateActionCreators from '~/actions/VoiceStateActionCreators';
import {ChannelTypes, JumpTypes, ME} from '~/Constants';
import {AddGuildModal} from '~/components/modals/AddGuildModal';
import {ConfirmModal} from '~/components/modals/ConfirmModal';
import {CreateDMModal} from '~/components/modals/CreateDMModal';
import {UserSettingsModal} from '~/components/modals/UserSettingsModal';
import {Routes} from '~/Routes';
import AccessibilityStore from '~/stores/AccessibilityStore';
import AuthenticationStore from '~/stores/AuthenticationStore';
import CallStateStore from '~/stores/CallStateStore';
import ChannelStore from '~/stores/ChannelStore';
import GuildListStore from '~/stores/GuildListStore';
import GuildStore from '~/stores/GuildStore';
import InboxStore from '~/stores/InboxStore';
import KeybindStore, {type KeybindAction, type KeybindScope, type KeyCombo} from '~/stores/KeybindStore';
import KeyboardModeStore from '~/stores/KeyboardModeStore';
import QuickSwitcherStore from '~/stores/QuickSwitcherStore';
import ReadStateStore from '~/stores/ReadStateStore';
import RecentMentionsStore from '~/stores/RecentMentionsStore';
import SavedMessagesStore from '~/stores/SavedMessagesStore';
import SelectedChannelStore from '~/stores/SelectedChannelStore';
import SelectedGuildStore from '~/stores/SelectedGuildStore';
import MediaEngineStore from '~/stores/voice/MediaEngineFacade';
import {toElectronAccelerator} from '~/utils/KeybindUtils';
import {goToMessage} from '~/utils/MessageNavigator';
import {checkNativePermission} from '~/utils/NativePermissions';
import {getElectronAPI, isNativeMacOS, isNativeWindows} from '~/utils/NativeUtils';
import * as RouterUtils from '~/utils/RouterUtils';
import {jsKeyToUiohookKeycode} from '~/utils/UiohookKeycodes';
import {SoundType} from '~/utils/SoundUtils';
import {ComponentDispatch} from './ComponentDispatch';
import {type KeybindDescriptor, resolveBindingCode, ShortcutMatcher, type ShortcutSource} from './ShortcutMatcher';

type KeybindHandler = (payload: {type: 'press' | 'release'; source: ShortcutSource}) => void;
const SHORTCUT_INVOKE_DEDUPE_MS = 250;

interface ActiveBinding {
	id: string;
	action: KeybindAction;
	combo: KeyCombo;
	allowGlobal: boolean;
	scope?: KeybindScope;
}

const isAltOnlyArrowCombo = (combo: KeyCombo): boolean => {
	if (!combo.alt || combo.ctrlOrMeta || combo.ctrl || combo.meta) return false;
	const code = resolveBindingCode(combo);
	return code === 'ArrowLeft' || code === 'ArrowRight' || code === 'ArrowUp' || code === 'ArrowDown';
};

const computeAllowInEditable = (action: KeybindAction, combo: KeyCombo): boolean => {
	if (action === 'push_to_talk') return true;
	if (combo.global) return true;
	const hasNonShiftModifier = !!(combo.ctrl || combo.ctrlOrMeta || combo.alt || combo.meta);
	if (!hasNonShiftModifier) return false;
	if (isAltOnlyArrowCombo(combo)) return false;
	return true;
};

class KeybindManager {
	private handlers = new Map<KeybindAction, KeybindHandler>();
	private initialized = false;
	private globalShortcutsEnabled = false;
	private suspended = false;
	private disposers: Array<() => void> = [];
	private matcher: ShortcutMatcher | null = null;
	private accessibilityStatus: 'unknown' | 'granted' | 'denied' = 'unknown';
	private pttReleaseTimer: ReturnType<typeof setTimeout> | null = null;
	private globalKeyHookUnsubscribes: Array<() => void> = [];
	private globalShortcutUnsubscribe: (() => void) | null = null;
	private globalShortcutDomUnsubscribe: (() => void) | null = null;
	private globalKeyHookStarted = false;
	private readonly lastGlobalShortcutBridgeEventAt = new Map<string, number>();
	private readonly lastBindingInvokeAt = new Map<string, number>();
	private readonly registeredGlobalBindingIds = new Set<string>();
	private readonly activeGlobalBindings = new Map<string, ActiveBinding>();
	private globalShortcutRefreshRun = 0;

	private get currentChannelId(): string | null {
		return SelectedChannelStore.currentChannelId;
	}

	private get currentGuildId(): string | null {
		return SelectedGuildStore.selectedGuildId;
	}

	private navigateToChannel(guildId: string | null, channelId: string): void {
		const channel = ChannelStore.getChannel(channelId);
		const effectiveGuildId = guildId ?? channel?.guildId ?? null;

		if (channel?.guildId) {
			RouterUtils.transitionTo(Routes.guildChannel(channel.guildId, channelId));
			NavigationActionCreators.selectGuild(channel.guildId);
			NavigationActionCreators.selectChannel(channel.guildId, channelId);
			return;
		}

		if (channel && !channel.guildId) {
			RouterUtils.transitionTo(Routes.dmChannel(channelId));
			NavigationActionCreators.selectChannel(ME, channelId);
			return;
		}

		if (effectiveGuildId) {
			RouterUtils.transitionTo(Routes.guildChannel(effectiveGuildId, channelId));
			NavigationActionCreators.selectGuild(effectiveGuildId);
			NavigationActionCreators.selectChannel(effectiveGuildId, channelId);
		}
	}

	private get activeKeybinds(): Array<ActiveBinding> {
		const result: Array<ActiveBinding> = [];
		for (const entry of KeybindStore.getAll()) {
			entry.combos.forEach((combo, index) => {
				if (!(combo.enabled ?? true)) return;
				result.push({
					id: `${entry.action}:${index}`,
					action: entry.action,
					combo,
					allowGlobal: entry.allowGlobal ?? false,
					scope: entry.scope,
				});
			});
		}
		return result;
	}

	private isScopeActive(scope: KeybindScope | undefined): boolean {
		if (!scope || scope === 'app') return true;
		if (scope === 'call-ringing') return this.getIncomingRingingChannelId() !== null;
		if (scope === 'voice-connected') return MediaEngineStore.connected;
		if (scope === 'chat') return this.currentChannelId !== null;
		return true;
	}

	private get activeGlobalKeybinds(): Array<ActiveBinding> {
		return this.activeKeybinds.filter(
			(k) =>
				k.allowGlobal &&
				(k.combo.global ?? false) &&
				((k.combo.key ?? '') !== '' || (k.combo.code ?? '') !== '' || k.combo.mouseButton !== undefined),
		);
	}

	private getOrderedGuilds(): Array<ReturnType<typeof GuildStore.getGuilds>[number]> {
		if (GuildListStore.guilds.length > 0) {
			return GuildListStore.guilds;
		}
		return GuildStore.getGuilds();
	}

	private getFirstSelectableChannelId(guildId: string): string | undefined {
		const channels = ChannelStore.getGuildChannels(guildId);
		const selectableChannel = channels.find((c) => c.type !== ChannelTypes.GUILD_CATEGORY);
		return selectableChannel?.id;
	}

	private getIncomingRingingChannelId(): string | null {
		const userId = AuthenticationStore.currentUserId;
		if (!userId) return null;
		const call = CallStateStore.getActiveCalls().find(
			(c) =>
				CallStateStore.isUserPendingRinging(c.channelId, userId) &&
				!(MediaEngineStore.connected && MediaEngineStore.channelId === c.channelId),
		);
		return call?.channelId ?? null;
	}

	private markCurrentChannelRead(): void {
		const channelId = this.currentChannelId;
		if (!channelId) return;
		if (ReadStateStore.hasUnread(channelId)) {
			ReadStateActionCreators.ack(channelId, true, true);
		}
	}

	private togglePicker(tab: 'emojis' | 'gifs' | 'stickers' | 'memes'): void {
		const channelId = this.currentChannelId;
		if (!channelId) return;
		ComponentDispatch.dispatch('EXPRESSION_PICKER_TOGGLE', {tab});
	}

	private ensureMatcher(): ShortcutMatcher {
		if (!this.matcher) {
			this.matcher = new ShortcutMatcher({isMac: isNativeMacOS()});
			this.matcher.attach(document.documentElement);
		}
		return this.matcher;
	}

	private async checkInputMonitoringPermission(): Promise<boolean> {
		if (!isNativeMacOS()) return true;
		if (this.accessibilityStatus === 'granted') return true;

		const result = await checkNativePermission('input-monitoring');
		if (result === 'granted') {
			this.accessibilityStatus = 'granted';
			return true;
		}

		if (result === 'denied') {
			this.accessibilityStatus = 'denied';
		} else {
			this.accessibilityStatus = 'unknown';
		}
		return false;
	}

	async init(i18n: I18n) {
		if (this.initialized) return;
		this.initialized = true;

		this.ensureMatcher();

		this.registerDefaultHandlers(i18n);

		this.refreshLocalShortcuts();

		this.disposers.push(
			autorun(() => {
				this.refreshLocalShortcuts();
			}),
		);

		this.disposers.push(
			autorun(() => {
				const keybinds = this.activeGlobalKeybinds;
				void this.refreshGlobalShortcuts(keybinds);
			}),
		);

		// Use reaction (not autorun) so we only re-run when the PTT mode,
		// keybind, or room changes. We must track room so that connecting
		// to a voice channel applies the initial PTT transmission state to
		// the LiveKit tracks.
		this.disposers.push(
			reaction(
				() => ({
					mode: KeybindStore.transmitMode,
					hasKeybind: KeybindStore.hasPushToTalkKeybind(),
					room: MediaEngineStore.room,
				}),
				(data) => {
					console.info('[PTT:reaction] FIRED', {
						mode: data.mode,
						hasKeybind: data.hasKeybind,
						hasRoom: !!data.room,
					});
					MediaEngineStore.handlePushToTalkModeChange();
				},
				{fireImmediately: true},
			),
		);

		await this.refreshGlobalShortcuts(this.activeGlobalKeybinds);
	}

	async reapplyGlobalShortcuts() {
		if (!this.initialized) return;
		await this.refreshGlobalShortcuts(this.activeGlobalKeybinds);
	}

	destroy() {
		if (!this.initialized) return;
		this.initialized = false;

		if (this.pttReleaseTimer) {
			clearTimeout(this.pttReleaseTimer);
			this.pttReleaseTimer = null;
		}

		this.disposers.forEach((dispose) => dispose());
		this.disposers = [];

		const electronApi = getElectronAPI();
		void electronApi?.globalKeyHookUnregisterAll?.().catch(() => {});
		void electronApi?.unregisterAllGlobalShortcuts?.().catch(() => {});

		this.stopGlobalKeyHook();
		this.stopGlobalShortcutBridge();
		this.registeredGlobalBindingIds.clear();
		this.activeGlobalBindings.clear();
		this.lastGlobalShortcutBridgeEventAt.clear();
		this.lastBindingInvokeAt.clear();

		this.handlers.clear();

		this.matcher?.detach();
		this.matcher = null;
	}

	private canUseElectronGlobalShortcut(binding: ActiveBinding): boolean {
		if (binding.action === 'push_to_talk') return false;
		if (binding.combo.mouseButton) return false;
		return toElectronAccelerator(binding.combo) !== null;
	}

	private shouldUseElectronGlobalShortcut(binding: ActiveBinding, hasGlobalKeyHook: boolean): boolean {
		if (!isNativeWindows()) return false;
		if (hasGlobalKeyHook) return false;
		return this.canUseElectronGlobalShortcut(binding);
	}

	private invokeBinding(binding: ActiveBinding, type: 'press' | 'release', source: ShortcutSource): void {
		if (!this.isScopeActive(binding.scope)) return;
		const handler = this.handlers.get(binding.action);
		if (!handler) return;
		const dedupeKey = `${binding.id}:${type}`;
		const now = Date.now();
		const lastInvokeAt = this.lastBindingInvokeAt.get(dedupeKey) ?? 0;
		if (now - lastInvokeAt < SHORTCUT_INVOKE_DEDUPE_MS) return;
		this.lastBindingInvokeAt.set(dedupeKey, now);
		handler({type, source});
	}

	private findGlobalBinding(id: string): ActiveBinding | undefined {
		const exact = this.activeGlobalBindings.get(id);
		if (exact) return exact;

		const action = id.split(':')[0] as KeybindAction;
		return (
			this.activeGlobalBindings.get(`${action}:0`) ??
			[...this.activeGlobalBindings.values()].find((binding) => binding.action === action)
		);
	}

	private invokeGlobalBinding(id: string, type: 'press' | 'release'): void {
		if (this.suspended) return;

		const binding = this.findGlobalBinding(id);
		if (!binding) {
			const action = id.split(':')[0] as KeybindAction;
			const handler = this.handlers.get(action);
			if (handler) {
				handler({type, source: 'global'});
				return;
			}
			console.warn('[PTT:KeybindManager] Global shortcut received for unknown binding', {id});
			return;
		}
		this.invokeBinding(binding, type, 'global');
	}

	private async startGlobalKeyHook(): Promise<boolean> {
		const electronApi = getElectronAPI();
		if (!electronApi?.globalKeyHookStart) return false;

		if (this.globalKeyHookStarted) return true;

		if (!(await this.checkInputMonitoringPermission())) {
			return false;
		}

		const started = await electronApi.globalKeyHookStart();
		if (!started) return false;

		this.globalKeyHookStarted = true;

		const triggeredUnsub = electronApi.onGlobalKeybindTriggered?.((event) => {
			this.invokeGlobalBinding(event.id, event.type === 'keydown' ? 'press' : 'release');
		});
		if (triggeredUnsub) this.globalKeyHookUnsubscribes.push(triggeredUnsub);

		return true;
	}

	private stopGlobalKeyHook(): void {
		const electronApi = getElectronAPI();

		this.globalKeyHookUnsubscribes.forEach((unsub) => unsub());
		this.globalKeyHookUnsubscribes = [];

		if (electronApi?.globalKeyHookStop && this.globalKeyHookStarted) {
			void electronApi.globalKeyHookStop();
		}

		this.globalKeyHookStarted = false;
	}

	private stopGlobalShortcutBridge(): void {
		this.globalShortcutUnsubscribe?.();
		this.globalShortcutUnsubscribe = null;
		this.globalShortcutDomUnsubscribe?.();
		this.globalShortcutDomUnsubscribe = null;
	}

	private startGlobalShortcutBridge(electronApi: NonNullable<ReturnType<typeof getElectronAPI>>): void {
		const handleShortcut = (id: string, _bridge: 'ipc' | 'dom') => {
			const now = Date.now();
			const lastEventAt = this.lastGlobalShortcutBridgeEventAt.get(id) ?? 0;
			if (now - lastEventAt < 100) return;
			this.lastGlobalShortcutBridgeEventAt.set(id, now);
			this.invokeGlobalBinding(id, 'press');
		};

		this.globalShortcutUnsubscribe =
			electronApi.onGlobalShortcut?.((id) => {
				handleShortcut(id, 'ipc');
			}) ?? null;

		const domHandler = (event: Event) => {
			const id = (event as CustomEvent<{id?: string}>).detail?.id;
			if (!id) return;
			handleShortcut(id, 'dom');
		};
		window.addEventListener('floodilka-global-shortcut', domHandler);
		window.addEventListener('floodilka-global-shortcut-main', domHandler);
		this.globalShortcutDomUnsubscribe = () => {
			window.removeEventListener('floodilka-global-shortcut', domHandler);
			window.removeEventListener('floodilka-global-shortcut-main', domHandler);
		};
	}

	suspend(): void {
		this.suspended = true;
		this.matcher?.setBindings([]);
	}

	resume(): void {
		this.suspended = false;
		this.refreshLocalShortcuts();
	}

	register(action: KeybindAction, handler: KeybindHandler) {
		this.handlers.set(action, handler);
	}

	private registerDefaultHandlers(i18n: I18n) {
		this.register('quick_switcher', ({type}) => {
			if (type !== 'press') return;

			if (QuickSwitcherStore.getIsOpen()) QuickSwitcherStore.hide();
			else QuickSwitcherStore.show();
		});

		this.register('toggle_hotkeys', ({type}) => {
			if (type !== 'press') return;
			ModalActionCreators.push(modal(() => React.createElement(UserSettingsModal, {initialTab: 'keybinds'})));
			ComponentDispatch.dispatch('USER_SETTINGS_TAB_SELECT', {tab: 'keybinds'});
		});

		this.register('search', ({type}) => {
			if (type !== 'press') return;
			ComponentDispatch.dispatch('MESSAGE_SEARCH_OPEN');
		});

		this.register('toggle_mute', ({type}) => {
			if (type !== 'press') return;
			const connectedGuildId = MediaEngineStore.guildId;
			const voiceState = MediaEngineStore.getVoiceState(connectedGuildId);
			const isGuildMuted = voiceState?.mute ?? false;

			if (isGuildMuted) {
				ModalActionCreators.push(
					modal(() =>
						React.createElement(ConfirmModal, {
							title: i18n._(msg`Community Muted`),
							description: i18n._(msg`You cannot unmute yourself because you have been muted by a moderator.`),
							primaryText: i18n._(msg`Okay`),
							primaryVariant: 'primary',
							secondaryText: false,
							onPrimary: () => {},
						}),
					),
				);
				return;
			}

			void VoiceStateActionCreators.toggleSelfMute(null);
		});

		this.register('toggle_deafen', ({type}) => {
			if (type !== 'press') return;
			const connectedGuildId = MediaEngineStore.guildId;
			const voiceState = MediaEngineStore.getVoiceState(connectedGuildId);
			const isGuildDeafened = voiceState?.deaf ?? false;

			if (isGuildDeafened) {
				ModalActionCreators.push(
					modal(() =>
						React.createElement(ConfirmModal, {
							title: i18n._(msg`Community Deafened`),
							description: i18n._(msg`You cannot undeafen yourself because you have been deafened by a moderator.`),
							primaryText: i18n._(msg`Okay`),
							primaryVariant: 'primary',
							secondaryText: false,
							onPrimary: () => {},
						}),
					),
				);
				return;
			}

			void VoiceStateActionCreators.toggleSelfDeaf(null);
		});

		this.register('toggle_video', ({type}) => {
			if (type !== 'press') return;
			void MediaEngineStore.toggleCameraFromKeybind();
		});

		this.register('toggle_screen_share', ({type}) => {
			if (type !== 'press') return;
			void MediaEngineStore.toggleScreenShareFromKeybind();
		});

		this.register('toggle_settings', ({type}) => {
			if (type !== 'press') return;
			ModalActionCreators.push(modal(() => React.createElement(UserSettingsModal)));
		});

		this.register('toggle_push_to_talk_mode', ({type}) => {
			if (type !== 'press') return;
			KeybindStore.setTransmitMode(KeybindStore.isPushToTalkEnabled() ? 'voice_activity' : 'push_to_talk');
			MediaEngineStore.handlePushToTalkModeChange();
		});

		this.register('push_to_talk', ({type, source}) => {
			console.info('[PTT:KeybindManager] push_to_talk handler fired', {type, source});
			if (type === 'press') {
				const wasHeld = KeybindStore.pushToTalkHeld;
				if (this.pttReleaseTimer) {
					clearTimeout(this.pttReleaseTimer);
					this.pttReleaseTimer = null;
					console.info('[PTT:KeybindManager] Cancelled pending release timer');
				}
				const shouldUnmute = KeybindStore.handlePushToTalkPress();
				console.info('[PTT:KeybindManager] PRESS → shouldUnmute:', shouldUnmute);
				if (shouldUnmute) {
					if (!wasHeld) SoundActionCreators.playSound(SoundType.PttActive);
					MediaEngineStore.applyPushToTalkHold(true);
				} else if (wasHeld) {
					SoundActionCreators.playSound(SoundType.PttInactive);
				}
			} else {
				const shouldMute = KeybindStore.handlePushToTalkRelease();
				console.info('[PTT:KeybindManager] RELEASE → shouldMute:', shouldMute);
				if (shouldMute) {
					SoundActionCreators.playSound(SoundType.PttInactive);
					const delay = KeybindStore.pushToTalkReleaseDelay;
					console.info('[PTT:KeybindManager] Setting release timer with delay:', delay);
					this.pttReleaseTimer = setTimeout(() => {
						this.pttReleaseTimer = null;
						console.info('[PTT:KeybindManager] Release timer fired → muting');
						MediaEngineStore.applyPushToTalkHold(false);
					}, delay);
				}
			}
		});

		this.register('scroll_chat_up', ({type}) => {
			if (type !== 'press') return;
			ComponentDispatch.dispatch('SCROLL_PAGE_UP');
		});

		this.register('scroll_chat_down', ({type}) => {
			if (type !== 'press') return;
			ComponentDispatch.dispatch('SCROLL_PAGE_DOWN');
		});

		this.register('jump_to_oldest_unread', ({type}) => {
			if (type !== 'press') return;
			const channelId = this.currentChannelId;
			if (!channelId) return;
			const targetId = ReadStateStore.getOldestUnreadMessageId(channelId);
			if (!targetId) return;
			goToMessage(channelId, targetId, {jumpType: JumpTypes.ANIMATED});
		});

		this.register('mark_channel_read', ({type}) => {
			if (type !== 'press') return;
			this.markCurrentChannelRead();
		});

		this.register('toggle_emoji_picker', ({type}) => {
			if (type !== 'press') return;
			this.togglePicker('emojis');
		});

		this.register('toggle_gif_picker', ({type}) => {
			if (type !== 'press') return;
			this.togglePicker('gifs');
		});

		this.register('toggle_sticker_picker', ({type}) => {
			if (type !== 'press') return;
			this.togglePicker('stickers');
		});

		this.register('toggle_memes_picker', ({type}) => {
			if (type !== 'press') return;
			this.togglePicker('memes');
		});

		this.register('answer_incoming_call', ({type}) => {
			if (type !== 'press') return;
			const channelId = this.getIncomingRingingChannelId();
			if (!channelId) return;
			CallActionCreators.joinCall(channelId);
		});

		this.register('decline_incoming_call', ({type}) => {
			if (type !== 'press') return;
			const ringingChannelId = this.getIncomingRingingChannelId();
			if (!ringingChannelId) return;
			CallActionCreators.rejectCall(ringingChannelId);
		});

		this.register('mark_server_read', ({type}) => {
			if (type !== 'press') return;
			const guildId = this.currentGuildId;
			if (!guildId) return;
			const channels = ChannelStore.getGuildChannels(guildId);
			const channelIds = channels
				.filter((channel) => ReadStateStore.hasUnread(channel.id))
				.map((channel) => channel.id);
			if (channelIds.length > 0) {
				void ReadStateActionCreators.bulkAckChannels(channelIds);
			}
		});

		this.register('mark_top_inbox_read', ({type}) => {
			if (type !== 'press') return;

			const inboxTab = InboxStore.selectedTab;

			if (inboxTab === 'bookmarks') {
				const savedMessages = SavedMessagesStore.savedMessages;
				const unreadBookmark = savedMessages.find((message) => {
					return ReadStateStore.hasUnread(message.channelId);
				});

				if (unreadBookmark) {
					ReadStateActionCreators.ack(unreadBookmark.channelId, true, true);
				}
			} else {
				const mentions = RecentMentionsStore.recentMentions;
				const unreadMention = mentions.find((message) => {
					return ReadStateStore.hasUnread(message.channelId);
				});

				if (unreadMention) {
					ReadStateActionCreators.ack(unreadMention.channelId, true, true);
				}
			}
		});

		this.register('navigate_history_back', ({type}) => {
			if (type !== 'press') return;
			const history = RouterUtils.getHistory();
			if (history?.go) history.go(-1);
		});

		this.register('navigate_history_forward', ({type}) => {
			if (type !== 'press') return;
			const history = RouterUtils.getHistory();
			if (history?.go) history.go(1);
		});

		this.register('navigate_to_current_call', ({type}) => {
			if (type !== 'press') return;
			const channelId = MediaEngineStore.channelId;
			const guildId = MediaEngineStore.guildId;
			if (!channelId) return;
			this.navigateToChannel(guildId, channelId);
		});

		this.register('navigate_last_server_or_dm', ({type}) => {
			if (type !== 'press') return;
			const lastGuild = SelectedGuildStore.lastSelectedGuildId;
			const dmChannel = SelectedChannelStore.selectedChannelIds.get(ME);
			if (lastGuild) {
				const channelId = SelectedChannelStore.selectedChannelIds.get(lastGuild);
				if (channelId) {
					this.navigateToChannel(lastGuild, channelId);
					return;
				}
			}
			if (dmChannel) {
				this.navigateToChannel(ME, dmChannel);
			}
		});

		this.register('navigate_channel_next', ({type}) => {
			if (type !== 'press') return;
			const guildId = this.currentGuildId;
			if (!guildId) return;
			const channels = ChannelStore.getGuildChannels(guildId);
			const current = this.currentChannelId;
			if (!channels.length || !current) return;
			const idx = channels.findIndex((c) => c.id === current);
			const next = channels[(idx + 1) % channels.length];
			this.navigateToChannel(guildId, next.id);
		});

		this.register('navigate_channel_previous', ({type}) => {
			if (type !== 'press') return;
			const guildId = this.currentGuildId;
			if (!guildId) return;
			const channels = ChannelStore.getGuildChannels(guildId);
			const current = this.currentChannelId;
			if (!channels.length || !current) return;
			const idx = channels.findIndex((c) => c.id === current);
			const prev = channels[(idx - 1 + channels.length) % channels.length];
			this.navigateToChannel(guildId, prev.id);
		});

		this.register('navigate_server_next', ({type}) => {
			if (type !== 'press') return;
			const guilds = this.getOrderedGuilds();
			if (!guilds.length) return;
			const currentId = this.currentGuildId ?? guilds[0].id;
			const idx = guilds.findIndex((g) => g.id === currentId);
			const safeIdx = idx === -1 ? 0 : idx;
			const next = guilds[(safeIdx + 1) % guilds.length];
			const channelId =
				SelectedChannelStore.selectedChannelIds.get(next.id) ?? this.getFirstSelectableChannelId(next.id);
			if (!channelId) return;
			this.navigateToChannel(next.id, channelId);
		});

		this.register('navigate_server_previous', ({type}) => {
			if (type !== 'press') return;
			const guilds = this.getOrderedGuilds();
			if (!guilds.length) return;
			const currentId = this.currentGuildId ?? guilds[0].id;
			const idx = guilds.findIndex((g) => g.id === currentId);
			const safeIdx = idx === -1 ? 0 : idx;
			const prev = guilds[(safeIdx - 1 + guilds.length) % guilds.length];
			const channelId =
				SelectedChannelStore.selectedChannelIds.get(prev.id) ?? this.getFirstSelectableChannelId(prev.id);
			if (!channelId) return;
			this.navigateToChannel(prev.id, channelId);
		});

		this.register('navigate_unread_channel_next', ({type}) => {
			if (type !== 'press') return;
			const guildId = this.currentGuildId;
			if (!guildId) return;
			const unread = ChannelStore.getGuildChannels(guildId).filter((c) => ReadStateStore.hasUnread(c.id));
			if (!unread.length) return;
			const current = this.currentChannelId;
			const idx = unread.findIndex((c) => c.id === current);
			const next = unread[(idx + 1) % unread.length];
			this.navigateToChannel(guildId, next.id);
		});

		this.register('navigate_unread_channel_previous', ({type}) => {
			if (type !== 'press') return;
			const guildId = this.currentGuildId;
			if (!guildId) return;
			const unread = ChannelStore.getGuildChannels(guildId).filter((c) => ReadStateStore.hasUnread(c.id));
			if (!unread.length) return;
			const current = this.currentChannelId;
			const idx = unread.findIndex((c) => c.id === current);
			const prev = unread[(idx - 1 + unread.length) % unread.length];
			this.navigateToChannel(guildId, prev.id);
		});

		this.register('navigate_unread_mentions_next', ({type}) => {
			if (type !== 'press') return;
			const guildId = this.currentGuildId;
			if (!guildId) return;
			const unread = ChannelStore.getGuildChannels(guildId).filter((c) => ReadStateStore.getMentionCount(c.id) > 0);
			if (!unread.length) return;
			const current = this.currentChannelId;
			const idx = unread.findIndex((c) => c.id === current);
			const next = unread[(idx + 1) % unread.length];
			this.navigateToChannel(guildId, next.id);
		});

		this.register('navigate_unread_mentions_previous', ({type}) => {
			if (type !== 'press') return;
			const guildId = this.currentGuildId;
			if (!guildId) return;
			const unread = ChannelStore.getGuildChannels(guildId).filter((c) => ReadStateStore.getMentionCount(c.id) > 0);
			if (!unread.length) return;
			const current = this.currentChannelId;
			const idx = unread.findIndex((c) => c.id === current);
			const prev = unread[(idx - 1 + unread.length) % unread.length];
			this.navigateToChannel(guildId, prev.id);
		});

		this.register('return_previous_text_channel', ({type}) => {
			if (type !== 'press') return;
			const current = this.currentChannelId;
			const prevVisit = SelectedChannelStore.recentChannelVisits.find((visit) => visit.channelId !== current);
			if (!prevVisit) return;
			this.navigateToChannel(prevVisit.guildId, prevVisit.channelId);
		});

		this.register('return_previous_text_channel_alt', ({type}) => {
			if (type !== 'press') return;
			const visits = SelectedChannelStore.recentChannelVisits;
			if (visits.length < 2) return;
			const target = visits[1];
			this.navigateToChannel(target.guildId, target.channelId);
		});

		this.register('return_connected_audio_channel', ({type}) => {
			if (type !== 'press') return;
			const channelId = MediaEngineStore.channelId;
			if (!channelId) return;
			this.navigateToChannel(MediaEngineStore.guildId, channelId);
		});

		this.register('return_connected_audio_channel_alt', ({type}) => {
			if (type !== 'press') return;
			const channelId = MediaEngineStore.channelId;
			if (!channelId) return;
			this.navigateToChannel(MediaEngineStore.guildId, channelId);
		});

		this.register('start_pm_call', ({type}) => {
			if (type !== 'press') return;
			const channelId = this.currentChannelId;
			if (!channelId) return;
			const channel = ChannelStore.getChannel(channelId);
			if (!channel || channel.guildId) return;
			CallActionCreators.startCall(channelId);
		});

		this.register('toggle_pins_popout', ({type}) => {
			if (type !== 'press') return;
			ComponentDispatch.dispatch('CHANNEL_PINS_OPEN');
		});

		this.register('toggle_mentions_popout', ({type}) => {
			if (type !== 'press') return;
			ComponentDispatch.dispatch('INBOX_OPEN');
		});

		this.register('toggle_channel_member_list', ({type}) => {
			if (type !== 'press') return;
			ComponentDispatch.dispatch('CHANNEL_MEMBER_LIST_TOGGLE');
		});

		this.register('create_or_join_server', ({type}) => {
			if (type !== 'press') return;
			ModalActionCreators.push(modal(() => React.createElement(AddGuildModal)));
		});

		this.register('create_private_group', ({type}) => {
			if (type !== 'press') return;
			ModalActionCreators.push(modal(() => React.createElement(CreateDMModal)));
		});

		this.register('focus_text_area', ({type}) => {
			if (type !== 'press') return;
			if (KeyboardModeStore.keyboardModeEnabled) return;
			const channelId = this.currentChannelId;
			if (!channelId) return;
			ComponentDispatch.dispatch('FOCUS_TEXTAREA', {channelId});
		});

		this.register('upload_file', ({type}) => {
			if (type !== 'press') return;
			const channelId = this.currentChannelId;
			if (!channelId) return;
			ComponentDispatch.dispatch('TEXTAREA_UPLOAD_FILE', {channelId});
		});

		this.register('zoom_in', ({type}) => {
			if (type !== 'press') return;
			void AccessibilityStore.adjustZoom(0.1);
		});

		this.register('zoom_out', ({type}) => {
			if (type !== 'press') return;
			void AccessibilityStore.adjustZoom(-0.1);
		});

		this.register('zoom_reset', ({type}) => {
			if (type !== 'press') return;
			AccessibilityStore.updateSettings({zoomLevel: 1.0});
		});
	}

	private async refreshGlobalShortcuts(keybinds = this.activeGlobalKeybinds) {
		const refreshRun = ++this.globalShortcutRefreshRun;
		const isCurrentRefresh = () => refreshRun === this.globalShortcutRefreshRun;
		const electronApi = getElectronAPI();
		const hasGlobalKeyHook = !!electronApi?.globalKeyHookStart;
		const hasGlobalShortcut = !!electronApi?.registerGlobalShortcut;
		if (!hasGlobalKeyHook && !hasGlobalShortcut) {
			console.info('[PTT:refreshGlobal] No global shortcut backend available');
			return;
		}

		this.registeredGlobalBindingIds.clear();
		this.activeGlobalBindings.clear();
		this.lastGlobalShortcutBridgeEventAt.clear();
		this.lastBindingInvokeAt.clear();
		this.stopGlobalShortcutBridge();

		try {
			await electronApi.globalKeyHookUnregisterAll?.();
		} catch (error) {
			console.error('Failed to unregister global keybinds', error);
		}
		if (!isCurrentRefresh()) return;

		try {
			await electronApi.unregisterAllGlobalShortcuts?.();
		} catch (error) {
			console.error('Failed to unregister global shortcuts', error);
		}
		if (!isCurrentRefresh()) return;

		console.info(
			'[PTT:refreshGlobal] Active global keybinds:',
			keybinds.map((k) => ({
				action: k.action,
				id: k.id,
				key: k.combo.key,
				code: k.combo.code,
				global: k.combo.global,
				enabled: k.combo.enabled,
			})),
		);

		if (!keybinds.length) {
			console.info('[PTT:refreshGlobal] No global keybinds -> stopping hook');
			this.globalShortcutsEnabled = false;
			this.stopGlobalKeyHook();
			return;
		}

		const shortcutBindings: Array<ActiveBinding> = [];
		const hookBindings: Array<ActiveBinding> = [];

		for (const binding of keybinds) {
			if (this.shouldUseElectronGlobalShortcut(binding, hasGlobalKeyHook)) {
				shortcutBindings.push(binding);
			} else {
				hookBindings.push(binding);
			}
		}

		if (shortcutBindings.length > 0) {
			this.startGlobalShortcutBridge(electronApi);
			hookBindings.push(...shortcutBindings);
		}

		for (const binding of shortcutBindings) {
			const accelerator = toElectronAccelerator(binding.combo);
			if (!accelerator) {
				hookBindings.push(binding);
				continue;
			}

			try {
				const success = await electronApi.registerGlobalShortcut?.(accelerator, binding.id);
				if (!isCurrentRefresh()) return;
				if (success) {
					this.registeredGlobalBindingIds.add(binding.id);
					this.activeGlobalBindings.set(binding.id, binding);
					continue;
				}
				console.warn('[PTT:refreshGlobal] Electron global shortcut registration returned false', {
					id: binding.id,
					action: binding.action,
					accelerator,
				});
			} catch (error) {
				console.error(`Failed to register Electron global shortcut ${binding.id}`, error);
			}
		}

		if (hookBindings.length === 0) {
			this.stopGlobalKeyHook();
			this.globalShortcutsEnabled = this.registeredGlobalBindingIds.size > 0;
			console.info('[PTT:refreshGlobal] Done, globalShortcutsEnabled =', this.globalShortcutsEnabled);
			return;
		}

		if (!(await this.checkInputMonitoringPermission())) {
			if (!isCurrentRefresh()) return;
			console.warn('[PTT:refreshGlobal] Input monitoring permission denied');
			this.stopGlobalKeyHook();
			this.globalShortcutsEnabled = this.registeredGlobalBindingIds.size > 0;
			return;
		}

		const started = await this.startGlobalKeyHook();
		if (!isCurrentRefresh()) return;
		if (!started) {
			console.warn('[PTT:refreshGlobal] Failed to start global key hook');
			this.stopGlobalKeyHook();
			this.globalShortcutsEnabled = this.registeredGlobalBindingIds.size > 0;
			return;
		}

		const isMac = isNativeMacOS();

		for (const keybind of hookBindings) {
			const mouseButton = keybind.combo.mouseButton;
			const keycode = mouseButton
				? null
				: (jsKeyToUiohookKeycode(keybind.combo.code) ?? jsKeyToUiohookKeycode(keybind.combo.key));
			if (!mouseButton && keycode === null) {
				console.warn('[PTT:refreshGlobal] SKIP: no keycode/mouseButton for', keybind);
				continue;
			}

			try {
				await electronApi.globalKeyHookRegister?.({
					id: keybind.id,
					keycode: keycode ?? 0,
					mouseButton,
					ctrl: !!(keybind.combo.ctrl || (!isMac && keybind.combo.ctrlOrMeta)),
					alt: !!keybind.combo.alt,
					shift: !!keybind.combo.shift,
					meta: !!(keybind.combo.meta || (isMac && keybind.combo.ctrlOrMeta)),
				});
				if (!isCurrentRefresh()) return;
				this.registeredGlobalBindingIds.add(keybind.id);
				this.activeGlobalBindings.set(keybind.id, keybind);
			} catch (error) {
				console.error(`Failed to register global keybind ${keybind.action}`, error);
			}
		}

		this.globalShortcutsEnabled = this.registeredGlobalBindingIds.size > 0;
		console.info('[PTT:refreshGlobal] Done, globalShortcutsEnabled =', this.globalShortcutsEnabled);
	}

	private refreshLocalShortcuts() {
		if (!this.matcher || this.suspended) return;

		const descriptors: Array<KeybindDescriptor<KeybindAction>> = [];
		for (const entry of this.activeKeybinds) {
			const descriptor = this.buildDescriptor(entry);
			if (descriptor) descriptors.push(descriptor);
		}

		this.matcher.setBindings(descriptors);
	}

	private buildDescriptor(entry: ActiveBinding): KeybindDescriptor<KeybindAction> | null {
		if (!this.handlers.has(entry.action)) return null;

		const {action, combo, scope} = entry;
		const isPtt = action === 'push_to_talk';

		return {
			action,
			combo,
			allowInEditable: computeAllowInEditable(action, combo),
			preventDefault: !isPtt,
			isActive: scope ? () => this.isScopeActive(scope) : undefined,
			onPress: (source) => this.invokeBinding(entry, 'press', source),
			onRelease: (source) => this.invokeBinding(entry, 'release', source),
		};
	}
}

export default new KeybindManager();
