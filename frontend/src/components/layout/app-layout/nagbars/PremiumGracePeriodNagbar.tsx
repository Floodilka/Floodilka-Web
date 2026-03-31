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

import {Trans} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import * as NagbarActionCreators from '~/actions/NagbarActionCreators';
import {Nagbar} from '~/components/layout/Nagbar';
import {NagbarButton} from '~/components/layout/NagbarButton';
import {NagbarContent} from '~/components/layout/NagbarContent';
import {ComponentDispatch} from '~/lib/ComponentDispatch';
import UserStore from '~/stores/UserStore';
import * as LocaleUtils from '~/utils/LocaleUtils';

export const PremiumGracePeriodNagbar = observer(({isMobile}: {isMobile: boolean}) => {
	const user = UserStore.currentUser;

	const handleNavigateToPremium = () => {
		ComponentDispatch.dispatch('USER_SETTINGS_TAB_SELECT', {tab: 'premium'});
	};

	const handleDismiss = () => {
		NagbarActionCreators.dismissNagbar('premiumGracePeriodDismissed');
	};

	if (!user?.premiumUntil || user?.premiumWillCancel) return null;

	const expiryDate = new Date(user.premiumUntil);
	const gracePeriodMs = 3 * 24 * 60 * 60 * 1000;
	const graceEndDate = new Date(expiryDate.getTime() + gracePeriodMs);
	const locale = LocaleUtils.getCurrentLocale();

	const formattedGraceDate = graceEndDate.toLocaleDateString(locale, {
		month: 'long',
		day: 'numeric',
		year: 'numeric',
	});

	return (
		<Nagbar isMobile={isMobile} backgroundColor="#f97316" textColor="#ffffff" dismissible onDismiss={handleDismiss}>
			<NagbarContent
				isMobile={isMobile}
				message={
					<Trans>
						Your subscription failed to renew, but you still have access to Premium perks until{' '}
						<strong>{formattedGraceDate}</strong>. Take action now or you'll lose all perks.
					</Trans>
				}
				actions={
					<>
						{isMobile && (
							<NagbarButton isMobile={isMobile} onClick={handleDismiss}>
								<Trans>Dismiss</Trans>
							</NagbarButton>
						)}
						<NagbarButton isMobile={isMobile} onClick={handleNavigateToPremium}>
							<Trans>Manage Subscription</Trans>
						</NagbarButton>
					</>
				}
			/>
		</Nagbar>
	);
});
