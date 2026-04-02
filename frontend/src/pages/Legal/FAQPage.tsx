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

import {useEffect, useLayoutEffect, useState} from 'react';
import {useSEO} from '~/hooks/useSEO';
import {LandingHeader} from '~/pages/Landing/components/LandingHeader';
import {LandingFooter} from '~/pages/Landing/components/LandingFooter';
import {useMenu} from '~/pages/Landing/hooks/useMenu';
import styles from './FAQPage.module.css';

interface FAQItem {
	question: string;
	answer: string;
}

const FAQ_ITEMS: FAQItem[] = [
	{
		question: 'Что такое Флудилка?',
		answer:
			'Флудилка — это бесплатная платформа для голосового и текстового общения, созданная для геймеров и сообществ. По функционалу аналогична Discord: голосовые каналы, текстовые чаты, серверы, стримы и демонстрация экрана. Работает в России без VPN.',
	},
	{
		question: 'Чем Флудилка отличается от Discord?',
		answer:
			'Флудилка — независимая российская платформа. Серверы расположены в России, что обеспечивает низкий пинг и стабильную работу без VPN. Все основные функции бесплатны: голосовые каналы, текстовые чаты, стримы, обмен файлами. Интерфейс привычный для пользователей Discord — переход максимально плавный.',
	},
	{
		question: 'Флудилка бесплатная?',
		answer:
			'Да, все основные функции бесплатны. Голосовые каналы, текстовые чаты, серверы, обмен файлами и демонстрация экрана — доступны без оплаты. Премиум-подписка добавляет улучшенное качество стримов и дополнительные возможности кастомизации.',
	},
	{
		question: 'Нужен ли VPN для использования Флудилки?',
		answer:
			'Нет, VPN не нужен. Флудилка — полностью независимая платформа с инфраструктурой в России. Все функции работают напрямую, без каких-либо ограничений.',
	},
	{
		question: 'На каких платформах работает Флудилка?',
		answer:
			'Флудилка доступна на всех основных платформах: Windows (десктопное приложение), macOS, Android (Google Play и RuStore), iOS (App Store) и в виде веб-приложения, которое работает прямо в браузере.',
	},
	{
		question: 'Как скачать Флудилку?',
		answer:
			'Перейдите на страницу загрузки floodilka.com/download. Там доступны ссылки для всех платформ: App Store для iOS, Google Play и RuStore для Android, установщик для Windows (.exe) и macOS (.dmg). Веб-версию можно использовать прямо на сайте без установки.',
	},
	{
		question: 'Как создать сервер в Флудилке?',
		answer:
			'После регистрации нажмите кнопку "+" в левой панели. Выберите "Создать сервер", укажите название и аватарку. Далее вы можете создавать текстовые и голосовые каналы, настраивать роли и приглашать друзей по ссылке-приглашению.',
	},
	{
		question: 'Безопасна ли Флудилка?',
		answer:
			'Да. Все соединения шифруются. Мы не передаём данные пользователей третьим лицам. Клиентский код распространяется под лицензией AGPL-3.0 — открытость и прозрачность.',
	},
	{
		question: 'Поддерживает ли Флудилка стримы и демонстрацию экрана?',
		answer:
			'Да, Флудилка поддерживает стриминг игр и демонстрацию экрана на всех платформах. На десктопе и в веб-версии можно транслировать экран, отдельные окна или игры. На мобильных устройствах доступна демонстрация экрана.',
	},
	{
		question: 'Какое качество голосовой связи в Флудилке?',
		answer:
			'Флудилка использует современные кодеки и адаптивную систему управления качеством. Автоматическая настройка битрейта и мониторинг качества соединения обеспечивают кристально чистый звук даже при нестабильном интернете.',
	},
	{
		question: 'Можно ли перенести серверы из Discord в Флудилку?',
		answer:
			'Прямой миграции серверов из Discord пока нет, но создать аналогичную структуру каналов в Флудилке можно за несколько минут. Интерфейс максимально привычный — ваши участники быстро освоятся.',
	},
	{
		question: 'Есть ли боты в Флудилке?',
		answer:
			'Система ботов находится в разработке. В будущих обновлениях появится API для создания ботов, модерации и автоматизации серверов.',
	},
];

const FAQItem = ({item, isOpen, onToggle}: {item: FAQItem; isOpen: boolean; onToggle: () => void}) => (
	<div className={`${styles.faqItem} ${isOpen ? styles.faqItemOpen : ''}`}>
		<button type="button" className={styles.faqQuestion} onClick={onToggle} aria-expanded={isOpen}>
			<span>{item.question}</span>
			<span className={`${styles.faqChevron} ${isOpen ? styles.faqChevronOpen : ''}`}>
				<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
					<path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
				</svg>
			</span>
		</button>
		<div className={`${styles.faqAnswer} ${isOpen ? styles.faqAnswerOpen : ''}`}>
			<p>{item.answer}</p>
		</div>
	</div>
);

const FAQPage = () => {
	const {menuOpen, toggleMenu, closeMenu} = useMenu();
	const [openIndex, setOpenIndex] = useState<number | null>(null);

	useSEO({
		title: 'FAQ — Часто задаваемые вопросы о Флудилке | Альтернатива Discord',
		description:
			'Ответы на популярные вопросы о Флудилке: чем отличается от Discord, как скачать, нужен ли VPN, какие платформы поддерживаются. Бесплатный голосовой чат для геймеров.',
		keywords:
			'флудилка faq, вопросы о флудилке, чем заменить дискорд, аналог дискорда вопросы, флудилка или дискорд, голосовой чат вопросы, замена discord faq',
		canonicalPath: '/faq',
	});

	useEffect(() => {
		const html = document.documentElement;
		const {body} = document;

		html.classList.add('auth-page');
		html.style.overflow = 'auto';
		body.style.overflow = 'auto';

		return () => {
			html.classList.remove('auth-page');
			html.style.overflow = '';
			body.style.overflow = '';
		};
	}, []);

	useLayoutEffect(() => {
		window.scrollTo(0, 0);
		document.documentElement.scrollTop = 0;
		document.body.scrollTop = 0;
	}, []);

	const handleToggle = (index: number) => {
		setOpenIndex(openIndex === index ? null : index);
	};

	return (
		<div className={styles.faqPage}>
			<div className={styles.faqPage__container}>
				<LandingHeader
					menuOpen={menuOpen}
					onToggleMenu={toggleMenu}
					onCloseMenu={closeMenu}
					platform="desktop"
				/>

				<main className={styles.faqMain}>
					<div className={styles.faqContent}>
						<h1 className={styles.faqTitle}>Часто задаваемые вопросы</h1>

						<div className={styles.faqIntro}>
							<p>
								Здесь собраны ответы на самые популярные вопросы о Флудилке — бесплатном голосовом мессенджере для геймеров.
							</p>
						</div>

						<div className={styles.faqList}>
							{FAQ_ITEMS.map((item, index) => (
								<FAQItem
									key={item.question}
									item={item}
									isOpen={openIndex === index}
									onToggle={() => handleToggle(index)}
								/>
							))}
						</div>

						<section className={styles.faqCta}>
							<h2 className={styles.faqCtaTitle}>Не нашли ответ?</h2>
							<p className={styles.faqCtaText}>
								Напишите нам, и мы поможем разобраться.
							</p>
							<a href="/support" className={styles.faqCtaButton}>
								Связаться с поддержкой
							</a>
						</section>
					</div>
				</main>

				<LandingFooter />
			</div>
		</div>
	);
};

export default FAQPage;
