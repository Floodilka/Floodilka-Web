/*
 * Copyright (C) 2026 Floodilka Contributors
 *
 * This file is part of Floodilka.
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

import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useLocation} from '~/lib/router';
import {Routes} from '~/Routes';
import MobileLayoutStore from '~/stores/MobileLayoutStore';
import UserStore from '~/stores/UserStore';
import styles from './GuildNavbar.module.css';
import {UserArea} from './UserArea';

interface GuildSidebarProps {
	header: React.ReactNode;
	content: React.ReactNode;
	roundTopLeft?: boolean;
}

export const GuildSidebar = observer(({header, content, roundTopLeft = true}: GuildSidebarProps) => {
	const mobileLayout = MobileLayoutStore;
	const location = useLocation();
	const user = UserStore.currentUser;

	const showBottomNav =
		mobileLayout.enabled &&
		(location.pathname === Routes.ME ||
			location.pathname === Routes.NOTIFICATIONS ||
			location.pathname === Routes.YOU ||
			(Routes.isGuildChannelRoute(location.pathname) && location.pathname.split('/').length === 3));

	return (
		<div
			className={clsx(
				styles.guildNavbarContainer,
				mobileLayout.enabled && styles.guildNavbarContainerMobile,
				showBottomNav && styles.guildNavbarReserveMobileBottomNav,
			)}
			style={roundTopLeft ? undefined : {borderTopLeftRadius: 0}}
		>
			{header}
			{content}
			{!mobileLayout.enabled && user && (
				<div className={styles.userAreaSlot}>
					<UserArea user={user} />
				</div>
			)}
		</div>
	);
});
