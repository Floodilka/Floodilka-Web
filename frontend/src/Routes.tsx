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

import {siteUrl} from '~/utils/UrlUtils';

export const Routes = {
	HOME: '/',
	DOWNLOAD: '/download',
	LOGIN: '/login',
	REGISTER: '/register',
	FORGOT_PASSWORD: '/forgot',
	RESET_PASSWORD: '/reset',
	VERIFY_EMAIL: '/verify',

	EMAIL_REVERT: '/wasntme',
	OAUTH_AUTHORIZE: '/oauth2/authorize',

	INVITE_REGISTER: '/invite/:code',
	INVITE_LOGIN: '/invite/:code/login',
	GIFT_REGISTER: '/gift/:code',
	GIFT_LOGIN: '/gift/:code/login',
	ME: '/channels/@me',

	BOOKMARKS: '/bookmarks',
	MENTIONS: '/mentions',
	NOTIFICATIONS: '/notifications',
	YOU: '/you',
	REPORT: '/report',

	terms: () => siteUrl('terms'),
	privacy: () => siteUrl('privacy'),
	guidelines: () => siteUrl('guidelines'),
	careers: () => siteUrl('careers'),
	partners: () => siteUrl('partners'),
	bugs: () => siteUrl('bugs'),
	premium: () => siteUrl('premium'),
	dmChannel: (channelId: string) => `/channels/@me/${channelId}`,

	guildChannel: (guildId: string, channelId?: string) =>
		channelId ? `/channels/${guildId}/${channelId}` : `/channels/${guildId}`,
	channelMessage: (guildId: string, channelId: string, messageId: string) =>
		`${Routes.guildChannel(guildId, channelId)}/${messageId}`,
	dmChannelMessage: (channelId: string, messageId: string) => `${Routes.dmChannel(channelId)}/${messageId}`,

	inviteRegister: (code: string) => `/invite/${code}`,
	inviteLogin: (code: string) => `/invite/${code}/login`,
	giftRegister: (code: string) => `/gift/${code}`,
	giftLogin: (code: string) => `/gift/${code}/login`,
	isSpecialPage: (pathname: string) =>
		pathname === Routes.BOOKMARKS ||
		pathname === Routes.MENTIONS ||
		pathname === Routes.NOTIFICATIONS ||
		pathname === Routes.YOU,

	isDMRoute: (pathname: string) => pathname.startsWith('/channels/@me'),

	isChannelRoute: (pathname: string) => pathname.startsWith('/channels/'),
	isGuildChannelRoute: (pathname: string) =>
		pathname.startsWith('/channels/') &&
		!pathname.startsWith('/channels/@me'),
} as const;
