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

import React from 'react';
import type {UserRecord} from '~/records/UserRecord';
import styles from '../SubscriptionCard.module.css';

export interface GracePeriodInfo {
	isInGracePeriod: boolean;
	isExpired: boolean;
	graceEndDate: Date | null;
	showExpiredState: boolean;
}

export interface SubscriptionStatusInfo {
	isPremium: boolean;
	hasEverPurchased: boolean;
	premiumWillCancel: boolean;
	billingCycle: string | null;
	isGiftSubscription: boolean;
	gracePeriodInfo: GracePeriodInfo;
	shouldShowPremiumCard: boolean;
	subscriptionCardColorClass: string;
	subscriptionStatusColor: string;
	shouldUseCancelQuickAction: boolean;
	shouldUseReactivateQuickAction: boolean;
}

export const useSubscriptionStatus = (currentUser: UserRecord | null): SubscriptionStatusInfo => {
	const isPremium = currentUser?.isPremium() ?? false;
	const hasEverPurchased = currentUser?.hasEverPurchased ?? false;
	const premiumWillCancel = currentUser?.premiumWillCancel ?? false;
	const billingCycle = currentUser?.premiumBillingCycle ?? null;

	const isGiftSubscription = Boolean(!billingCycle && isPremium && currentUser?.premiumUntil);

	const gracePeriodInfo = React.useMemo((): GracePeriodInfo => {
		if (!currentUser?.premiumUntil || premiumWillCancel) {
			return {isInGracePeriod: false, isExpired: false, graceEndDate: null, showExpiredState: false};
		}
		const now = new Date();
		const expiryDate = new Date(currentUser.premiumUntil);
		const gracePeriodMs = 3 * 24 * 60 * 60 * 1000;
		const expiredStateDurationMs = 30 * 24 * 60 * 60 * 1000;
		const graceEndDate = new Date(expiryDate.getTime() + gracePeriodMs);
		const expiredStateEndDate = new Date(expiryDate.getTime() + expiredStateDurationMs);
		const isInGracePeriod = now > expiryDate && now <= graceEndDate;
		const isExpired = now > graceEndDate;
		const showExpiredState = isExpired && now <= expiredStateEndDate;
		return {isInGracePeriod, isExpired, graceEndDate, showExpiredState};
	}, [currentUser?.premiumUntil, premiumWillCancel]);

	const {isInGracePeriod, isExpired: isFullyExpired, showExpiredState} = gracePeriodInfo;
	const shouldShowPremiumCard = isPremium || isInGracePeriod || showExpiredState;

	const subscriptionCardColorClass = React.useMemo(() => {
		if (isFullyExpired) return styles.cardExpired;
		if (isInGracePeriod) return styles.cardGracePeriod;
		if (premiumWillCancel) return styles.cardGracePeriod;
		return styles.cardActive;
	}, [isInGracePeriod, isFullyExpired, premiumWillCancel]);

	const subscriptionStatusColor = React.useMemo(() => {
		if (isFullyExpired) return 'var(--status-danger)';
		if (isInGracePeriod) return 'rgb(249 115 22)';
		if (premiumWillCancel) return 'rgb(249 115 22)';
		return 'var(--status-online)';
	}, [isInGracePeriod, isFullyExpired, premiumWillCancel]);

	const shouldUseCancelQuickAction =
		!isInGracePeriod && !isFullyExpired && !premiumWillCancel && !isGiftSubscription;
	const shouldUseReactivateQuickAction =
		premiumWillCancel && !isInGracePeriod && !isFullyExpired && !isGiftSubscription;

	return {
		isPremium,
		hasEverPurchased,
		premiumWillCancel,
		billingCycle,
		isGiftSubscription,
		gracePeriodInfo,
		shouldShowPremiumCard,
		subscriptionCardColorClass,
		subscriptionStatusColor,
		shouldUseCancelQuickAction,
		shouldUseReactivateQuickAction,
	};
};
