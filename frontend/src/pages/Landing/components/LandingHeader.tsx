import {useNavigate} from '~/lib/router';
import {Routes} from '~/Routes';
import AuthenticationStore from '~/stores/AuthenticationStore';
import styles from '../LandingPage.module.css';

interface LandingHeaderProps {
	menuOpen: boolean;
	onToggleMenu: () => void;
	onCloseMenu: () => void;
	platform: string;
}

export const LandingHeader = ({menuOpen, onToggleMenu, onCloseMenu, platform}: LandingHeaderProps) => {
	const navigate = useNavigate();
	const isMobile = platform === 'ios' || platform === 'android';

	const handleLogin = (e: React.MouseEvent) => {
		e.preventDefault();
		onCloseMenu();
		void navigate(AuthenticationStore.isAuthenticated ? Routes.ME : Routes.LOGIN);
	};

	const handleLogoClick = (e: React.MouseEvent) => {
		e.preventDefault();
		void navigate('/');
	};

	return (
		<header className={`${styles.header} ${menuOpen ? styles['is-open'] : ''}`}>
			<div className={styles.header__container}>
				<a href="/" onClick={handleLogoClick} style={{cursor: 'pointer'}}>
					<svg
						className={styles.header__logo}
						viewBox="0 0 140 39"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
						role="img"
						aria-label="Флудилка"
					>
						<path
							d="M3.32895 10.28C3.32895 5.7071 6.91951 2 11.3487 2C15.7779 2 19.3684 5.7071 19.3684 10.28V18.8085C19.3684 23.3814 15.7779 27.0885 11.3487 27.0885C6.91951 27.0885 3.32895 23.3814 3.32895 18.8085V10.28Z"
							fill="white"
						/>
						<path
							d="M14.5325 18.354C14.7754 18.0597 15.2059 18.0222 15.4941 18.2702C15.7824 18.5182 15.8191 18.9579 15.5762 19.2522L15.3653 19.5078C13.4016 21.8874 9.76821 21.7398 7.99577 19.2084C7.77656 18.8953 7.8474 18.4601 8.154 18.2362C8.4606 18.0124 8.88681 18.0847 9.10603 18.3978C10.3604 20.1893 12.9318 20.2937 14.3216 18.6096L14.5325 18.354Z"
							fill="#0F0616"
						/>
						<path
							d="M9.68421 14.0796C9.68421 14.7639 9.14224 15.3186 8.47368 15.3186C7.80513 15.3186 7.26316 14.7639 7.26316 14.0796C7.26316 13.3954 7.80513 12.8407 8.47368 12.8407C9.14224 12.8407 9.68421 13.3954 9.68421 14.0796Z"
							fill="#0F0616"
						/>
						<path
							d="M9.60611 14.0796C9.60611 13.4395 9.09911 12.9206 8.47368 12.9206C7.84826 12.9206 7.34126 13.4395 7.34126 14.0796C7.34126 14.7197 7.84826 15.2387 8.47368 15.2387V15.3186C7.80513 15.3186 7.26316 14.7639 7.26316 14.0796C7.26316 13.3954 7.80513 12.8407 8.47368 12.8407C9.14224 12.8407 9.68421 13.3954 9.68421 14.0796C9.68421 14.7639 9.14224 15.3186 8.47368 15.3186V15.2387C9.09911 15.2387 9.60611 14.7197 9.60611 14.0796Z"
							fill="#0F0616"
						/>
						<path
							d="M16.0395 14.0796C16.0395 14.7639 15.4975 15.3186 14.8289 15.3186C14.1604 15.3186 13.6184 14.7639 13.6184 14.0796C13.6184 13.3954 14.1604 12.8407 14.8289 12.8407C15.4975 12.8407 16.0395 13.3954 16.0395 14.0796Z"
							fill="#0F0616"
						/>
						<path
							d="M15.9614 14.0796C15.9614 13.4395 15.4544 12.9206 14.8289 12.9206C14.2035 12.9206 13.6965 13.4395 13.6965 14.0796C13.6965 14.7197 14.2035 15.2387 14.8289 15.2387V15.3186C14.1604 15.3186 13.6184 14.7639 13.6184 14.0796C13.6184 13.3954 14.1604 12.8407 14.8289 12.8407C15.4975 12.8407 16.0395 13.3954 16.0395 14.0796C16.0395 14.7639 15.4975 15.3186 14.8289 15.3186V15.2387C15.4544 15.2387 15.9614 14.7197 15.9614 14.0796Z"
							fill="#0F0616"
						/>
						<path
							d="M0 19.8326V17.4799C0 16.9705 0.398845 16.5575 0.890845 16.5575C1.38285 16.5575 1.78169 16.9705 1.78169 17.4799V19.8326C1.78169 25.4008 6.1187 29.8898 11.5 29.8898C16.8813 29.8898 21.2183 25.4008 21.2183 19.8326V17.4799C21.2183 16.9705 21.6172 16.5575 22.1092 16.5575C22.6012 16.5575 23 16.9705 23 17.4799V19.8326C23 26.4204 17.8645 31.7345 11.5 31.7345C5.13545 31.7345 0 26.4204 0 19.8326Z"
							fill="white"
						/>
						<path
							d="M10.5921 35.1326V31.124C10.5921 30.6059 10.9986 30.1858 11.5 30.1858C12.0014 30.1858 12.4079 30.6059 12.4079 31.124V35.1326C12.4079 35.6508 12.0014 36.0708 11.5 36.0708C10.9986 36.0708 10.5921 35.6508 10.5921 35.1326Z"
							fill="white"
							fillOpacity="0.87451"
						/>
						<path
							d="M5.72851 35.1416H17.5741C18.0637 35.1416 18.4605 35.5576 18.4605 36.0708C18.4605 36.584 18.0637 37 17.5741 37H5.72851C5.23896 37 4.84211 36.584 4.84211 36.0708C4.84211 35.5576 5.23896 35.1416 5.72851 35.1416Z"
							fill="white"
						/>
						<text
							x="34"
							y="24.5"
							fontFamily="Inter, sans-serif"
							fontWeight="700"
							fontSize="19"
							fill="white"
						>
							Флудилка
						</text>
					</svg>
				</a>

				{!isMobile && (
					<>
						<button
							className={styles.header__burger}
							aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'}
							aria-expanded={menuOpen}
							aria-controls="primary-nav"
							onClick={onToggleMenu}
						>
							<span className={styles['header__burger-lines']} aria-hidden="true" />
						</button>

						<nav id="primary-nav" className={styles.header__nav} onClick={onCloseMenu}>
							<a
								href="/download"
								onClick={(e) => {
									e.preventDefault();
									onCloseMenu();
									void navigate('/download');
								}}
							>
								Скачать
							</a>
							<a href="#" onClick={handleLogin} className={styles['login-btn']}>
								{AuthenticationStore.isAuthenticated ? 'Открыть приложение' : 'Вход и регистрация'}
							</a>
						</nav>
					</>
				)}
			</div>
		</header>
	);
};
