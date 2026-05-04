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
	icon: string;
	iconAlt: string;
	label: string;
}

interface LandingCTAProps {
	downloadInfo: DownloadInfo;
	onDownload: () => void;
}

export const LandingCTA = ({downloadInfo, onDownload}: LandingCTAProps) => {
	return (
		<div className={styles.curtain}>
			<section className={styles.cta_block}>
				<div className={styles.txt_and_butt}>
					<h1 className={styles.txt_download}>
						Убедись во всем сам. Скачай приложение и начни общаться уже сейчас
					</h1>
					<button
						className={`${styles.btn} ${styles['btn--primary']} ${styles['ubuntu-medium']}`}
						onClick={onDownload}
					>
						<img src={downloadInfo.icon} alt={downloadInfo.iconAlt} className={styles.btn__icon} />
						<span className={styles.btn__label}>{downloadInfo.label}</span>
					</button>
					<div className={styles.floodilka_figura}>
						<img src="/icons/floodilka.svg" alt="Логотип Флудилка - декоративный элемент" />
					</div>
				</div>
			</section>
		</div>
	);
};
