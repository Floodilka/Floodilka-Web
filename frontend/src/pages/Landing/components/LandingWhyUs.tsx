import {memo, type RefObject} from 'react';
import styles from '../LandingPage.module.css';

const FEATURES = [
	{
		icon: '/icons/voice_quality.png',
		title: 'Качество связи',
		text: 'Без лагов и необходимости использовать VPN',
	},
	{
		icon: '/icons/full_free.png',
		title: 'Полностью бесплатно',
		text: 'Просто зарегистрируйся и пользуйся без ограничений',
	},
	{
		icon: '/icons/all_platforms.png',
		title: 'Доступно на всех платформах',
		text: 'Мобильные приложения для Android и iOS, десктоп-версия для Windows и macOS, а также веб-версия для любого устройства',
	},
];

interface LandingWhyUsProps {
	whyUsRef: RefObject<HTMLElement | null>;
}

export const LandingWhyUs = memo(({whyUsRef}: LandingWhyUsProps) => (
	<section className={styles.why_us} id="why_us" ref={whyUsRef}>
		<div className={styles.text_h2}>
			<h2>Именно за это нас и выбирают</h2>
		</div>
		<div className={styles['why-us__cards']}>
			{FEATURES.map((feature) => (
				<div key={feature.title} className={styles['why-us__card']}>
					<img src={feature.icon} alt={feature.title} className={styles['why-us__icon']} loading="lazy" />
					<h4 className={styles['why-us__title']}>{feature.title}</h4>
					<p className={styles['why-us__text']}>{feature.text}</p>
				</div>
			))}
		</div>
	</section>
));

LandingWhyUs.displayName = 'LandingWhyUs';
