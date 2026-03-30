import {useEffect, useLayoutEffect} from 'react';
import {useSEO} from '~/hooks/useSEO';
import {LandingHeader} from '~/pages/Landing/components/LandingHeader';
import {LandingFooter} from '~/pages/Landing/components/LandingFooter';
import {useMenu} from '~/pages/Landing/hooks/useMenu';
import styles from './TermsPage.module.css';

const TermsPage = () => {
	const {menuOpen, toggleMenu, closeMenu} = useMenu();

	useSEO({
		title: 'Условия использования — Флудилка',
		description: 'Условия использования платформы Флудилка — голосового мессенджера для геймеров.',
		canonicalPath: '/terms',
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
		<div className={styles['terms-page']}>
			<div className={styles['terms-page__container']}>
				<LandingHeader
					menuOpen={menuOpen}
					onToggleMenu={toggleMenu}
					onCloseMenu={closeMenu}
					platform="desktop"
				/>

				<main className={styles['terms-main']}>
					<div className={styles['terms-content']}>
						<h1 className={styles['terms-title']}>Условия использования</h1>

						<p className={styles['terms-updated']}>
							Дата последнего обновления: 1 марта 2026
						</p>

						<div className={styles['terms-intro']}>
							<p>
								Настоящие Условия использования (далее — «Условия») являются юридически обязательным соглашением между вами и ИП Тенгизовым Эльдаром Азаматовичем (ИНН 070106943754, ОГРНИП 326070000007930), далее — «Администрация», «мы».
							</p>
							<p>
								Используя сервис «Флудилка» (далее — «Сервис»), вы подтверждаете согласие с настоящими Условиями. Если вы не согласны — прекратите использование Сервиса.
							</p>
						</div>

						<section className={styles['terms-section']}>
							<h2 className={styles['terms-section__title']}>1. О Сервисе</h2>

							<div className={styles['terms-section__content']}>
								<p className={styles['terms-paragraph']}>
									<strong>1.1.</strong> «Флудилка» — коммуникационная онлайн-платформа для обмена сообщениями, создания серверов и каналов, голосовой и видеосвязи, загрузки пользовательского контента.
								</p>

								<p className={styles['terms-paragraph']}>
									<strong>1.2.</strong> Сервис предоставляется на условиях «как есть» (as is) и «как доступно» (as available). Мы не гарантируем бесперебойную работу, но стремимся обеспечить стабильность и доступность Сервиса.
								</p>

								<p className={styles['terms-paragraph']}>
									<strong>1.3.</strong> Мы вправе обновлять, изменять или дополнять функционал Сервиса в любое время.
								</p>
							</div>
						</section>

						<section className={styles['terms-section']}>
							<h2 className={styles['terms-section__title']}>2. Регистрация и аккаунт</h2>

							<div className={styles['terms-section__content']}>
								<p className={styles['terms-paragraph']}>
									<strong>2.1.</strong> Для использования Сервиса необходимо создать аккаунт с помощью электронной почты или сторонних сервисов авторизации.
								</p>

								<p className={styles['terms-paragraph']}>
									<strong>2.2.</strong> Вы обязаны предоставить достоверные данные и обеспечить безопасность своего аккаунта. Все действия, совершённые через ваш аккаунт, считаются вашими действиями.
								</p>

								<p className={styles['terms-paragraph']}>
									<strong>2.3.</strong> Сервис не предназначен для лиц младше 13 лет. Лица от 13 до 18 лет могут использовать Сервис с согласия родителей или законных представителей.
								</p>

								<p className={styles['terms-paragraph']}>
									<strong>2.4.</strong> Администрация вправе приостановить или удалить аккаунт при нарушении настоящих Условий, подозрении на злоупотребление, вредоносную активность или по требованию закона.
								</p>
							</div>
						</section>

						<section className={styles['terms-section']}>
							<h2 className={styles['terms-section__title']}>3. Правила поведения</h2>

							<div className={styles['terms-section__content']}>
								<p className={styles['terms-paragraph']}>
									<strong>3.1.</strong> Сервис придерживается политики нулевой толерантности к оскорбительному, угрожающему, дискриминационному поведению и размещению незаконного контента.
								</p>

								<p className={styles['terms-paragraph']}>
									<strong>3.2.</strong> Запрещено:
								</p>

								<ul className={styles['terms-list']}>
									<li>публиковать контент, нарушающий законодательство РФ или права третьих лиц;</li>
									<li>распространять вредоносное ПО, фишинговые материалы или эксплойты;</li>
									<li>осуществлять спам-рассылки;</li>
									<li>пытаться обойти технические ограничения или получить несанкционированный доступ к инфраструктуре;</li>
									<li>выдавать себя за других пользователей или Администрацию;</li>
									<li>распространять материалы экстремистского характера, порнографию, сцены насилия;</li>
									<li>преследовать, травить или угрожать другим пользователям;</li>
									<li>создавать препятствия работе Сервиса.</li>
								</ul>

								<p className={styles['terms-paragraph']}>
									<strong>3.3.</strong> Нарушение правил поведения может повлечь предупреждение, ограничение функций, временную блокировку или удаление аккаунта.
								</p>
							</div>
						</section>

						<section className={styles['terms-section']}>
							<h2 className={styles['terms-section__title']}>4. Пользовательский контент</h2>

							<div className={styles['terms-section__content']}>
								<p className={styles['terms-paragraph']}>
									<strong>4.1.</strong> Вы несёте полную ответственность за контент, который публикуете, передаёте или загружаете через Сервис.
								</p>

								<p className={styles['terms-paragraph']}>
									<strong>4.2.</strong> Вы сохраняете права на свой контент. Размещая контент в Сервисе, вы предоставляете Администрации неэксклюзивную, безвозмездную лицензию на срок функционирования Сервиса на хранение, обработку и отображение этого контента в рамках работы Сервиса.
								</p>

								<p className={styles['terms-paragraph']}>
									<strong>4.3.</strong> Мы не используем ваш контент для рекламы и не передаём его для обучения систем искусственного интеллекта.
								</p>

								<p className={styles['terms-paragraph']}>
									<strong>4.4.</strong> Администрация вправе удалить контент, нарушающий настоящие Условия или законодательство, без предварительного уведомления.
								</p>

								<p className={styles['terms-paragraph']}>
									<strong>4.5.</strong> Вы подтверждаете, что обладаете всеми необходимыми правами на размещение вашего контента.
								</p>
							</div>
						</section>

						<section className={styles['terms-section']}>
							<h2 className={styles['terms-section__title']}>5. Серверы и сообщества</h2>

							<div className={styles['terms-section__content']}>
								<p className={styles['terms-paragraph']}>
									<strong>5.1.</strong> Создатель сервера несёт ответственность за его содержание, модерацию и соблюдение настоящих Условий и закона всеми участниками.
								</p>

								<p className={styles['terms-paragraph']}>
									<strong>5.2.</strong> Создатель сервера обязан оперативно реагировать на жалобы и нарушения в своём сообществе.
								</p>

								<p className={styles['terms-paragraph']}>
									<strong>5.3.</strong> Администрация вправе ограничить, скрыть или удалить сервер при нарушении Условий.
								</p>
							</div>
						</section>

						<section className={styles['terms-section']}>
							<h2 className={styles['terms-section__title']}>6. Платные услуги</h2>

							<div className={styles['terms-section__content']}>
								<p className={styles['terms-paragraph']}>
									<strong>6.1.</strong> Сервис предлагает платную подписку «Флудилка Премиум», предоставляющую доступ к дополнительным функциям.
								</p>

								<p className={styles['terms-paragraph']}>
									<strong>6.2.</strong> Подписка оформляется на выбранный период (месяц или год) и продлевается автоматически. Вы можете отменить автопродление в любой момент — подписка останется активной до конца оплаченного периода.
								</p>

								<p className={styles['terms-paragraph']}>
									<strong>6.3.</strong> Оплата осуществляется через платёжного провайдера. Данные банковских карт не хранятся на наших серверах.
								</p>

								<p className={styles['terms-paragraph']}>
									<strong>6.4.</strong> Повышение цен на подписку не затрагивает текущий оплаченный период. О повышении цен мы уведомим вас не менее чем за 30 дней.
								</p>

								<p className={styles['terms-paragraph']}>
									<strong>6.5.</strong> Возврат средств возможен в течение 14 дней с момента оплаты, если вы не воспользовались платными функциями. Для запроса возврата обратитесь по адресу help@floodilka.com.
								</p>

								<p className={styles['terms-paragraph']}>
									<strong>6.6.</strong> При блокировке аккаунта за нарушение Условий возврат средств за подписку не производится.
								</p>

								<p className={styles['terms-paragraph']}>
									<strong>6.7.</strong> Подарочные подписки возврату не подлежат после активации.
								</p>
							</div>
						</section>

						<section className={styles['terms-section']}>
							<h2 className={styles['terms-section__title']}>7. Модерация</h2>

							<div className={styles['terms-section__content']}>
								<p className={styles['terms-paragraph']}>
									<strong>7.1.</strong> Модерация осуществляется автоматически и вручную.
								</p>

								<p className={styles['terms-paragraph']}>
									<strong>7.2.</strong> Администрация вправе: удалять контент, ограничивать функции, временно блокировать доступ, удалять аккаунты и сообщества.
								</p>

								<p className={styles['terms-paragraph']}>
									<strong>7.3.</strong> Меры модерации применяются пропорционально тяжести нарушения. Как правило, мы начинаем с предупреждения, за исключением грубых нарушений, при которых возможна немедленная блокировка.
								</p>

								<p className={styles['terms-paragraph']}>
									<strong>7.4.</strong> Если вы не согласны с решением модерации, вы можете подать апелляцию, направив письмо на help@floodilka.com в течение 30 дней. Мы рассмотрим обращение в течение 14 рабочих дней.
								</p>
							</div>
						</section>

						<section className={styles['terms-section']}>
							<h2 className={styles['terms-section__title']}>8. Боты, API и автоматизация</h2>

							<div className={styles['terms-section__content']}>
								<p className={styles['terms-paragraph']}>
									<strong>8.1.</strong> Использование ботов, интеграций и автоматизированных скриптов допускается при условии соблюдения настоящих Условий.
								</p>

								<p className={styles['terms-paragraph']}>
									<strong>8.2.</strong> Вы несёте ответственность за действия ботов, созданных вами или подключённых к вашему серверу.
								</p>

								<p className={styles['terms-paragraph']}>
									<strong>8.3.</strong> Администрация вправе ограничить или отключить автоматизированные интеграции, нарушающие работу Сервиса.
								</p>
							</div>
						</section>

						<section className={styles['terms-section']}>
							<h2 className={styles['terms-section__title']}>9. Конфиденциальность</h2>

							<div className={styles['terms-section__content']}>
								<p className={styles['terms-paragraph']}>
									Обработка персональных данных осуществляется в соответствии с Политикой конфиденциальности, являющейся неотъемлемой частью настоящих Условий. Ознакомьтесь с ней перед использованием Сервиса.
								</p>
							</div>
						</section>

						<section className={styles['terms-section']}>
							<h2 className={styles['terms-section__title']}>10. Авторские права</h2>

							<div className={styles['terms-section__content']}>
								<p className={styles['terms-paragraph']}>
									<strong>10.1.</strong> Если вы считаете, что ваши авторские права нарушены контентом в Сервисе, направьте уведомление на help@floodilka.com с указанием: описание объекта прав, ссылка на нарушающий контент, ваши контактные данные и подтверждение правообладания.
								</p>

								<p className={styles['terms-paragraph']}>
									<strong>10.2.</strong> Администрация рассмотрит обращение и при подтверждении нарушения удалит спорный контент.
								</p>

								<p className={styles['terms-paragraph']}>
									<strong>10.3.</strong> Заведомо ложные жалобы могут повлечь ответственность в соответствии с законодательством РФ.
								</p>
							</div>
						</section>

						<section className={styles['terms-section']}>
							<h2 className={styles['terms-section__title']}>11. Использование бренда</h2>

							<div className={styles['terms-section__content']}>
								<p className={styles['terms-paragraph']}>
									Использование названия, логотипов и фирменного стиля «Флудилка» без письменного согласия Администрации запрещено.
								</p>
							</div>
						</section>

						<section className={styles['terms-section']}>
							<h2 className={styles['terms-section__title']}>12. Ограничение ответственности</h2>

							<div className={styles['terms-section__content']}>
								<p className={styles['terms-paragraph']}>
									<strong>12.1.</strong> Администрация не несёт ответственности за:
								</p>

								<ul className={styles['terms-list']}>
									<li>действия пользователей и пользовательский контент;</li>
									<li>временную недоступность Сервиса;</li>
									<li>утрату данных, вызванную обстоятельствами вне нашего контроля;</li>
									<li>действия сторонних сервисов.</li>
								</ul>

								<p className={styles['terms-paragraph']}>
									<strong>12.2.</strong> В максимальной степени, допускаемой законодательством РФ, совокупная ответственность Администрации перед пользователем не превышает сумму, уплаченную пользователем за последние 12 месяцев использования платных услуг Сервиса, либо 5 000 рублей — в зависимости от того, что меньше.
								</p>

								<p className={styles['terms-paragraph']}>
									<strong>12.3.</strong> Данные ограничения не затрагивают права, предоставленные вам законодательством РФ о защите прав потребителей, которые не могут быть ограничены договором.
								</p>
							</div>
						</section>

						<section className={styles['terms-section']}>
							<h2 className={styles['terms-section__title']}>13. Форс-мажор</h2>

							<div className={styles['terms-section__content']}>
								<p className={styles['terms-paragraph']}>
									Администрация не несёт ответственности за сбои, вызванные обстоятельствами непреодолимой силы: стихийные бедствия, аварии, действия государственных органов, отключение электроснабжения, сбои в работе сетей связи и иные обстоятельства вне контроля Администрации.
								</p>
							</div>
						</section>

						<section className={styles['terms-section']}>
							<h2 className={styles['terms-section__title']}>14. Удаление аккаунта</h2>

							<div className={styles['terms-section__content']}>
								<p className={styles['terms-paragraph']}>
									<strong>14.1.</strong> Вы можете удалить свой аккаунт в любое время через настройки Сервиса.
								</p>

								<p className={styles['terms-paragraph']}>
									<strong>14.2.</strong> После удаления аккаунта ваши сообщения в публичных каналах и на серверах других пользователей могут сохраняться для целостности дискуссий.
								</p>

								<p className={styles['terms-paragraph']}>
									<strong>14.3.</strong> Технические логи и данные, необходимые для исполнения закона, могут сохраняться после удаления аккаунта в соответствии с Политикой конфиденциальности.
								</p>

								<p className={styles['terms-paragraph']}>
									<strong>14.4.</strong> Неактивные аккаунты могут быть удалены после длительного периода неиспользования с предварительным уведомлением по электронной почте.
								</p>
							</div>
						</section>

						<section className={styles['terms-section']}>
							<h2 className={styles['terms-section__title']}>15. Применимое право</h2>

							<div className={styles['terms-section__content']}>
								<p className={styles['terms-paragraph']}>
									<strong>15.1.</strong> Настоящие Условия регулируются законодательством Российской Федерации.
								</p>

								<p className={styles['terms-paragraph']}>
									<strong>15.2.</strong> Споры разрешаются в порядке, предусмотренном законодательством РФ. До обращения в суд стороны предпринимают попытку досудебного урегулирования путём направления письменной претензии. Срок рассмотрения претензии — 30 дней.
								</p>
							</div>
						</section>

						<section className={styles['terms-section']}>
							<h2 className={styles['terms-section__title']}>16. Изменения Условий</h2>

							<div className={styles['terms-section__content']}>
								<p className={styles['terms-paragraph']}>
									Мы можем обновлять настоящие Условия. О существенных изменениях мы уведомим вас не менее чем за 30 дней до их вступления в силу — через уведомление в Сервисе или по электронной почте. Продолжение использования Сервиса после вступления изменений в силу означает ваше согласие с обновлёнными Условиями.
								</p>
							</div>
						</section>

						<section className={styles['terms-section']}>
							<h2 className={styles['terms-section__title']}>17. Контактная информация</h2>

							<div className={styles['terms-section__content']}>
								<p className={styles['terms-paragraph']}>
									ИП Тенгизов Эльдар Азаматович
								</p>

								<p className={styles['terms-paragraph']}>
									ИНН: 070106943754
								</p>

								<p className={styles['terms-paragraph']}>
									ОГРНИП: 326070000007930
								</p>

								<p className={styles['terms-paragraph']}>
									Электронная почта: help@floodilka.com
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

export default TermsPage;
