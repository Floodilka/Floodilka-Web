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

import emojiRegex from 'emoji-regex';
import {
	AVATAR_MAX_SIZE,
	Locales,
	MAX_GUILDS_PREMIUM,
	StatusTypes,
	ThemeTypes,
	UserNotificationSettings,
} from '~/Constants';
import type {MessageResponse} from '~/channel/ChannelModel';
import {
	ColorType,
	createBase64StringType,
	createStringType,
	DateTimeType,
	EmailType,
	GlobalNameType,
	Int32Type,
	Int64Type,
	PasswordType,
	SignedInt32Type,
	UsernameType,
	z,
} from '~/Schema';

export const UserPartialResponse = z.object({
	id: z.string(),
	username: z.string(),
	global_name: z.string().nullish(),
	avatar: z.string().nullish(),
	avatar_color: z.number().int().nullish(),
	bot: z.boolean().optional(),
	system: z.boolean().optional(),
	flags: z.number().int(),
	premium_type: z.number().int().optional(),
});

export type UserPartialResponse = z.infer<typeof UserPartialResponse>;

export const UserPrivateResponse = z.object({
	...UserPartialResponse.shape,
	banner: z.string().nullish(),
	banner_color: z.number().int().nullish(),
	acls: z.array(z.string()),
	email: z.string().nullish(),
	phone: z.string().nullish(),
	bio: z.string().nullish(),
	mfa_enabled: z.boolean(),
	authenticator_types: z.array(z.number().int()).optional(),
	verified: z.boolean(),
	premium_type: z.number().int().nullish(),
	premium_since: z.iso.datetime().nullish(),
	premium_until: z.iso.datetime().nullish(),
	premium_will_cancel: z.boolean(),
	premium_billing_cycle: z.string().nullish(),
	premium_badge_hidden: z.boolean(),
	premium_badge_masked: z.boolean(),
	premium_badge_timestamp_hidden: z.boolean(),
	premium_badge_sequence_hidden: z.boolean(),
	premium_purchase_disabled: z.boolean(),
	premium_enabled_override: z.boolean(),
	password_last_changed_at: z.iso.datetime().nullish(),
	required_actions: z.array(z.string()).nullable(),
	nsfw_allowed: z.boolean(),
	has_dismissed_premium_onboarding: z.boolean(),
	has_ever_purchased: z.boolean(),
	has_unread_gift_inventory: z.boolean(),
	unread_gift_inventory_count: z.number().int(),
	used_mobile_client: z.boolean(),
	pending_bulk_message_deletion: z
		.object({
			scheduled_at: z.iso.datetime(),
			channel_count: z.number().int(),
			message_count: z.number().int(),
		})
		.nullable(),
});

export type UserPrivateResponse = z.infer<typeof UserPrivateResponse>;

export const UserProfileResponse = z.object({
	bio: z.string().nullish(),
	banner: z.string().nullish(),
	banner_color: z.number().int().nullish(),
});

export type UserProfileResponse = z.infer<typeof UserProfileResponse>;

export const UserUpdateRequest = z
	.object({
		username: UsernameType,
		global_name: GlobalNameType.nullish(),
		email: EmailType,
		new_password: PasswordType,
		password: z.string().min(1).max(256),
		avatar: createBase64StringType(1, AVATAR_MAX_SIZE * 1.33).nullish(),
		banner: createBase64StringType(1, AVATAR_MAX_SIZE * 1.33).nullish(),
		bio: createStringType(1, 320).nullish(),
		premium_badge_hidden: z.boolean(),
		premium_badge_masked: z.boolean(),
		premium_badge_timestamp_hidden: z.boolean(),
		premium_badge_sequence_hidden: z.boolean(),
		premium_enabled_override: z.boolean(),
		has_dismissed_premium_onboarding: z.boolean(),
		has_unread_gift_inventory: z.boolean(),
		used_mobile_client: z.boolean(),
	})
	.partial();

export type UserUpdateRequest = z.infer<typeof UserUpdateRequest>;

export type SavedMessageStatus = 'available' | 'missing_permissions';

export interface SavedMessageEntryResponse {
	id: string;
	channel_id: string;
	message_id: string;
	status: SavedMessageStatus;
	message: MessageResponse | null;
}

