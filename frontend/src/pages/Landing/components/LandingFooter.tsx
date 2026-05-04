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
					<Link to="/faq" className={styles.footer__link}>
						FAQ
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
