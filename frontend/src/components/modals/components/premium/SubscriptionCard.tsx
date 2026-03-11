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

import {Trans, useLingui} from '@lingui/react/macro';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {Button} from '~/components/uikit/Button/Button';
import {Tooltip} from '~/components/uikit/Tooltip/Tooltip';
import type {UserRecord} from '~/records/UserRecord';
import {PerksButton} from '../PerksButton';
import type {GracePeriodInfo} from './hooks/useSubscriptionStatus';
import styles from './SubscriptionCard.module.css';

interface SubscriptionCardProps {
	currentUser: UserRecord;
	locale: string;
	isGiftSubscription: boolean;
	billingCycle: string | null;
	monthlyPrice: string;
	yearlyPrice: string;
	gracePeriodInfo: GracePeriodInfo;
	premiumWillCancel: boolean;
	subscriptionCardColorClass: string;
	subscriptionStatusColor: string;
	hasEverPurchased: boolean;
	shouldUseCancelQuickAction: boolean;
	shouldUseReactivateQuickAction: boolean;
	loadingPortal: boolean;
	loadingCancel: boolean;
	loadingReactivate: boolean;
	loadingRejoinCommunity: boolean;
	loadingCheckout: boolean;
	isCommunityMenuOpen: boolean;
	communityButtonRef: React.RefObject<HTMLButtonElement | null>;
	scrollToPerks: () => void;
	handlePerksKeyDown: (event: React.KeyboardEvent<HTMLSpanElement>) => void;
	navigateToRedeemGift: () => void;
	handleOpenCustomerPortal: () => void;
	handleReactivateSubscription: () => void;
	handleCancelSubscription: () => void;
	handleCommunityButtonPointerDown: (event: React.PointerEvent) => void;
	handleCommunityButtonClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
	purchaseDisabled?: boolean;
	purchaseDisabledTooltip?: React.ReactNode;
}