const GuildFolderResponse = z.object({
	id: z.number().int().nullish(),
	name: z.string().nullish(),
	color: z.number().int().nullish(),
	flags: z.number().int().default(0),
	icon: z.string().default('folder'),
	guild_ids: z.array(z.string()),
});

export const CustomStatusResponse = z.object({
	text: z.string().nullish(),
	expires_at: z.iso.datetime().nullish(),
	emoji_id: z.string().nullish(),
	emoji_name: z.string().nullish(),
	emoji_animated: z.boolean(),
});

export type CustomStatusResponse = z.infer<typeof CustomStatusResponse>;

const isUnicodeEmoji = (value: string): boolean => {
	const regex = emojiRegex();
	const match = value.match(regex);
	return Boolean(match && match[0] === value);
};

export const CustomStatusPayload = z
	.object({
		text: createStringType(1, 128).nullish(),
		expires_at: DateTimeType.nullish(),
		emoji_id: Int64Type.nullish(),
		emoji_name: createStringType(1, 32).nullish(),
	})
	.transform((value) => {
		if (value.emoji_id != null) {
			return {...value, emoji_name: undefined};
		}
		return value;
	})
	.refine((value) => value.emoji_name == null || isUnicodeEmoji(value.emoji_name), {
		message: 'Emoji name must be a valid Unicode emoji',
		path: ['emoji_name'],
	});

export const UserSettingsResponse = z.object({
	status: z.string(),
	status_resets_at: z.iso.datetime().nullish(),
	status_resets_to: z.string().nullish(),
	theme: z.string(),
	guild_positions: z.array(z.string()),
	locale: z.string(),
	restricted_guilds: z.array(z.string()),
	default_guilds_restricted: z.boolean(),
	inline_attachment_media: z.boolean(),
	inline_embed_media: z.boolean(),
	gif_auto_play: z.boolean(),
	render_embeds: z.boolean(),
	render_reactions: z.boolean(),
	animate_emoji: z.boolean(),
	animate_stickers: z.number().int(),
	render_spoilers: z.number().int(),
	message_display_compact: z.boolean(),
	friend_source_flags: z.number().int(),
	incoming_call_flags: z.number().int(),
	group_dm_add_permission_flags: z.number().int(),
	guild_folders: z.array(GuildFolderResponse),
	custom_status: CustomStatusResponse.nullish(),
	afk_timeout: z.number().int(),
	time_format: z.number().int(),
	developer_mode: z.boolean(),
});

export type UserSettingsResponse = z.infer<typeof UserSettingsResponse>;

export const UserSettingsUpdateRequest = z
	.object({
		flags: z.number().int(),
		status: z.enum(Object.values(StatusTypes)),
		status_resets_at: DateTimeType.nullish(),
		status_resets_to: z.enum(Object.values(StatusTypes)).nullish(),
		theme: z.enum(Object.values(ThemeTypes)),
		guild_positions: z
			.array(Int64Type)
			.transform((ids) => [...new Set(ids)])
			.refine((ids) => ids.length <= MAX_GUILDS_PREMIUM, `Maximum ${MAX_GUILDS_PREMIUM} guilds allowed`),
		locale: z.enum(Object.values(Locales)),
		restricted_guilds: z
			.array(Int64Type)
			.transform((ids) => [...new Set(ids)])
			.refine((ids) => ids.length <= MAX_GUILDS_PREMIUM, `Maximum ${MAX_GUILDS_PREMIUM} guilds allowed`),
		default_guilds_restricted: z.boolean(),
		inline_attachment_media: z.boolean(),
		inline_embed_media: z.boolean(),
		gif_auto_play: z.boolean(),
		render_embeds: z.boolean(),
		render_reactions: z.boolean(),
		animate_emoji: z.boolean(),
		animate_stickers: z.number().int().min(0).max(2),
		render_spoilers: z.number().int().min(0).max(2),
		message_display_compact: z.boolean(),
		friend_source_flags: Int32Type,
		incoming_call_flags: Int32Type,
		group_dm_add_permission_flags: Int32Type,
		guild_folders: z
			.array(
				z.object({
					id: SignedInt32Type,
					name: createStringType(0, 100).nullish(),
					color: ColorType.nullish().default(0x000000),
					flags: z.number().int().min(0).default(0),
					icon: z
						.enum(['folder', 'star', 'heart', 'bookmark', 'game_controller', 'shield', 'music_note'])
						.default('folder'),
					guild_ids: z
						.array(Int64Type)
						.transform((ids) => [...new Set(ids)])
						.refine((ids) => ids.length <= MAX_GUILDS_PREMIUM, `Maximum ${MAX_GUILDS_PREMIUM} guilds allowed`),
				}),
			)
			.max(200)
			.default([]),
		custom_status: CustomStatusPayload.nullish(),
		afk_timeout: z.number().int().min(60).max(600),
		time_format: z.number().int().min(0).max(2),
		developer_mode: z.boolean(),
	})
	.partial();

