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

import {useEffect, useRef} from 'react';
import {useSEO} from '~/hooks/useSEO';
import {useNavigate} from '~/lib/router';
import {Routes} from '~/Routes';
import AuthenticationStore from '~/stores/AuthenticationStore';
import {LandingCTA} from './components/LandingCTA';
import {LandingFeatures} from './components/LandingFeatures';
import {LandingFooter} from './components/LandingFooter';
import {LandingHeader} from './components/LandingHeader';
import {LandingHero} from './components/LandingHero';
import {LandingWhyUs} from './components/LandingWhyUs';
import {useDownload} from './hooks/useDownload';
import {useMenu} from './hooks/useMenu';
import styles from './LandingPage.module.css';

const BRAND_BG = '#0F0616';

export const LandingPage = () => {
	const navigate = useNavigate();
	const whyUsRef = useRef<HTMLElement>(null);
	const featuresRef = useRef<HTMLElement>(null);

	const {downloadInfo, handleDownload: downloadHandler} = useDownload();
	const {menuOpen, toggleMenu, closeMenu} = useMenu();

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

	useSEO({
		title: 'Флудилка — голосовой чат для геймеров | Альтернатива Discord в России',
		description:
			'Флудилка — бесплатный голосовой мессенджер для геймеров. Аналог Discord, который работает в России без VPN. Голосовые каналы, стримы, серверы — всё бесплатно.',
		keywords:
			'аналог дискорда, замена дискорда, альтернатива дискорду, голосовой чат для игр, голосовой мессенджер, бесплатный голосовой чат, дискорд аналог, чем заменить дискорд, голосовой чат без впн, дискорд заблокирован, мессенджер для геймеров, discord альтернатива, войс чат, голосовой чат россия, флудилка',
		canonicalPath: '/',
	});

	const handleDownload = () => {
		closeMenu();
		downloadHandler();
	};

	const handleOpenBrowser = () => {
		closeMenu();
		void navigate(AuthenticationStore.isAuthenticated ? Routes.ME : Routes.LOGIN);
	};

	return (
		<div className={styles.landing} style={{backgroundColor: BRAND_BG}}>
			<div className={styles.landing__container}>
				<main className={styles['landing-main']}>
					<LandingHeader
						menuOpen={menuOpen}
						onToggleMenu={toggleMenu}
						onCloseMenu={closeMenu}
						platform={downloadInfo.platform}
					/>

					<LandingHero
						downloadInfo={downloadInfo}
						onDownload={handleDownload}
						onOpenBrowser={handleOpenBrowser}
					/>

					<LandingFeatures featuresRef={featuresRef} />

					<LandingWhyUs whyUsRef={whyUsRef} />

					<section className={styles['footer-reveal']}>
						<LandingCTA downloadInfo={downloadInfo} onDownload={handleDownload} />
						<LandingFooter />
					</section>
				</main>
			</div>
		</div>
	);
};