export const SubscriptionCard: React.FC<SubscriptionCardProps> = observer(
	({
		currentUser,
		locale,
		isGiftSubscription,
		billingCycle,
		monthlyPrice,
		yearlyPrice,
		gracePeriodInfo,
		premiumWillCancel,
		subscriptionCardColorClass,
		subscriptionStatusColor,
		hasEverPurchased,
		shouldUseCancelQuickAction,
		shouldUseReactivateQuickAction,
		loadingPortal,
		loadingCancel,
		loadingReactivate,
		loadingCheckout,
		scrollToPerks,
		handlePerksKeyDown,
		navigateToRedeemGift,
		handleOpenCustomerPortal,
		handleReactivateSubscription,
		handleCancelSubscription,
		purchaseDisabled = false,
		purchaseDisabledTooltip,
	}) => {
		const {t} = useLingui();
		const {isInGracePeriod, isExpired: isFullyExpired, graceEndDate} = gracePeriodInfo;
		const isPremium = currentUser.isPremium();
		const tooltipText: string | (() => React.ReactNode) =
			purchaseDisabledTooltip != null
				? () => purchaseDisabledTooltip
				: t`Claim your account to purchase or redeem Floodilka Premium.`;

		const wrapIfDisabled = (element: React.ReactElement, key: string, disabled: boolean) =>
			disabled ? (
				<Tooltip key={key} text={tooltipText}>
					<div>{element}</div>
				</Tooltip>
			) : (
				element
			);

		return (
			<div className={clsx(styles.card, subscriptionCardColorClass)}>
				<div className={styles.grid}>
					<div className={styles.content}>
						<div className={styles.header}>
							<h3 className={styles.title}>
								<Trans>Premium Subscription</Trans>
							</h3>
							<div className={styles.badge} style={{color: subscriptionStatusColor}}>
								{isFullyExpired ? (
									<Trans>Expired</Trans>
								) : isInGracePeriod ? (
									<Trans>Grace Period</Trans>
								) : premiumWillCancel ? (
									<Trans>Canceled</Trans>
								) : isGiftSubscription ? (
									<Trans>Gift</Trans>
								) : (
									<Trans>Active</Trans>
								)}
							</div>
						</div>

						<div className={styles.description}>
							{isFullyExpired ? (
								(() => {
									const expiredDate = graceEndDate?.toLocaleDateString(locale, {
										month: 'long',
										day: 'numeric',
										year: 'numeric',
									});
									return (
										<Trans>
											Your subscription expired on <strong>{expiredDate}</strong>. You lost all{' '}
											<PerksButton onClick={scrollToPerks} onKeyDown={handlePerksKeyDown} />. You can reactivate at any
											time.
										</Trans>
									);
								})()
							) : isInGracePeriod ? (
								(() => {
									const graceDate = graceEndDate?.toLocaleDateString(locale, {
										month: 'long',
										day: 'numeric',
										year: 'numeric',
									});
									return (
										<Trans>
											Your subscription ended, but you still have all{' '}
											<PerksButton onClick={scrollToPerks} onKeyDown={handlePerksKeyDown} /> until{' '}
											<strong>{graceDate}</strong>. Resubscribe to keep them.
										</Trans>
									);
								})()
							) : isGiftSubscription ? (
								(() => {
									const giftEndDate = new Date(currentUser.premiumUntil!).toLocaleDateString(locale, {
										month: 'long',
										day: 'numeric',
										year: 'numeric',
									});
									return (
										<>
											<Trans>
												You have all <PerksButton onClick={scrollToPerks} onKeyDown={handlePerksKeyDown} /> via a{' '}
												<strong>gift subscription</strong> until <strong>{giftEndDate}</strong>. It{' '}
												<strong>won't renew</strong>.
											</Trans>
											<br />
											<Trans>
												You can redeem additional gift codes to <strong>extend</strong> your gift time. To start a
												monthly or yearly plan, wait until after it ends.
											</Trans>
										</>
									);
								})()
							) : premiumWillCancel ? (
								(() => {
									const cancelDate = new Date(currentUser.premiumUntil!).toLocaleDateString(locale, {
										month: 'long',
										day: 'numeric',
										year: 'numeric',
									});
									return (
										<Trans>
											Your subscription will cancel on <strong>{cancelDate}</strong>. You'll lose all{' '}
											<PerksButton onClick={scrollToPerks} onKeyDown={handlePerksKeyDown} /> after that date.
										</Trans>
									);
								})()
							) : billingCycle === 'monthly' ? (
								<Trans>
									You have all <PerksButton onClick={scrollToPerks} onKeyDown={handlePerksKeyDown} /> for{' '}
									<strong>{monthlyPrice}/month</strong>.
								</Trans>
							) : billingCycle === 'yearly' ? (
								<Trans>
									You have all <PerksButton onClick={scrollToPerks} onKeyDown={handlePerksKeyDown} /> for{' '}
									<strong>{yearlyPrice}/year</strong>.
								</Trans>
							) : (
								<Trans>
									You have all <PerksButton onClick={scrollToPerks} onKeyDown={handlePerksKeyDown} /> for your
									subscription period.
								</Trans>
							)}
						</div>

						{currentUser.premiumUntil &&
							!premiumWillCancel &&
							!isInGracePeriod &&
							!isFullyExpired &&
							!isGiftSubscription &&
							(() => {
								const renewalDate = new Date(currentUser.premiumUntil).toLocaleDateString(locale, {
									month: 'long',
									day: 'numeric',
									year: 'numeric',
								});
								return (
									<div className={styles.renewalInfo}>
										<Trans>
											Renews on <strong>{renewalDate}</strong>.
										</Trans>
									</div>
								);
							})()}
					</div>

					<div className={styles.actions}>
						{isGiftSubscription ? (
							<>
								{wrapIfDisabled(
									<Button
										variant="inverted"
										onClick={navigateToRedeemGift}
										small
										className={styles.actionButton}
										disabled={purchaseDisabled}
									>
										<Trans>Redeem Gift Code</Trans>
									</Button>,
									'redeem-gift',
									purchaseDisabled,
								)}
							</>
						) : (
							<>
								{hasEverPurchased &&
									wrapIfDisabled(
										<Button
											variant="inverted"
											onClick={shouldUseReactivateQuickAction ? handleReactivateSubscription : handleOpenCustomerPortal}
											submitting={shouldUseReactivateQuickAction ? loadingReactivate : loadingPortal}
											small
											className={styles.actionButton}
											disabled={purchaseDisabled && shouldUseReactivateQuickAction}
										>
											{isFullyExpired ? (
												<Trans>Resubscribe</Trans>
											) : isInGracePeriod ? (
												<Trans>Resubscribe</Trans>
											) : premiumWillCancel ? (
												<Trans>Reactivate</Trans>
											) : (
												<Trans>Manage Subscription</Trans>
											)}
										</Button>,
										'manage-reactivate',
										purchaseDisabled && shouldUseReactivateQuickAction,
									)}

								{shouldUseCancelQuickAction && (
									<Button
										variant="inverted"
										onClick={handleCancelSubscription}
										submitting={loadingCancel}
										small
										className={styles.actionButton}
									>
										<Trans>Cancel</Trans>
									</Button>
								)}
							</>
						)}
					</div>
				</div>
			</div>
		);
	},
);
