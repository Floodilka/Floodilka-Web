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

import styles from '../LandingPage.module.css';

interface DownloadInfo {
	platform: string;
	icon: string;
	iconAlt: string;
	label: string;
}

interface LandingHeroProps {
	downloadInfo: DownloadInfo;
	onDownload: () => void;
	onOpenBrowser: () => void;
}

export const LandingHero = ({
	downloadInfo,
	onDownload,
	onOpenBrowser,
}: LandingHeroProps) => {
	return (
		<section className={styles.hero}>
			<div className={styles.container}>
				<div className={styles.hero__content}>
					<div className={styles.hero__title}>
						<h1 className={styles['hero-heading']}>
							<span className={styles['hero-heading__line']}>Общение без границ</span>
						</h1>
					</div>

					<p className={styles.hero__text}>
						Флудилка — удобное место, чтобы созвониться с друзьями или собрать своё большое сообщество.
						Создавайте личные серверы для общения, игр и любых увлечений.
					</p>

					<div className={styles.hero__buttons}>
						<button
							className={`${styles.btn} ${styles['btn--primary']} ${styles['ubuntu-medium']}`}
							onClick={onDownload}
						>
							<img src={downloadInfo.icon} alt={downloadInfo.iconAlt} className={styles.btn__icon} />
							<span className={styles.btn__label}>{downloadInfo.label}</span>
						</button>
						{!['ios', 'android'].includes(downloadInfo.platform) && (
							<button
								className={`${styles.btn} ${styles['btn--secondary']} ${styles['ubuntu-medium']}`}
								onClick={onOpenBrowser}
							>
								Открыть в браузере
							</button>
						)}
					</div>

					<div className={styles['glow-box']}>
						<img src="/icons/landing_promo.png" alt="Флудилка — интерфейс приложения" className={styles['glow-image']} />
					</div>
				</div>
			</div>
		</section>
	);
};
