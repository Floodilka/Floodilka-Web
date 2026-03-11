/*
 * Copyright (C) 2026 Fluxer Contributors
 *
 * This file is part of Fluxer.
 *
 * Fluxer is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Fluxer is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Fluxer. If not, see <https://www.gnu.org/licenses/>.
 */

import {useLingui} from '@lingui/react/macro';
import React from 'react';
import type {Prices} from '~/actions/PremiumActionCreators';
import * as ToastActionCreators from '~/actions/ToastActionCreators';
import {Logger} from '~/lib/Logger';
import UserStore from '~/stores/UserStore';
import {openCheckoutWidget, openGiftCheckoutWidget} from '~/utils/cloudpayments';

const logger = new Logger('useCheckoutActions');

type Plan = 'monthly' | 'yearly' | 'gift1Month' | 'gift1Year';

export const useCheckoutActions = (prices: Prices | null, isGiftSubscription: boolean, _mobileEnabled: boolean) => {
	const {t} = useLingui();
	const [loadingCheckout, setLoadingCheckout] = React.useState(false);

	const handleSelectPlan = React.useCallback(
		async (plan: Plan) => {
			if (loadingCheckout) return;

			logger.info('Plan selected', {plan, isGiftSubscription});

			if (isGiftSubscription && (plan === 'monthly' || plan === 'yearly')) {
				ToastActionCreators.error(
					t`You're currently on a gift subscription. It won't renew. You can redeem more gift codes to extend it. Recurring subscriptions can be started after your gift time ends.`,
				);
				return;
			}

			if (!prices) {
				logger.error('Prices not loaded yet');
				ToastActionCreators.error(t`Please wait for pricing information to load.`);
				return;
			}

			if (!prices.publicId) {
				logger.error('CloudPayments public ID not configured');
				ToastActionCreators.error(t`Payment processing is not yet available. Please try again later.`);
				return;
			}

			const currentUser = UserStore.currentUser;
			if (!currentUser) {
				logger.error('No current user');
				return;
			}

			setLoadingCheckout(true);
			try {
				const isGift = plan === 'gift1Month' || plan === 'gift1Year';

				const amountRubles = (() => {
					switch (plan) {
						case 'monthly':
							return prices.monthly;
						case 'yearly':
							return prices.yearly;
						case 'gift1Month':
							return prices.gift1Month;
						case 'gift1Year':
							return prices.gift1Year;
					}
				})();

				const description = isGift
					? t`Floodilka Premium Gift`
					: t`Floodilka Premium Subscription`;

				if (isGift) {
					const result = await openGiftCheckoutWidget({
						publicId: prices.publicId,
						description,
						amountRubles,
						accountId: String(currentUser.id),
						metadata: {
							plan,
							duration_months: plan === 'gift1Year' ? 12 : 1,
						},
					});

					if (result.success) {
						ToastActionCreators.success(t`Gift purchased successfully!`);
					} else if (result.failReason) {
						ToastActionCreators.error(t`Payment failed. Please try again.`);
					}
				} else {
					const billingCycle = plan === 'yearly' ? 'yearly' : 'monthly';

					const result = await openCheckoutWidget({
						publicId: prices.publicId,
						description,
						amountRubles,
						accountId: String(currentUser.id),
						billingCycle,
						metadata: {
							plan,
							billing_cycle: billingCycle,
						},
					});

					if (result.success) {
						ToastActionCreators.success(t`Subscription activated successfully!`);
					} else if (result.failReason) {
						ToastActionCreators.error(t`Payment failed. Please try again.`);
					}
				}
			} catch (error) {
				logger.error('Failed to initiate checkout', error);
				ToastActionCreators.error(t`Failed to start checkout. Please try again.`);
			} finally {
				setLoadingCheckout(false);
			}
		},
		[loadingCheckout, prices, isGiftSubscription, t],
	);

	return {
		loadingCheckout,
		handleSelectPlan,
	};
};
