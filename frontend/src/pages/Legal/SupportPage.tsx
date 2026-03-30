import {useEffect, useLayoutEffect} from 'react';
import {useSEO} from '~/hooks/useSEO';
import {LandingHeader} from '~/pages/Landing/components/LandingHeader';
import {LandingFooter} from '~/pages/Landing/components/LandingFooter';
import {useMenu} from '~/pages/Landing/hooks/useMenu';
import styles from './SupportPage.module.css';

const SupportPage = () => {
	const {menuOpen, toggleMenu, closeMenu} = useMenu();

	useSEO({
		title: 'Поддержка — Флудилка',
		description: 'Служба поддержки Флудилки. Свяжитесь с нами по любым вопросам о голосовом мессенджере.',
		canonicalPath: '/support',
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

	return (
		<div className={styles['support-page']}>
			<div className={styles['support-page__container']}>
				<LandingHeader
					menuOpen={menuOpen}
					onToggleMenu={toggleMenu}
					onCloseMenu={closeMenu}
					platform="desktop"
				/>

				<main className={styles['support-main']}>
					<div className={styles['support-content']}>
						<h1 className={styles['support-title']}>Поддержка</h1>

						<div className={styles['support-intro']}>
							<p>
								Если у вас возникли вопросы, проблемы или вам нужна помощь, пожалуйста, свяжитесь с нашей службой поддержки.
							</p>
						</div>

						<section className={styles['support-section']}>
							<div className={styles['support-section__content']}>
								<div className={styles['support-email-block']}>
									<p className={styles['support-email-label']}>Email поддержки:</p>
									<a href="mailto:help@floodilka.com" className={styles['support-email']}>
										help@floodilka.com
									</a>
								</div>

								<p className={styles['support-note']}>
									Мы постараемся ответить на ваше обращение в кратчайшие сроки.
								</p>
							</div>
						</section>
					</div>
				</main>

				<LandingFooter />
			</div>
		</div>
	);
};

export default SupportPage;