export type UserSettingsUpdateRequest = z.infer<typeof UserSettingsUpdateRequest>;

export const RelationshipResponse = z.object({
	id: z.string(),
	type: z.number().int(),
	user: UserPartialResponse,
	since: z.iso.datetime().optional(),
	nickname: z.string().nullish(),
});

export type RelationshipResponse = z.infer<typeof RelationshipResponse>;

export const RelationshipNicknameUpdateRequest = z.object({
	nickname: createStringType(1, 32)
		.nullish()
		.transform((value) => (value == null ? null : value.trim() || null))
		.optional(),
});

export type RelationshipNicknameUpdateRequest = z.infer<typeof RelationshipNicknameUpdateRequest>;

export const CreatePrivateChannelRequest = z
	.object({
		recipient_id: Int64Type.optional(),
		recipients: z.array(Int64Type).max(9).optional(),
	})
	.refine((data) => (data.recipient_id && !data.recipients) || (!data.recipient_id && data.recipients), {
		message: 'Either recipient_id or recipients must be provided, but not both',
	});

export type CreatePrivateChannelRequest = z.infer<typeof CreatePrivateChannelRequest>;

export const FriendRequestByUsernameRequest = z.object({
	username: UsernameType,
});

export type FriendRequestByUsernameRequest = z.infer<typeof FriendRequestByUsernameRequest>;

const MessageNotificationsType = z.union([
	z.literal(UserNotificationSettings.ALL_MESSAGES),
	z.literal(UserNotificationSettings.ONLY_MENTIONS),
	z.literal(UserNotificationSettings.NO_MESSAGES),
	z.literal(UserNotificationSettings.INHERIT),
]);

const MuteConfigType = z
	.object({
		end_time: z.coerce.date().nullish(),
		selected_time_window: z.number().int(),
	})
	.nullish();

const MuteConfigResponseType = z
	.object({
		end_time: z.iso.datetime().nullish(),
		selected_time_window: z.number().int(),
	})
	.nullish();

const ChannelOverrideType = z.object({
	collapsed: z.boolean(),
	message_notifications: MessageNotificationsType,
	muted: z.boolean(),
	mute_config: MuteConfigType,
});

const ChannelOverrideResponseType = z.object({
	collapsed: z.boolean(),
	message_notifications: z.number().int(),
	muted: z.boolean(),
	mute_config: MuteConfigResponseType,
});

export const UserGuildSettingsUpdateRequest = z
	.object({
		message_notifications: MessageNotificationsType,
		muted: z.boolean(),
		mute_config: MuteConfigType,
		mobile_push: z.boolean(),
		suppress_everyone: z.boolean(),
		suppress_roles: z.boolean(),
		hide_muted_channels: z.boolean(),
		channel_overrides: z
			.record(
				Int64Type.transform((val) => val.toString()),
				ChannelOverrideType,
			)
			.nullish(),
	})
	.partial();

export type UserGuildSettingsUpdateRequest = z.infer<typeof UserGuildSettingsUpdateRequest>;

export const UserGuildSettingsResponse = z.object({
	guild_id: z.string().nullish(),
	message_notifications: z.number().int(),
	muted: z.boolean(),
	mute_config: MuteConfigResponseType,
	mobile_push: z.boolean(),
	suppress_everyone: z.boolean(),
	suppress_roles: z.boolean(),
	hide_muted_channels: z.boolean(),
	channel_overrides: z.record(z.string(), ChannelOverrideResponseType).nullish(),
	version: z.number().int(),
});

export type UserGuildSettingsResponse = z.infer<typeof UserGuildSettingsResponse>;
