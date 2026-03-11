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
							<span className={styles['hero-heading__line']}>
								Голосовой{' '}
								<img
									src="/icons/connection.svg"
									alt="Иконка качественного соединения"
									className={styles.hero__icon}
								/>{' '}
								чат
							</span>
							<span className={styles['hero-heading__line']}>для геймеров</span>
						</h1>
					</div>

					<p className={styles.hero__text}>
						Флудилка — это бесплатный голосовой мессенджер для геймеров, которые ценят скорость, надёжность
						и свободу
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
