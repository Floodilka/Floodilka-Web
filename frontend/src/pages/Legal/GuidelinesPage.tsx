import {useEffect, useLayoutEffect} from 'react';
import {LandingHeader} from '~/pages/Landing/components/LandingHeader';
import {LandingFooter} from '~/pages/Landing/components/LandingFooter';
import {useMenu} from '~/pages/Landing/hooks/useMenu';
import styles from './GuidelinesPage.module.css';

const GuidelinesPage = () => {
	const {menuOpen, toggleMenu, closeMenu} = useMenu();

	useEffect(() => {
		document.title = 'Правила сообщества — Флудилка';

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
		<div className={styles['guidelines-page']}>
			<div className={styles['guidelines-page__container']}>
				<LandingHeader
					menuOpen={menuOpen}
					onToggleMenu={toggleMenu}
					onCloseMenu={closeMenu}
					platform="desktop"
				/>

				<main className={styles['guidelines-main']}>
					<div className={styles['guidelines-content']}>
						<h1 className={styles['guidelines-title']}>Правила сообщества</h1>

						<p className={styles['guidelines-updated']}>
							Дата последнего обновления: 1 марта 2026
						</p>

						<div className={styles['guidelines-intro']}>
							<p>
								Флудилка — это платформа для общения, совместного времяпрепровождения и создания сообществ. Настоящие Правила помогают сделать её комфортной и безопасной для всех. Они являются частью Условий использования, и их нарушение может привести к предупреждению, удалению контента, ограничению функций или блокировке аккаунта.
							</p>
							<p>
								Правила распространяются на все взаимодействия внутри платформы: личные сообщения, общение на серверах, голосовые и видеозвонки, профили, статусы и любые другие формы контента.
							</p>
							<p>
								Владельцы серверов могут устанавливать собственные правила, но они не должны противоречить настоящим Правилам и Условиям использования.
							</p>
						</div>

						<section className={styles['guidelines-section']}>
							<h2 className={styles['guidelines-section__title']}>Главный принцип</h2>

							<div className={styles['guidelines-section__content']}>
								<p className={styles['guidelines-paragraph']}>
									<strong>Относитесь к другим так, как хотели бы, чтобы относились к вам.</strong> За каждым аватаром и никнеймом стоит живой человек. Помните об этом.
								</p>
							</div>
						</section>

						<section className={styles['guidelines-section']}>
							<h2 className={styles['guidelines-section__title']}>1. Уважительное общение</h2>

							<div className={styles['guidelines-section__content']}>
								<p className={styles['guidelines-paragraph']}>
									Мы хотим, чтобы Флудилка была местом, где каждому приятно находиться. Вы можете помочь этому:
								</p>

								<ul className={styles['guidelines-list']}>
									<li><strong>Исходите из добрых намерений.</strong> Если что-то показалось вам неоднозначным — уточните, прежде чем реагировать.</li>
									<li><strong>Спорьте по существу.</strong> Критикуйте идеи, а не людей. Несогласие — это нормально, переход на личности — нет.</li>
									<li><strong>Помогайте новичкам.</strong> Объясняйте правила вашего сервера, вместо того чтобы сразу наказывать.</li>
									<li><strong>Берегите приватность</strong> — свою и чужую. Не делитесь персональной информацией без согласия.</li>
									<li><strong>Сообщайте о нарушениях.</strong> Если видите что-то опасное или неприемлемое — используйте функцию жалобы, а не устраивайте самосуд.</li>
								</ul>
							</div>
						</section>

						<section className={styles['guidelines-section']}>
							<h2 className={styles['guidelines-section__title']}>2. Запрещённое поведение</h2>

							<div className={styles['guidelines-section__content']}>
								<p className={styles['guidelines-paragraph']}>
									Следующие действия запрещены на всей платформе. Серверы могут вводить более строгие правила, но не более мягкие.
								</p>

								<h3 className={styles['guidelines-subsection__title']}>2.1. Травля и преследование</h3>

								<p className={styles['guidelines-paragraph']}>
									Запрещено заниматься травлей, буллингом или угрожать кому-либо. Это включает:
								</p>

								<ul className={styles['guidelines-list']}>
									<li>систематическое преследование или координированные атаки на человека или группу;</li>
									<li>угрозы любого характера — прямые или завуалированные;</li>
									<li>публикацию чужих персональных данных (доксинг) без согласия;</li>
									<li>навязчивые сообщения после просьбы прекратить;</li>
									<li>сексуальные домогательства в любой форме;</li>
									<li>подстрекательство других к агрессии в чей-либо адрес.</li>
								</ul>

								<h3 className={styles['guidelines-subsection__title']}>2.2. Ненависть и дискриминация</h3>

								<p className={styles['guidelines-paragraph']}>
									Мы не допускаем разжигания ненависти или дискриминации по любому признаку: раса, национальность, религия, пол, гендерная идентичность, сексуальная ориентация, инвалидность, возраст или иные характеристики. Это касается оскорбительных высказываний, унижающих символов и призывов к насилию или изоляции.
								</p>

								<h3 className={styles['guidelines-subsection__title']}>2.3. Насилие и шокирующий контент</h3>

								<p className={styles['guidelines-paragraph']}>
									Запрещено распространять:
								</p>

								<ul className={styles['guidelines-list']}>
									<li>натуралистичные изображения насилия, жестокости или членовредительства;</li>
									<li>контент, пропагандирующий или инструктирующий самоповреждение или суицид;</li>
									<li>инструкции по совершению насильственных или противоправных действий;</li>
									<li>материалы, прославляющие терроризм или экстремизм.</li>
								</ul>

								<p className={styles['guidelines-paragraph']}>
									Художественные и вымышленные изображения насилия (рисунки, анимация, игры) допустимы в соответствующих пространствах с возрастной маркировкой, если они не выдаются за реальные события и не направлены против конкретных людей.
								</p>

								<h3 className={styles['guidelines-subsection__title']}>2.4. Сексуальный контент и защита несовершеннолетних</h3>

								<p className={styles['guidelines-paragraph']}>
									У нас действует абсолютная нетерпимость к сексуальной эксплуатации детей.
								</p>

								<ul className={styles['guidelines-list']}>
									<li><strong>Пользователи до 18 лет</strong> не имеют права размещать, распространять или взаимодействовать с сексуальным контентом.</li>
									<li><strong>Любые материалы</strong> сексуального характера с участием несовершеннолетних (включая сгенерированные ИИ или нарисованные) строго запрещены и будут переданы в правоохранительные органы.</li>
									<li><strong>Груминг</strong> — выстраивание отношений с несовершеннолетним с целью сексуальной эксплуатации — запрещён, даже если откровенный контент не задействован.</li>
									<li><strong>Контент 18+</strong> разрешён только в явно маркированных пространствах с возрастным ограничением.</li>
									<li><strong>Интимные материалы без согласия</strong> — распространение интимных изображений или видео кого-либо без их согласия, включая дипфейки, категорически запрещено.</li>
								</ul>

								<h3 className={styles['guidelines-subsection__title']}>2.5. Противоправная деятельность</h3>

								<p className={styles['guidelines-paragraph']}>
									Запрещено использовать Флудилку для содействия, продвижения или участия в незаконной деятельности:
								</p>

								<ul className={styles['guidelines-list']}>
									<li>распространение вредоносного ПО, вирусов или фишинговых материалов;</li>
									<li>мошенничество, обман и финансовые схемы;</li>
									<li>торговля запрещёнными товарами или веществами;</li>
									<li>взлом, несанкционированный доступ или кибератаки;</li>
									<li>систематическое нарушение авторских прав;</li>
									<li>любая иная деятельность, нарушающая законодательство РФ.</li>
								</ul>

								<h3 className={styles['guidelines-subsection__title']}>2.6. Спам и злоупотребление платформой</h3>

								<p className={styles['guidelines-paragraph']}>
									Запрещено:
								</p>

								<ul className={styles['guidelines-list']}>
									<li>рассылка спама, массовых или нежелательных коммерческих сообщений;</li>
									<li>создание фейковых аккаунтов или выдача себя за других;</li>
									<li>искусственная накрутка участников, реакций или метрик;</li>
									<li>покупка, продажа или обмен аккаунтами и серверами;</li>
									<li>использование ботов и скриптов для обхода ограничений, сбора данных или нарушения работы платформы.</li>
								</ul>

								<h3 className={styles['guidelines-subsection__title']}>2.7. Опасная дезинформация</h3>

								<p className={styles['guidelines-paragraph']}>
									Запрещено намеренно распространять ложную информацию, которая может:
								</p>

								<ul className={styles['guidelines-list']}>
									<li>угрожать здоровью или безопасности людей;</li>
									<li>препятствовать демократическим процессам;</li>
									<li>причинить реальный физический вред;</li>
									<li>нанести ущерб критически важной инфраструктуре.</li>
								</ul>

								<h3 className={styles['guidelines-subsection__title']}>2.8. Нарушение приватности</h3>

								<p className={styles['guidelines-paragraph']}>
									Уважайте право на частную жизнь. Запрещено:
								</p>

								<ul className={styles['guidelines-list']}>
									<li>записывать голосовые или видеозвонки без согласия участников;</li>
									<li>обходить настройки приватности, блокировки и механизмы защиты;</li>
									<li>следить за пользователями или собирать информацию о них без разрешения.</li>
								</ul>
							</div>
						</section>

						<section className={styles['guidelines-section']}>
							<h2 className={styles['guidelines-section__title']}>3. Ответственность владельцев серверов</h2>

							<div className={styles['guidelines-section__content']}>
								<p className={styles['guidelines-paragraph']}>
									Если вы создаёте или администрируете сервер:
								</p>

								<ul className={styles['guidelines-list']}>
									<li>вы отвечаете за контент и поведение в вашем сообществе;</li>
									<li>установите чёткие и понятные правила, соответствующие настоящим Правилам;</li>
									<li>используйте инструменты модерации: роли, разрешения, возрастные ограничения;</li>
									<li>оперативно реагируйте на жалобы и нарушения;</li>
									<li>вы можете вводить более строгие правила, но не более мягкие, чем наши.</li>
								</ul>

								<p className={styles['guidelines-paragraph']}>
									Систематическое игнорирование серьёзных нарушений может привести к ограничению или удалению сервера, а также к мерам в отношении вашего аккаунта.
								</p>
							</div>
						</section>

						<section className={styles['guidelines-section']}>
							<h2 className={styles['guidelines-section__title']}>4. Как сообщить о нарушении</h2>

							<div className={styles['guidelines-section__content']}>
								<p className={styles['guidelines-paragraph']}>
									Если вы столкнулись с контентом или поведением, нарушающим эти Правила:
								</p>

								<ul className={styles['guidelines-list']}>
									<li>используйте встроенные инструменты жалоб в приложении;</li>
									<li>напишите нам на help@floodilka.com.</li>
								</ul>

								<p className={styles['guidelines-paragraph']}>
									По возможности приложите скриншоты, ссылки на контент и краткое описание ситуации. Не занимайтесь «самоуправством» — не преследуйте и не угрожайте нарушителям. Передайте информацию нам, и мы разберёмся.
								</p>
							</div>
						</section>

						<section className={styles['guidelines-section']}>
							<h2 className={styles['guidelines-section__title']}>5. Меры воздействия</h2>

							<div className={styles['guidelines-section__content']}>
								<p className={styles['guidelines-paragraph']}>
									При выявлении нарушений мы можем применить одну или несколько мер:
								</p>

								<ul className={styles['guidelines-list']}>
									<li>предупреждение;</li>
									<li>удаление контента;</li>
									<li>временное ограничение функций или доступа;</li>
									<li>временная блокировка аккаунта;</li>
									<li>постоянная блокировка аккаунта;</li>
									<li>удаление сервера;</li>
									<li>передача информации в правоохранительные органы.</li>
								</ul>

								<p className={styles['guidelines-paragraph']}>
									Мера определяется исходя из тяжести нарушения, намерений пользователя, истории предыдущих нарушений и потенциального вреда. Как правило, мы начинаем с предупреждений, однако за грубые нарушения (материалы с участием несовершеннолетних, реальные угрозы насилия, масштабные злоупотребления) следует немедленная блокировка.
								</p>
							</div>
						</section>

						<section className={styles['guidelines-section']}>
							<h2 className={styles['guidelines-section__title']}>6. Обжалование</h2>

							<div className={styles['guidelines-section__content']}>
								<p className={styles['guidelines-paragraph']}>
									Если вы считаете, что решение о модерации было ошибочным, вы можете подать апелляцию:
								</p>

								<ul className={styles['guidelines-list']}>
									<li>направьте письмо на help@floodilka.com с адреса, привязанного к вашему аккаунту;</li>
									<li>укажите, какое именно решение вы обжалуете и почему считаете его неверным;</li>
									<li>приложите любой контекст или доказательства.</li>
								</ul>

								<p className={styles['guidelines-paragraph']}>
									Апелляцию необходимо подать в течение 60 дней с момента получения уведомления. Мы рассмотрим её в течение 14 рабочих дней. На время рассмотрения принятые меры, как правило, остаются в силе.
								</p>
							</div>
						</section>

						<section className={styles['guidelines-section']}>
							<h2 className={styles['guidelines-section__title']}>7. Безопасность несовершеннолетних</h2>

							<div className={styles['guidelines-section__content']}>
								<p className={styles['guidelines-paragraph']}>
									Минимальный возраст для использования Флудилки — 13 лет. Пользователи от 13 до 18 лет могут использовать платформу с согласия родителей или опекунов.
								</p>

								<ul className={styles['guidelines-list']}>
									<li>Для пользователей младше 18 лет могут быть включены дополнительные защитные функции.</li>
									<li>Доступ к контенту 18+ для несовершеннолетних ограничен.</li>
									<li>Серверы, направленные на романтические знакомства между несовершеннолетними или их сексуализацию, запрещены.</li>
								</ul>

								<p className={styles['guidelines-paragraph']}>
									Если вы младше 18 лет — будьте особенно осторожны с личной информацией и не встречайтесь с людьми из интернета без участия взрослого, которому вы доверяете.
								</p>
							</div>
						</section>

						<section className={styles['guidelines-section']}>
							<h2 className={styles['guidelines-section__title']}>8. Психическое здоровье</h2>

							<div className={styles['guidelines-section__content']}>
								<p className={styles['guidelines-paragraph']}>
									Поддерживающие разговоры о ментальном здоровье допускаются, но категорически запрещено:
								</p>

								<ul className={styles['guidelines-list']}>
									<li>пропагандировать, поощрять или давать инструкции по самоповреждению или суициду;</li>
									<li>давить на кого-либо или подталкивать к причинению себе вреда;</li>
									<li>стыдить или атаковать людей, переживающих трудности.</li>
								</ul>

								<p className={styles['guidelines-paragraph']}>
									Если вы видите, что кому-то угрожает непосредственная опасность — сообщите об этом через систему жалоб и, если возможно, предложите человеку обратиться за профессиональной помощью. Флудилка не является заменой экстренных служб или профессиональной психологической помощи.
								</p>
							</div>
						</section>

						<section className={styles['guidelines-section']}>
							<h2 className={styles['guidelines-section__title']}>9. Изменения Правил</h2>

							<div className={styles['guidelines-section__content']}>
								<p className={styles['guidelines-paragraph']}>
									Мы можем обновлять настоящие Правила по мере развития платформы и изменения законодательства. О существенных изменениях мы уведомим вас не менее чем за 30 дней — через уведомление в приложении или по электронной почте. Продолжение использования Флудилки после вступления изменений в силу означает ваше согласие с обновлёнными Правилами.
								</p>
							</div>
						</section>

						<section className={styles['guidelines-section']}>
							<h2 className={styles['guidelines-section__title']}>10. Контакты</h2>

							<div className={styles['guidelines-section__content']}>
								<p className={styles['guidelines-paragraph']}>
									По любым вопросам, связанным с правилами сообщества: help@floodilka.com
								</p>

								<p className={styles['guidelines-paragraph']}>
									Если вы или кто-то рядом находится в непосредственной опасности — сначала обратитесь в местные экстренные службы, а затем сообщите нам.
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

export default GuidelinesPage;
