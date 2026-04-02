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

import {sources} from '@rspack/core';

const SITE_URL = 'https://floodilka.com';
const OG_IMAGE = `${SITE_URL}/icons/og-image-default.png`;

/**
 * Build-time prerender for public pages.
 *
 * Generates static HTML files that Caddy serves to search engine crawlers.
 * Each file has route-specific <title>, meta tags, Open Graph, JSON-LD,
 * and full semantic HTML body — so Yandex/Google index real content
 * even though the main app is a client-side SPA.
 */

// ── Page definitions ──────────────────────────────────────────────

const PAGES = [
	{
		path: 'index',
		title: 'Флудилка — голосовой чат для геймеров | Альтернатива Discord в России',
		description:
			'Флудилка — бесплатный голосовой мессенджер для геймеров. Аналог Discord, который работает в России без VPN. Голосовые каналы, стримы, серверы — всё бесплатно.',
		keywords:
			'аналог дискорда, замена дискорда, альтернатива дискорду, голосовой чат для игр, голосовой мессенджер, бесплатный голосовой чат, дискорд аналог, чем заменить дискорд, голосовой чат без впн, дискорд заблокирован, мессенджер для геймеров, discord альтернатива, войс чат, голосовой чат россия, флудилка',
		canonical: '/',
		body: `
<h1>Флудилка — голосовой чат для геймеров</h1>
<p>Флудилка — это бесплатный голосовой мессенджер для геймеров, которые ценят скорость, надёжность и свободу. Лучшая альтернатива Discord в России — работает без VPN.</p>

<nav>
<a href="/download">Скачать</a> | <a href="/faq">FAQ</a> | <a href="/support">Поддержка</a>
</nav>

<section>
<h2>Есть все для комфортной игры</h2>
<h3>Прямые эфиры</h3>
<p>Ты можешь с легкостью присоединиться к прямому эфиру с любого устройства или провести его сам для своих друзей или коммьюнити.</p>
<h3>Голосовые и текстовые комнаты</h3>
<p>Мгновенно переключайся между текстовыми и голосовыми комнатами, не нужно планировать встречи — просто заходи и общайся.</p>
<h3>Серверы</h3>
<p>Создавай серверы для разных целей — игр, учебы или просто общения с друзьями.</p>
</section>

<section>
<h2>Именно за это нас и выбирают</h2>
<ul>
<li><strong>Качество связи</strong> — без лагов и необходимости использовать VPN</li>
<li><strong>Полностью бесплатно</strong> — просто зарегистрируйся и пользуйся без ограничений</li>
<li><strong>Доступно на всех платформах</strong> — мобильные приложения для Android и iOS, десктоп-версия для Windows и macOS, а также веб-версия</li>
</ul>
</section>

<section>
<h2>Скачать Флудилку</h2>
<ul>
<li><a href="https://apps.apple.com/app/id6755156241">App Store (iOS)</a></li>
<li><a href="https://play.google.com/store/apps/details?id=com.floodilka.android">Google Play (Android)</a></li>
<li><a href="https://apps.rustore.ru/app/com.floodilka.android">RuStore (Android)</a></li>
<li><a href="/desktop/updates/Floodilka.exe">Windows</a></li>
<li><a href="/desktop/updates/latest-arm64-mac.dmg">macOS</a></li>
</ul>
</section>`,
		jsonLd: [
			{
				'@type': 'Organization',
				name: 'Флудилка',
				url: SITE_URL,
				logo: `${SITE_URL}/icons/logo.png`,
				description: 'Независимая платформа голосовой и текстовой связи для геймеров',
			},
			{
				'@type': 'SoftwareApplication',
				name: 'Флудилка',
				url: SITE_URL,
				description: 'Бесплатный голосовой чат для геймеров с качественной связью и низким пингом. Альтернатива Discord в России.',
				applicationCategory: 'CommunicationApplication',
				operatingSystem: 'Windows, macOS, Android, iOS, Web',
				offers: {'@type': 'Offer', price: '0', priceCurrency: 'RUB'},
				featureList: 'Голосовые каналы, Текстовые каналы, Прямые эфиры, Серверы, Демонстрация экрана, Обмен файлами',
				inLanguage: ['ru', 'en'],
			},
		],
	},
	{
		path: 'faq',
		title: 'FAQ — Часто задаваемые вопросы о Флудилке | Альтернатива Discord',
		description:
			'Ответы на популярные вопросы о Флудилке: чем отличается от Discord, как скачать, нужен ли VPN, какие платформы поддерживаются. Бесплатный голосовой чат для геймеров.',
		keywords:
			'флудилка faq, вопросы о флудилке, чем заменить дискорд, аналог дискорда вопросы, флудилка или дискорд, голосовой чат вопросы, замена discord faq',
		canonical: '/faq',
		body: `
<h1>Часто задаваемые вопросы о Флудилке</h1>
<p>Здесь собраны ответы на самые популярные вопросы о Флудилке — бесплатном голосовом мессенджере для геймеров.</p>

<dl>
<dt>Что такое Флудилка?</dt>
<dd>Флудилка — это бесплатная платформа для голосового и текстового общения, созданная для геймеров и сообществ. По функционалу аналогична Discord: голосовые каналы, текстовые чаты, серверы, стримы и демонстрация экрана. Работает в России без VPN.</dd>

<dt>Чем Флудилка отличается от Discord?</dt>
<dd>Флудилка — независимая российская платформа. Серверы расположены в России, что обеспечивает низкий пинг и стабильную работу без VPN. Все основные функции бесплатны: голосовые каналы, текстовые чаты, стримы, обмен файлами. Интерфейс привычный для пользователей Discord — переход максимально плавный.</dd>

<dt>Флудилка бесплатная?</dt>
<dd>Да, все основные функции бесплатны. Голосовые каналы, текстовые чаты, серверы, обмен файлами и демонстрация экрана — доступны без оплаты. Премиум-подписка добавляет улучшенное качество стримов и дополнительные возможности кастомизации.</dd>

<dt>Нужен ли VPN для использования Флудилки?</dt>
<dd>Нет, VPN не нужен. Флудилка — полностью независимая платформа с инфраструктурой в России. Все функции работают напрямую, без каких-либо ограничений.</dd>

<dt>На каких платформах работает Флудилка?</dt>
<dd>Флудилка доступна на всех основных платформах: Windows (десктопное приложение), macOS, Android (Google Play и RuStore), iOS (App Store) и в виде веб-приложения, которое работает прямо в браузере.</dd>

<dt>Как скачать Флудилку?</dt>
<dd>Перейдите на страницу загрузки <a href="/download">floodilka.com/download</a>. Там доступны ссылки для всех платформ: App Store для iOS, Google Play и RuStore для Android, установщик для Windows (.exe) и macOS (.dmg). Веб-версию можно использовать прямо на сайте без установки.</dd>

<dt>Как создать сервер в Флудилке?</dt>
<dd>После регистрации нажмите кнопку "+" в левой панели. Выберите "Создать сервер", укажите название и аватарку. Далее вы можете создавать текстовые и голосовые каналы, настраивать роли и приглашать друзей по ссылке-приглашению.</dd>

<dt>Безопасна ли Флудилка?</dt>
<dd>Да. Все соединения шифруются. Мы не передаём данные пользователей третьим лицам. Клиентский код распространяется под лицензией AGPL-3.0 — открытость и прозрачность.</dd>

<dt>Поддерживает ли Флудилка стримы и демонстрацию экрана?</dt>
<dd>Да, Флудилка поддерживает стриминг игр и демонстрацию экрана на всех платформах. На десктопе и в веб-версии можно транслировать экран, отдельные окна или игры. На мобильных устройствах доступна демонстрация экрана.</dd>

<dt>Какое качество голосовой связи в Флудилке?</dt>
<dd>Флудилка использует современные кодеки и адаптивную систему управления качеством. Автоматическая настройка битрейта и мониторинг качества соединения обеспечивают кристально чистый звук даже при нестабильном интернете.</dd>

<dt>Можно ли перенести серверы из Discord в Флудилку?</dt>
<dd>Прямой миграции серверов из Discord пока нет, но создать аналогичную структуру каналов в Флудилке можно за несколько минут. Интерфейс максимально привычный — ваши участники быстро освоятся.</dd>

<dt>Есть ли боты в Флудилке?</dt>
<dd>Система ботов находится в разработке. В будущих обновлениях появится API для создания ботов, модерации и автоматизации серверов.</dd>
</dl>

<p>Не нашли ответ? <a href="/support">Свяжитесь с поддержкой</a>.</p>`,
		jsonLd: {
			'@type': 'FAQPage',
			mainEntity: [
				{
					'@type': 'Question',
					name: 'Что такое Флудилка?',
					acceptedAnswer: {'@type': 'Answer', text: 'Флудилка — это бесплатная платформа для голосового и текстового общения, созданная для геймеров и сообществ. По функционалу аналогична Discord: голосовые каналы, текстовые чаты, серверы, стримы и демонстрация экрана. Работает в России без VPN.'},
				},
				{
					'@type': 'Question',
					name: 'Чем Флудилка отличается от Discord?',
					acceptedAnswer: {'@type': 'Answer', text: 'Флудилка — независимая российская платформа. Серверы расположены в России, что обеспечивает низкий пинг и стабильную работу без VPN. Все основные функции бесплатны.'},
				},
				{
					'@type': 'Question',
					name: 'Флудилка бесплатная?',
					acceptedAnswer: {'@type': 'Answer', text: 'Да, все основные функции бесплатны. Голосовые каналы, текстовые чаты, серверы, обмен файлами и демонстрация экрана — доступны без оплаты.'},
				},
				{
					'@type': 'Question',
					name: 'Нужен ли VPN для использования Флудилки?',
					acceptedAnswer: {'@type': 'Answer', text: 'Нет, VPN не нужен. Флудилка — полностью независимая платформа с инфраструктурой в России.'},
				},
				{
					'@type': 'Question',
					name: 'На каких платформах работает Флудилка?',
					acceptedAnswer: {'@type': 'Answer', text: 'Windows, macOS, Android (Google Play и RuStore), iOS (App Store) и веб-приложение в браузере.'},
				},
				{
					'@type': 'Question',
					name: 'Как скачать Флудилку?',
					acceptedAnswer: {'@type': 'Answer', text: 'Перейдите на floodilka.com/download и выберите свою платформу.'},
				},
				{
					'@type': 'Question',
					name: 'Чем заменить Discord в России?',
					acceptedAnswer: {'@type': 'Answer', text: 'Флудилка — лучшая замена Discord в России. Голосовые каналы, текстовые чаты, серверы, стримы. Работает без VPN, бесплатно.'},
				},
				{
					'@type': 'Question',
					name: 'Безопасна ли Флудилка?',
					acceptedAnswer: {'@type': 'Answer', text: 'Да. Все соединения шифруются. Код клиента под лицензией AGPL-3.0.'},
				},
			],
		},
	},
	{
		path: 'download',
		title: 'Скачать Флудилку — голосовой чат для Windows, macOS, Android, iOS',
		description:
			'Скачайте Флудилку бесплатно для Windows, macOS, Android и iOS. Голосовой чат для геймеров — альтернатива Discord без VPN.',
		keywords:
			'скачать флудилку, скачать аналог дискорда, голосовой чат скачать, замена дискорда скачать, флудилка windows, флудилка android, флудилка ios',
		canonical: '/download',
		body: `
<h1>Скачать Флудилку</h1>
<p>Самое время скачать Флудилку — бесплатный голосовой мессенджер для геймеров. Доступен на всех платформах.</p>

<section>
<h2>Мобильное приложение для всех платформ</h2>
<ul>
<li><a href="https://apps.apple.com/app/id6755156241">App Store (iOS)</a></li>
<li><a href="https://play.google.com/store/apps/details?id=com.floodilka.android">Google Play (Android)</a></li>
<li><a href="https://apps.rustore.ru/app/com.floodilka.android">RuStore (Android)</a></li>
</ul>
</section>

<section>
<h2>Приложение для ПК и веб-версия</h2>
<ul>
<li><a href="/desktop/updates/Floodilka.exe">Скачать для Windows</a></li>
<li><a href="/desktop/updates/latest-arm64-mac.dmg">Скачать для macOS</a></li>
<li><a href="/login">Открыть веб-версию</a></li>
</ul>
</section>`,
	},
	{
		path: 'support',
		title: 'Поддержка — Флудилка',
		description: 'Служба поддержки Флудилки. Свяжитесь с нами по любым вопросам о голосовом мессенджере.',
		keywords: 'флудилка поддержка, помощь флудилка, связаться с флудилкой, флудилка контакты',
		canonical: '/support',
		body: `
<h1>Поддержка</h1>
<p>Если у вас возникли вопросы, проблемы или вам нужна помощь, пожалуйста, свяжитесь с нашей службой поддержки.</p>
<p>Email поддержки: <a href="mailto:help@floodilka.com">help@floodilka.com</a></p>
<p>Мы постараемся ответить на ваше обращение в кратчайшие сроки.</p>
<p>Также загляните в <a href="/faq">часто задаваемые вопросы</a> — возможно, ответ уже там.</p>`,
	},
	{
		path: 'privacy',
		title: 'Политика конфиденциальности — Флудилка',
		description: 'Политика конфиденциальности Флудилки. Узнайте, как мы обрабатываем и защищаем ваши данные.',
		keywords: 'флудилка конфиденциальность, политика конфиденциальности, флудилка данные',
		canonical: '/privacy',
		body: `
<h1>Политика конфиденциальности</h1>
<p>Флудилка заботится о вашей конфиденциальности. Мы не передаём данные пользователей третьим лицам. Все соединения шифруются. Подробнее — на этой странице.</p>`,
	},
	{
		path: 'terms',
		title: 'Пользовательское соглашение — Флудилка',
		description: 'Пользовательское соглашение Флудилки. Условия использования платформы.',
		keywords: 'флудилка условия, пользовательское соглашение, флудилка правила',
		canonical: '/terms',
		body: `
<h1>Пользовательское соглашение</h1>
<p>Условия использования платформы Флудилка. Пожалуйста, ознакомьтесь с полными условиями на этой странице.</p>`,
	},
	{
		path: 'guidelines',
		title: 'Правила сообщества — Флудилка',
		description: 'Правила сообщества Флудилки. Нормы поведения и принципы нашего сообщества.',
		keywords: 'флудилка правила, правила сообщества, флудилка модерация',
		canonical: '/guidelines',
		body: `
<h1>Правила сообщества</h1>
<p>Правила и нормы поведения в сообществе Флудилки. Мы стремимся создать комфортную среду для общения.</p>`,
	},
];

