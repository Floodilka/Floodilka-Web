import {useEffect} from 'react';
import {useSEO} from '~/hooks/useSEO';
import {QRCodeCanvas} from '~/components/uikit/QRCodeCanvas';
import {LandingFooter} from '../Landing/components/LandingFooter';
import {LandingHeader} from '../Landing/components/LandingHeader';
import {useDownload} from '../Landing/hooks/useDownload';
import {useMenu} from '../Landing/hooks/useMenu';
import landingStyles from '../Landing/LandingPage.module.css';
import downloadPhoneImg from './download-phone.svg';
import rustoreIcon from './rustore-icon.svg';
import styles from './DownloadPage.module.css';

const BRAND_BG = '#0F0616';

export const DownloadPage = () => {
	const {downloadInfo} = useDownload();
	const {menuOpen, toggleMenu, closeMenu} = useMenu();

	useSEO({
		title: 'Скачать Флудилку — голосовой чат для Windows, macOS, Android, iOS',
		description:
			'Скачайте Флудилку бесплатно для Windows, macOS, Android и iOS. Голосовой чат для геймеров — альтернатива Discord без VPN.',
		keywords:
			'скачать флудилку, скачать аналог дискорда, голосовой чат скачать, замена дискорда скачать, флудилка windows, флудилка android, флудилка ios',
		canonicalPath: '/download',
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

	return (
		<div className={landingStyles.landing} style={{backgroundColor: BRAND_BG}}>
			<div className={landingStyles.landing__container}>
				<main className={styles.main}>
					<LandingHeader
						menuOpen={menuOpen}
						onToggleMenu={toggleMenu}
						onCloseMenu={closeMenu}
						platform={downloadInfo.platform}
					/>

					<section className={styles.hero}>
						<h1 className={styles.heroTitle}>
							Самое время скачать Флудилку
						</h1>
					</section>

					<div className={styles.cards}>
						<section className={styles.card}>
							<div className={styles.cardMedia}>
								<img
									src={downloadPhoneImg}
									alt="Флудилка на смартфоне"
									className={styles.phoneImage}
								/>
							</div>
							<div className={styles.cardContent}>
								<h2 className={styles.cardTitle}>
									Мобильное приложение для всех платформ
								</h2>
								<div className={styles.buttons}>
									<a
										href="https://apps.apple.com/app/id6755156241"
										target="_blank"
										rel="noopener noreferrer"
										className={styles.storeBtn}
									>
										<svg viewBox="0 0 24 24" fill="currentColor">
											<path d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 22 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.1 22C7.79 22.05 6.8 20.68 5.96 19.47C4.25 16.56 2.93 11.3 4.7 7.72C5.57 5.94 7.36 4.86 9.28 4.84C10.56 4.81 11.78 5.72 12.57 5.72C13.36 5.72 14.85 4.62 16.4 4.8C17.07 4.83 18.87 5.08 20.07 6.73C19.96 6.8 17.62 8.15 17.65 10.97C17.69 14.3 20.54 15.42 20.58 15.44C20.55 15.52 20.11 17.03 18.71 19.5ZM13 3.5C13.73 2.67 14.94 2.04 15.94 2C16.07 3.17 15.6 4.35 14.9 5.19C14.21 6.04 13.07 6.7 11.95 6.61C11.8 5.46 12.36 4.26 13 3.5Z" />
										</svg>
										App Store
									</a>
									<a
										href="https://play.google.com/store/apps/details?id=com.floodilka.android"
										target="_blank"
										rel="noopener noreferrer"
										className={styles.storeBtn}
									>
										<svg viewBox="0 0 24 24" fill="currentColor">
											<path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.61 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.5,12.92 20.16,13.19L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z" />
										</svg>
										Google Play
									</a>
									<a
										href="https://apps.rustore.ru/app/com.floodilka.android"
										target="_blank"
										rel="noopener noreferrer"
										className={styles.storeBtn}
									>
										<img src={rustoreIcon} alt="RuStore" width="24" height="24" />
										RuStore
									</a>
								</div>
								<div className={styles.qrBlock}>
									<div className={styles.qrCode}>
										<QRCodeCanvas data={`${window.location.origin}/download/app`} />
									</div>
									<p className={styles.qrText}>
										Наведи камеру и скачай Флудилку
									</p>
								</div>
							</div>
						</section>

						<section className={styles.card}>
							<div className={styles.cardContent}>
								<h2 className={styles.cardTitle}>
									Приложение для пк и веб версия
								</h2>
								<div className={styles.buttons}>
									<a
										href="/desktop/updates/Floodilka.exe"
										download="Floodilka.exe"
										className={styles.storeBtn}
									>
										<svg viewBox="0 0 24 24" fill="currentColor">
											<path d="M3,12V6.75L9,5.43V11.91L3,12M20,3V11.75L10,11.97V5.25L20,3M3,13L9,13.09V19.9L3,18.75V13M10,13.2L20,13V22L10,20.09V13.2Z" />
										</svg>
										Windows
									</a>
									<a
										href="/desktop/updates/latest-arm64-mac.dmg"
										download="Floodilka.dmg"
										className={styles.storeBtn}
									>
										<svg viewBox="0 0 24 24" fill="currentColor">
											<path d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 22 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.1 22C7.79 22.05 6.8 20.68 5.96 19.47C4.25 16.56 2.93 11.3 4.7 7.72C5.57 5.94 7.36 4.86 9.28 4.84C10.56 4.81 11.78 5.72 12.57 5.72C13.36 5.72 14.85 4.62 16.4 4.8C17.07 4.83 18.87 5.08 20.07 6.73C19.96 6.8 17.62 8.15 17.65 10.97C17.69 14.3 20.54 15.42 20.58 15.44C20.55 15.52 20.11 17.03 18.71 19.5ZM13 3.5C13.73 2.67 14.94 2.04 15.94 2C16.07 3.17 15.6 4.35 14.9 5.19C14.21 6.04 13.07 6.7 11.95 6.61C11.8 5.46 12.36 4.26 13 3.5Z" />
										</svg>
										macOS
									</a>
								</div>
							</div>
							<div className={`${styles.cardMedia} ${styles.cardMediaDesktop}`}>
								<img
									src="/icons/landing_promo.png"
									alt="Флудилка на компьютере"
									className={styles.desktopImage}
								/>
							</div>
						</section>
					</div>

					<LandingFooter />
				</main>
			</div>
		</div>
	);
};
