import {useEffect, useLayoutEffect} from 'react';
import {useSEO} from '~/hooks/useSEO';
import {LandingHeader} from '~/pages/Landing/components/LandingHeader';
import {LandingFooter} from '~/pages/Landing/components/LandingFooter';
import {useMenu} from '~/pages/Landing/hooks/useMenu';
import styles from './PrivacyPage.module.css';

const PrivacyPage = () => {
	const {menuOpen, toggleMenu, closeMenu} = useMenu();

	useSEO({
		title: 'Политика конфиденциальности — Флудилка',
		description: 'Политика конфиденциальности Флудилки. Узнайте, как мы защищаем ваши данные.',
		canonicalPath: '/privacy',
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

	useLayoutEffect(() => {
		window.scrollTo(0, 0);
		document.documentElement.scrollTop = 0;
		document.body.scrollTop = 0;
	}, []);

	return (
		<div className={styles['privacy-page']}>
			<div className={styles['privacy-page__container']}>
				<LandingHeader
					menuOpen={menuOpen}
					onToggleMenu={toggleMenu}
					onCloseMenu={closeMenu}
					platform="desktop"
				/>

				<main className={styles['privacy-main']}>
					<div className={styles['privacy-content']}>
						<h1 className={styles['privacy-title']}>Политика конфиденциальности</h1>

						<p className={styles['privacy-updated']}>
							Дата последнего обновления: 1 марта 2026
						</p>

						<div className={styles['privacy-intro']}>
							<p>
								Настоящая Политика конфиденциальности (далее — «Политика») определяет порядок сбора, обработки, хранения и защиты персональных данных пользователей сервиса «Флудилка» (далее — «Сервис»).
							</p>
							<p>
								Оператор персональных данных — ИП Тенгизов Эльдар Азаматович (ИНН 070106943754, ОГРНИП 326070000007930), далее — «Оператор», «Администрация», «мы».
							</p>
							<p>
								Обработка персональных данных осуществляется в соответствии с Федеральным законом от 27.07.2006 № 152-ФЗ «О персональных данных», Федеральным законом от 27.07.2006 № 149-ФЗ «Об информации, информационных технологиях и о защите информации» и иными нормативными актами Российской Федерации.
							</p>
							<p>
								Используя Сервис, вы подтверждаете, что ознакомились с настоящей Политикой и даёте согласие на обработку ваших персональных данных на изложенных условиях.
							</p>
						</div>

						<section className={styles['privacy-section']}>
							<h2 className={styles['privacy-section__title']}>1. Какие данные мы собираем</h2>

							<div className={styles['privacy-section__content']}>
								<p className={styles['privacy-paragraph']}>
									<strong>1.1. Данные, которые вы предоставляете при регистрации и использовании Сервиса:</strong>
								</p>

								<ul className={styles['privacy-list']}>
									<li>адрес электронной почты;</li>
									<li>имя пользователя и отображаемое имя;</li>
									<li>пароль (хранится в захешированном виде);</li>
									<li>аватар и другие изображения профиля;</li>
									<li>дата рождения (если указана);</li>
									<li>данные, полученные через сторонние сервисы авторизации (ВКонтакте, Яндекс и другие), если вы используете их для входа;</li>
									<li>иная информация, которую вы указываете в профиле добровольно.</li>
								</ul>

								<p className={styles['privacy-paragraph']}>
									<strong>1.2. Данные, собираемые автоматически:</strong>
								</p>

								<ul className={styles['privacy-list']}>
									<li>IP-адрес;</li>
									<li>тип и версия браузера, операционная система, параметры устройства;</li>
									<li>идентификаторы сессии;</li>
									<li>дата и время входа, продолжительность сессии;</li>
									<li>действия в интерфейсе Сервиса.</li>
								</ul>

								<p className={styles['privacy-paragraph']}>
									<strong>1.3. Пользовательский контент:</strong>
								</p>

								<ul className={styles['privacy-list']}>
									<li>текстовые сообщения;</li>
									<li>изображения, файлы и другие загруженные материалы;</li>
									<li>данные о созданных серверах, каналах, ролях и настройках.</li>
								</ul>

								<p className={styles['privacy-paragraph']}>
									<strong>1.4. Платёжные данные:</strong>
								</p>

								<p className={styles['privacy-paragraph']}>
									При оформлении подписки «Флудилка Премиум» обработка платежей осуществляется платёжным провайдером. Мы не храним данные банковских карт. Мы получаем от платёжного провайдера только информацию о статусе платежа, дате и сумме транзакции.
								</p>

								<p className={styles['privacy-paragraph']}>
									<strong>1.5. Технические журналы (логи):</strong>
								</p>

								<ul className={styles['privacy-list']}>
									<li>записи о входе в аккаунт и IP-адрес;</li>
									<li>операции внутри аккаунта;</li>
									<li>системные ошибки и служебные записи.</li>
								</ul>
							</div>
						</section>

						<section className={styles['privacy-section']}>
							<h2 className={styles['privacy-section__title']}>2. Цели обработки данных</h2>

							<div className={styles['privacy-section__content']}>
								<p className={styles['privacy-paragraph']}>
									Мы обрабатываем ваши данные для следующих целей:
								</p>

								<ul className={styles['privacy-list']}>
									<li>регистрация и авторизация в Сервисе;</li>
									<li>предоставление функционала Сервиса: обмен сообщениями, создание серверов, каналов, голосовая и видеосвязь;</li>
									<li>обработка платежей и управление подпиской;</li>
									<li>обеспечение безопасности: защита от мошенничества, спама и вредоносной активности;</li>
									<li>техническая поддержка пользователей;</li>
									<li>улучшение работы Сервиса и исправление ошибок;</li>
									<li>выполнение требований законодательства Российской Федерации.</li>
								</ul>

								<p className={styles['privacy-paragraph']}>
									Мы не используем ваш контент для рекламы и не передаём его для обучения систем искусственного интеллекта.
								</p>
							</div>
						</section>

						<section className={styles['privacy-section']}>
							<h2 className={styles['privacy-section__title']}>3. Правовые основания обработки</h2>

							<div className={styles['privacy-section__content']}>
								<p className={styles['privacy-paragraph']}>
									Обработка персональных данных осуществляется на следующих основаниях (ст. 6 Федерального закона № 152-ФЗ):
								</p>

								<ul className={styles['privacy-list']}>
									<li>согласие пользователя на обработку персональных данных;</li>
									<li>исполнение пользовательского соглашения (Условий использования);</li>
									<li>законные интересы Оператора: обеспечение безопасности Сервиса, предотвращение злоупотреблений, улучшение функционала;</li>
									<li>исполнение обязанностей, возложенных на Оператора законодательством РФ.</li>
								</ul>
							</div>
						</section>

						<section className={styles['privacy-section']}>
							<h2 className={styles['privacy-section__title']}>4. Личные сообщения</h2>

							<div className={styles['privacy-section__content']}>
								<p className={styles['privacy-paragraph']}>
									<strong>4.1.</strong> Сервис предоставляет возможность обмена личными сообщениями и общения в приватных группах.
								</p>

								<p className={styles['privacy-paragraph']}>
									<strong>4.2.</strong> Личные сообщения обрабатываются исключительно для:
								</p>

								<ul className={styles['privacy-list']}>
									<li>доставки сообщений получателю;</li>
									<li>синхронизации истории между устройствами пользователя;</li>
									<li>технического хранения и резервного копирования;</li>
									<li>работы систем безопасности и антиспам-фильтров;</li>
									<li>исполнения требований законодательства.</li>
								</ul>

								<p className={styles['privacy-paragraph']}>
									<strong>4.3.</strong> Сотрудники Администрации не просматривают личные сообщения, за исключением случаев:
								</p>

								<ul className={styles['privacy-list']}>
									<li>поступила жалоба на нарушение Условий использования;</li>
									<li>обнаружена угроза безопасности или вредоносная активность;</li>
									<li>получен законный запрос уполномоченных государственных органов.</li>
								</ul>

								<p className={styles['privacy-paragraph']}>
									<strong>4.4.</strong> Личные сообщения могут проходить автоматическую техническую обработку (антиспам-проверка, анализ вредоносных ссылок, фильтрация опасного контента).
								</p>

								<p className={styles['privacy-paragraph']}>
									<strong>4.5.</strong> После удаления аккаунта сообщения в групповых чатах и на серверах других пользователей могут сохраняться для целостности дискуссий. Сообщения в приватных диалогах могут быть удалены или обезличены.
								</p>
							</div>
						</section>

						<section className={styles['privacy-section']}>
							<h2 className={styles['privacy-section__title']}>5. Хранение данных</h2>

							<div className={styles['privacy-section__content']}>
								<p className={styles['privacy-paragraph']}>
									<strong>5.1.</strong> Все персональные данные пользователей хранятся на серверах, расположенных на территории Российской Федерации, в соответствии с требованиями Федерального закона от 21.07.2014 № 242-ФЗ.
								</p>

								<p className={styles['privacy-paragraph']}>
									<strong>5.2.</strong> Данные хранятся в течение срока, необходимого для достижения целей обработки. При удалении аккаунта основные данные удаляются в разумный срок. Технические логи и данные, необходимые для исполнения закона, могут сохраняться дольше.
								</p>

								<p className={styles['privacy-paragraph']}>
									<strong>5.3.</strong> Резервные копии создаются регулярно для защиты от потери данных. Данные в резервных копиях удаляются по мере ротации копий.
								</p>
							</div>
						</section>

						<section className={styles['privacy-section']}>
							<h2 className={styles['privacy-section__title']}>6. Передача данных третьим лицам</h2>

							<div className={styles['privacy-section__content']}>
								<p className={styles['privacy-paragraph']}>
									<strong>6.1.</strong> Мы не продаём персональные данные пользователей.
								</p>

								<p className={styles['privacy-paragraph']}>
									<strong>6.2.</strong> Данные могут передаваться третьим лицам в следующих случаях:
								</p>

								<ul className={styles['privacy-list']}>
									<li>платёжным провайдерам — для обработки платежей за подписку;</li>
									<li>провайдерам хостинга и серверной инфраструктуры — для размещения и функционирования Сервиса;</li>
									<li>сторонним сервисам авторизации — если вы используете их для входа (только по вашему выбору);</li>
									<li>государственным органам — исключительно на основании законных официальных запросов.</li>
								</ul>

								<p className={styles['privacy-paragraph']}>
									<strong>6.3.</strong> Со всеми третьими лицами, получающими доступ к данным, заключаются соглашения об обеспечении конфиденциальности и защиты персональных данных.
								</p>
							</div>
						</section>

						<section className={styles['privacy-section']}>
							<h2 className={styles['privacy-section__title']}>7. Защита данных</h2>

							<div className={styles['privacy-section__content']}>
								<p className={styles['privacy-paragraph']}>
									Мы применяем технические и организационные меры для защиты ваших данных:
								</p>

								<ul className={styles['privacy-list']}>
									<li>шифрование данных при передаче (TLS);</li>
									<li>хеширование паролей;</li>
									<li>разграничение и контроль доступа;</li>
									<li>защита от атак и несанкционированного доступа;</li>
									<li>регулярное резервное копирование;</li>
									<li>мониторинг инфраструктуры.</li>
								</ul>

								<p className={styles['privacy-paragraph']}>
									В случае обнаружения утечки персональных данных мы уведомим уполномоченный орган (Роскомнадзор) в установленные законом сроки и примем меры для минимизации последствий.
								</p>
							</div>
						</section>

						<section className={styles['privacy-section']}>
							<h2 className={styles['privacy-section__title']}>8. Cookie и аналогичные технологии</h2>

							<div className={styles['privacy-section__content']}>
								<p className={styles['privacy-paragraph']}>
									Сервис использует:
								</p>

								<ul className={styles['privacy-list']}>
									<li>технические cookie — для работы Сервиса;</li>
									<li>cookie авторизации — для поддержания сессии;</li>
									<li>локальное хранилище браузера — для сохранения пользовательских настроек.</li>
								</ul>

								<p className={styles['privacy-paragraph']}>
									Мы не используем рекламные или отслеживающие cookie третьих лиц. Отключение cookie может привести к ограничению функционала Сервиса.
								</p>
							</div>
						</section>

						<section className={styles['privacy-section']}>
							<h2 className={styles['privacy-section__title']}>9. Ваши права</h2>

							<div className={styles['privacy-section__content']}>
								<p className={styles['privacy-paragraph']}>
									В соответствии с законодательством РФ вы имеете право:
								</p>

								<ul className={styles['privacy-list']}>
									<li>получить информацию об обработке ваших персональных данных;</li>
									<li>потребовать уточнения, блокирования или уничтожения ваших данных;</li>
									<li>отозвать согласие на обработку персональных данных;</li>
									<li>удалить свой аккаунт и связанные с ним данные;</li>
									<li>обратиться с жалобой в Роскомнадзор.</li>
								</ul>

								<p className={styles['privacy-paragraph']}>
									Для реализации своих прав направьте запрос на адрес электронной почты: help@floodilka.com. Мы рассмотрим ваш запрос в течение 10 рабочих дней.
								</p>
							</div>
						</section>

						<section className={styles['privacy-section']}>
							<h2 className={styles['privacy-section__title']}>10. Дети и несовершеннолетние</h2>

							<div className={styles['privacy-section__content']}>
								<p className={styles['privacy-paragraph']}>
									Сервис не предназначен для лиц младше 13 лет. Мы сознательно не собираем персональные данные детей младше этого возраста. Если нам станет известно, что аккаунт принадлежит лицу младше 13 лет, такой аккаунт будет удалён.
								</p>

								<p className={styles['privacy-paragraph']}>
									Лица в возрасте от 13 до 18 лет могут использовать Сервис с согласия родителей или законных представителей.
								</p>
							</div>
						</section>

						<section className={styles['privacy-section']}>
							<h2 className={styles['privacy-section__title']}>11. Запросы государственных органов</h2>

							<div className={styles['privacy-section__content']}>
								<p className={styles['privacy-paragraph']}>
									<strong>11.1.</strong> Мы предоставляем данные пользователей государственным органам только при наличии законного официального запроса, оформленного в соответствии с требованиями законодательства РФ.
								</p>

								<p className={styles['privacy-paragraph']}>
									<strong>11.2.</strong> Неофициальные, некорректно оформленные или необоснованные запросы не рассматриваются.
								</p>
							</div>
						</section>

						<section className={styles['privacy-section']}>
							<h2 className={styles['privacy-section__title']}>12. Изменения Политики</h2>

							<div className={styles['privacy-section__content']}>
								<p className={styles['privacy-paragraph']}>
									Мы можем обновлять настоящую Политику. О существенных изменениях мы уведомим вас не менее чем за 30 дней до их вступления в силу — через уведомление в Сервисе или по электронной почте.
								</p>

								<p className={styles['privacy-paragraph']}>
									Дата последней редакции указывается в начале документа. Продолжение использования Сервиса после вступления изменений в силу означает ваше согласие с обновлённой Политикой.
								</p>
							</div>
						</section>

						<section className={styles['privacy-section']}>
							<h2 className={styles['privacy-section__title']}>13. Контактная информация</h2>

							<div className={styles['privacy-section__content']}>
								<p className={styles['privacy-paragraph']}>
									Оператор персональных данных: ИП Тенгизов Эльдар Азаматович
								</p>

								<p className={styles['privacy-paragraph']}>
									ИНН: 070106943754
								</p>

								<p className={styles['privacy-paragraph']}>
									ОГРНИП: 326070000007930
								</p>

								<p className={styles['privacy-paragraph']}>
									Электронная почта: help@floodilka.com
								</p>

								<p className={styles['privacy-paragraph']}>
									По всем вопросам, связанным с обработкой персональных данных, обращайтесь по указанному адресу электронной почты.
								</p>
							</div>
						</section>
					</div>
				</main>

				<LandingFooter />
			</div>
		</div>
	);
};

export default PrivacyPage;
