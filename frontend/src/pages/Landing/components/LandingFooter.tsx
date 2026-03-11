import {Link} from '~/lib/router';
import styles from '../LandingPage.module.css';

export const LandingFooter = () => {
	return (
		<footer className={styles.footer}>
			<div className={styles.footer__content}>
				<p className={styles.footer__copy}>&copy; 2026 Флудилка. Все права защищены.</p>
				<p className={styles.footer__links}>
					<Link to="/privacy" className={styles.footer__link}>
						Политика конфиденциальности
					</Link>
					&nbsp;|&nbsp;
					<Link to="/terms" className={styles.footer__link}>
						Пользовательское соглашение
					</Link>
					&nbsp;|&nbsp;
					<Link to="/support" className={styles.footer__link}>
						Поддержка
					</Link>
					&nbsp;|&nbsp;
					<Link to="/guidelines" className={styles.footer__link}>
						Правила сообщества
					</Link>
				</p>
			</div>
		</footer>
	);
};
