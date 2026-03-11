import type {RefObject} from 'react';
import styles from '../LandingPage.module.css';

interface Feature {
	title: string;
	text: string;
	media?: string;
	reverse?: boolean;
}

interface LandingFeaturesProps {
	featuresRef: RefObject<HTMLElement | null>;
}

const FEATURES: Feature[] = [
	{
		title: 'Прямые эфиры',
		text: 'Ты можешь с легкостью присоединиться к прямому эфиру с любого устройства или провести его сам для своих друзей или коммьюнити',
		media: '/icons/live.mp4',
	},
	{
		title: 'Голосовые и текстовые комнаты',
		text: 'Мгновенно переключайся между текстовыми и голосовыми комнатами, не нужно планировать встречи — просто заходи и общайся',
		media: '/icons/voice_channel.mp4',
		reverse: true,
	},
	{
		title: 'Серверы',
		text: 'Создавай серверы для разных целей — игр, учебы или просто общения с друзьями',
		media: '/icons/servers.mp4',
	},
];

const isVideo = (src: string) => src.endsWith('.mp4') || src.endsWith('.webm');

export const LandingFeatures = ({featuresRef}: LandingFeaturesProps) => {
	return (
		<section className={styles.features} ref={featuresRef}>
			<div className={styles.text_h2}>
				<h2>Есть все для комфортной игры</h2>
			</div>
			<div className={styles['features__cards']}>
				{FEATURES.map((feature) => (
					<div
						key={feature.title}
						className={`${styles['feature-card']} ${feature.reverse ? styles['feature-card--reverse'] : ''}`}
					>
						<div className={styles['feature-card__text']}>
							<h3>{feature.title}</h3>
							<p>{feature.text}</p>
						</div>
						<div className={styles['feature-card__media']}>
							{feature.media ? (
								isVideo(feature.media) ? (
									<video autoPlay loop muted playsInline>
										<source src={feature.media} type="video/mp4" />
									</video>
								) : (
									<img src={feature.media} alt={feature.title} loading="lazy" />
								)
							) : (
								<div className={styles['feature-card__placeholder']} />
							)}
						</div>
					</div>
				))}
			</div>
		</section>
	);
};
