/*
 * Copyright (C) 2020-2026 Fluxer Contributors
 * Copyright (C) 2026 Floodilka Contributors
 *
 * This file is part of Floodilka, a fork of Fluxer
 * (https://github.com/fluxerapp/fluxer).
 * Modified by Floodilka Contributors starting March 2026.
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

import {defineConfig} from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
	site: process.env.DOCS_SITE ?? 'https://docs.floodilka.com',
	srcDir: './src',
	redirects: {
		'/': '/quickstart/',
		'/en': '/en/quickstart/',
	},
	integrations: [
		starlight({
			title: {
				ru: 'Флудилка · Боты',
				en: 'Floodilka · Bots',
			},
			description: 'Документация для разработчиков ботов Флудилки.',
			defaultLocale: 'root',
			locales: {
				root: {label: 'Русский', lang: 'ru'},
				en: {label: 'English', lang: 'en'},
			},
			logo: {
				src: './src/assets/logo.png',
				replacesTitle: false,
			},
			favicon: '/favicon.ico',
			customCss: ['./src/styles/custom.css'],
			head: [
				{
					tag: 'meta',
					attrs: {property: 'og:image', content: 'https://docs.floodilka.com/og.png'},
				},
			],
			social: [],
			sidebar: [
				{
					label: 'Начало работы',
					translations: {en: 'Getting Started'},
					items: [
						{label: 'Быстрый старт', translations: {en: 'Quickstart'}, slug: 'quickstart'},
						{label: 'Аутентификация', translations: {en: 'Authentication'}, slug: 'introduction/authentication'},
						{label: 'Приглашение бота', translations: {en: 'Inviting Your Bot'}, slug: 'topics/oauth2'},
					],
				},
				{
					label: 'Разработка бота',
					translations: {en: 'Building a Bot'},
					items: [
						{label: 'Обзор', translations: {en: 'Overview'}, slug: 'topics/bots'},
						{label: 'Команды', translations: {en: 'Commands'}, slug: 'building/commands'},
						{label: 'Работа с событиями', translations: {en: 'Events'}, slug: 'building/events'},
						{label: 'Хранение состояния', translations: {en: 'State & Storage'}, slug: 'building/state'},
						{label: 'Права доступа', translations: {en: 'Permissions'}, slug: 'topics/permissions'},
						{label: 'Лимиты запросов', translations: {en: 'Rate Limits'}, slug: 'topics/rate-limits'},
						{label: 'Коды ошибок', translations: {en: 'Error Codes'}, slug: 'topics/error-codes'},
						{label: 'Snowflake-идентификаторы', translations: {en: 'Snowflakes'}, slug: 'topics/snowflakes'},
						{label: 'Журнал аудита', translations: {en: 'Audit Log'}, slug: 'topics/audit-log'},
					],
				},
				{
					label: 'Gateway',
					items: [
						{label: 'Обзор', translations: {en: 'Overview'}, slug: 'gateway/overview'},
						{label: 'Жизненный цикл соединения', translations: {en: 'Connection Lifecycle'}, slug: 'gateway/connection-lifecycle'},
						{label: 'Опкоды', translations: {en: 'Opcodes'}, slug: 'gateway/opcodes'},
						{label: 'Коды закрытия', translations: {en: 'Close Codes'}, slug: 'gateway/close-codes'},
						{label: 'События', translations: {en: 'Events'}, slug: 'gateway/events'},
					],
				},
				{
					label: 'REST-справочник',
					translations: {en: 'REST Reference'},
					items: [
						{label: 'Обзор', translations: {en: 'Overview'}, slug: 'resources/overview'},
						{label: 'Пользователи', translations: {en: 'Users'}, slug: 'resources/users'},
						{label: 'Гильдии', translations: {en: 'Guilds'}, slug: 'resources/guilds'},
						{label: 'Каналы', translations: {en: 'Channels'}, slug: 'resources/channels'},
						{label: 'Сообщения', translations: {en: 'Messages'}, slug: 'resources/messages'},
						{label: 'Gateway-эндпоинт', translations: {en: 'Gateway Endpoint'}, slug: 'resources/gateway'},
						{label: 'Приложения и OAuth2', translations: {en: 'Applications & OAuth2'}, slug: 'resources/oauth2'},
					],
				},
				{
					label: 'Деплой',
					translations: {en: 'Deployment'},
					items: [
						{label: 'Хостинг', translations: {en: 'Hosting'}, slug: 'deployment/hosting'},
						{label: 'Мониторинг', translations: {en: 'Monitoring'}, slug: 'deployment/monitoring'},
					],
				},
				{
					label: 'Примеры',
					translations: {en: 'Examples'},
					items: [
						{label: 'Echo-бот', translations: {en: 'Echo Bot'}, slug: 'examples/echo'},
						{label: 'Уровневый бот', translations: {en: 'Leveling Bot'}, slug: 'examples/leveling'},
					],
				},
			],
			components: {},
		}),
	],
});