// ── HTML generator ────────────────────────────────────────────────

function buildJsonLd(data) {
	if (Array.isArray(data)) {
		return JSON.stringify({'@context': 'https://schema.org', '@graph': data}, null, 2);
	}
	return JSON.stringify({'@context': 'https://schema.org', ...data}, null, 2);
}

function generatePage(page) {
	const canonical = `${SITE_URL}${page.canonical}`;
	const jsonLdBlock = page.jsonLd
		? `<script type="application/ld+json">\n${buildJsonLd(page.jsonLd)}\n</script>`
		: '';

	return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>${page.title}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="${page.description}">
<meta name="keywords" content="${page.keywords || ''}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="website">
<meta property="og:url" content="${canonical}">
<meta property="og:title" content="${page.title}">
<meta property="og:description" content="${page.description}">
<meta property="og:image" content="${OG_IMAGE}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:site_name" content="Флудилка">
<meta property="og:locale" content="ru_RU">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${page.title}">
<meta name="twitter:description" content="${page.description}">
<meta name="twitter:image" content="${OG_IMAGE}">
<link rel="icon" type="image/png" href="/icons/logo.png">
${jsonLdBlock}
</head>
<body>
<div style="max-width:960px;margin:0 auto;padding:40px 20px;font-family:system-ui,sans-serif;color:#f8fafc;background:#0f0616">
${page.body}
<footer>
<p>&copy; 2026 Флудилка. <a href="/">Главная</a> | <a href="/download">Скачать</a> | <a href="/faq">FAQ</a> | <a href="/support">Поддержка</a> | <a href="/terms">Условия</a> | <a href="/privacy">Конфиденциальность</a> | <a href="/guidelines">Правила</a></p>
</footer>
</div>
</body>
</html>`;
}

// ── Rspack plugin ─────────────────────────────────────────────────

export class PrerenderPlugin {
	apply(compiler) {
		compiler.hooks.thisCompilation.tap('PrerenderPlugin', (compilation) => {
			compilation.hooks.processAssets.tap(
				{
					name: 'PrerenderPlugin',
					stage: compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
				},
				() => {
					for (const page of PAGES) {
						const html = generatePage(page);
						compilation.emitAsset(
							`_prerender/${page.path}.html`,
							new sources.RawSource(html),
						);
					}
				},
			);
		});
	}
}

export function prerenderPlugin() {
	return new PrerenderPlugin();
}
