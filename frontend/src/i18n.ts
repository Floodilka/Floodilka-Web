/*
 * Copyright (C) 2026 Fluxer Contributors
 *
 * This file is part of Fluxer.
 *
 * Fluxer is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Fluxer is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Fluxer. If not, see <https://www.gnu.org/licenses/>.
 */

import {i18n, type Messages} from '@lingui/core';
import AppStorage from '~/lib/AppStorage';

import {messages as messagesEnUS} from '~/locales/en-US/messages.mjs';
import {messages as messagesRu} from '~/locales/ru/messages.mjs';

const supportedLocales = ['en-US', 'ru'] as const;

type LocaleCode = (typeof supportedLocales)[number];
const DEFAULT_LOCALE: LocaleCode = 'ru';

type LocaleLoader = () => {messages: Messages};

const loaders: Record<LocaleCode, LocaleLoader> = {
	'en-US': () => ({messages: messagesEnUS}),
	ru: () => ({messages: messagesRu}),
};

function detectPreferredLocale(): LocaleCode {
	return DEFAULT_LOCALE;
}

export function loadLocaleCatalog(localeCode: string): LocaleCode {
	const normalized: LocaleCode = localeCode === 'en-US' ? 'en-US' : 'ru';
	const {messages} = loaders[normalized]();
	i18n.loadAndActivate({locale: normalized, messages});
	AppStorage.setItem('locale', normalized);
	return normalized;
}

let initPromise: Promise<typeof i18n> | null = null;

export async function initI18n(forceLocale?: string) {
	if (!initPromise) {
		initPromise = (async () => {
			try {
				const localeToLoad = forceLocale === 'en-US' ? 'en-US' : detectPreferredLocale();
				loadLocaleCatalog(localeToLoad);
			} catch (error) {
				console.error('Failed to initialize i18n, falling back to default locale', error);
				loadLocaleCatalog(DEFAULT_LOCALE);
			}

			return i18n;
		})();
	}

	return initPromise;
}

export default i18n;
