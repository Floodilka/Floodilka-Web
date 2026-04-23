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
				ru: 'Флудилка',
				en: 'Floodilka',
			},
			description: 'Документация для разработчиков: Floodilka API, Gateway, OAuth2.',
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
			sidebar: [
				{
					label: 'Начало работы',
					translations: {en: 'Getting Started'},
					items: [
						{label: 'Быстрый старт', translations: {en: 'Quickstart'}, slug: 'quickstart'},
						{label: 'Аутентификация', translations: {en: 'Authentication'}, slug: 'introduction/authentication'},
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
					label: 'Темы',
					translations: {en: 'Topics'},
					items: [
						{label: 'OAuth2', slug: 'topics/oauth2'},
						{label: 'Боты', translations: {en: 'Bots'}, slug: 'topics/bots'},
						{label: 'Snowflake-идентификаторы', translations: {en: 'Snowflakes'}, slug: 'topics/snowflakes'},
						{label: 'Права доступа', translations: {en: 'Permissions'}, slug: 'topics/permissions'},
						{label: 'Лимиты запросов', translations: {en: 'Rate Limits'}, slug: 'topics/rate-limits'},
						{label: 'Коды ошибок', translations: {en: 'Error Codes'}, slug: 'topics/error-codes'},
						{label: 'Журнал аудита', translations: {en: 'Audit Log'}, slug: 'topics/audit-log'},
						{label: 'Голосовая связь', translations: {en: 'Voice'}, slug: 'topics/voice'},
					],
				},
				{
					label: 'Ресурсы',
					translations: {en: 'Resources'},
					items: [
						{label: 'Обзор', translations: {en: 'Overview'}, slug: 'resources/overview'},
						{label: 'Пользователи', translations: {en: 'Users'}, slug: 'resources/users'},
						{label: 'Гильдии', translations: {en: 'Guilds'}, slug: 'resources/guilds'},
						{label: 'Каналы', translations: {en: 'Channels'}, slug: 'resources/channels'},
						{label: 'Сообщения', translations: {en: 'Messages'}, slug: 'resources/messages'},
						{label: 'OAuth2', slug: 'resources/oauth2'},
						{label: 'Приглашения', translations: {en: 'Invites'}, slug: 'resources/invites'},
						{label: 'Вебхуки', translations: {en: 'Webhooks'}, slug: 'resources/webhooks'},
						{label: 'Gateway', slug: 'resources/gateway'},
					],
				},
			],
			components: {},
		}),
	],
});
