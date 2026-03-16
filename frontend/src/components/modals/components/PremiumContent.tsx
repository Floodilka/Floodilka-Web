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
import {CrownIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import React from 'react';
import {GuildFeatures} from '~/Constants';
import {Spinner} from '~/components/uikit/Spinner';
import {ComponentDispatch} from '~/lib/ComponentDispatch';
import GeoIPStore from '~/stores/GeoIPStore';
import GuildStore from '~/stores/GuildStore';
import MobileLayoutStore from '~/stores/MobileLayoutStore';
import UserStore from '~/stores/UserStore';
import * as LocaleUtils from '~/utils/LocaleUtils';
import {formatPrice} from '~/utils/PricingUtils';
import {FeatureComparisonTable} from './FeatureComparisonTable';
import styles from './PremiumContent.module.css';
import {PurchaseDisclaimer} from './PurchaseDisclaimer';
import {BottomCTASection} from './premium/BottomCTASection';
import {GiftInventoryBanner} from './premium/GiftInventoryBanner';
import {GiftSection} from './premium/GiftSection';
import {useCheckoutActions} from './premium/hooks/useCheckoutActions';
import {useCommunityActions} from './premium/hooks/useCommunityActions';
import {usePremiumData} from './premium/hooks/usePremiumData';
import {useSubscriptionActions} from './premium/hooks/useSubscriptionActions';
import {useSubscriptionStatus} from './premium/hooks/useSubscriptionStatus';
import {PremiumUpsellBanner} from './premium/PremiumUpsellBanner';
import {PricingSection} from './premium/PricingSection';
import {PurchaseHistorySection} from './premium/PurchaseHistorySection';
import {SectionHeader} from './premium/SectionHeader';
import {SubscriptionCard} from './premium/SubscriptionCard';
import {Slate} from './Slate';

export const PremiumContent: React.FC<{defaultGiftMode?: boolean}> = observer(({defaultGiftMode = false}) => {
	const {t} = useLingui();
	const currentUser = UserStore.currentUser;
	const locale = LocaleUtils.getCurrentLocale();
	const formatter = new Intl.NumberFormat(locale);
	const mobileLayoutState = MobileLayoutStore;

	const [isGiftMode, setIsGiftMode] = React.useState(defaultGiftMode);
	const giftSectionRef = React.useRef<HTMLDivElement | null>(null);
	const perksSectionRef = React.useRef<HTMLDivElement | null>(null);

	const countryCode = GeoIPStore.countryCode;
	const guilds = GuildStore.getGuilds();

	const operatorGuild = React.useMemo(() => {
		return guilds.find((guild) => guild.features.has(GuildFeatures.OPERATOR));
	}, [guilds]);

	const subscriptionStatus = useSubscriptionStatus(currentUser);
	const {priceIds, loadingPrices, pricesError} = usePremiumData(countryCode);
	const {
		loadingPortal,
		loadingCancel,
		loadingReactivate,
		handleOpenCustomerPortal,
		handleCancelSubscription,
		handleReactivateSubscription,
	} = useSubscriptionActions();
	const {
		loadingRejoinCommunity,
		isCommunityMenuOpen,
		communityButtonRef,
		handleCommunityButtonPointerDown,
		handleCommunityButtonClick,
	} = useCommunityActions(operatorGuild);
	const {loadingCheckout, handleSelectPlan} = useCheckoutActions(
		priceIds,
		subscriptionStatus.isGiftSubscription,
		mobileLayoutState.enabled,
	);

	const isClaimed = currentUser?.isClaimed() ?? false;
	const purchaseDisabled = !isClaimed;
	const purchaseDisabledTooltip = <Trans>Claim your account to purchase Floodilka Premium.</Trans>;
	const handleSelectPlanGuarded = React.useCallback(
		(plan: 'monthly' | 'yearly' | 'gift1Month' | 'gift1Year') => {
			if (purchaseDisabled) return;
			handleSelectPlan(plan);
		},
		[handleSelectPlan, purchaseDisabled],
	);

	const monthlyPrice = React.useMemo(() => (priceIds ? formatPrice(priceIds.monthly) : '...'), [priceIds]);
	const yearlyPrice = React.useMemo(() => (priceIds ? formatPrice(priceIds.yearly) : '...'), [priceIds]);

	const scrollToPerks = React.useCallback(() => {
		perksSectionRef.current?.scrollIntoView({behavior: 'smooth', block: 'start'});
	}, []);

	const handlePerksKeyDown = React.useCallback(
		(event: React.KeyboardEvent<HTMLSpanElement>) => {
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				scrollToPerks();
			}
		},
		[scrollToPerks],
	);

	const navigateToRedeemGift = React.useCallback(() => {
		ComponentDispatch.dispatch('USER_SETTINGS_TAB_SELECT', {tab: 'gift_inventory'});
	}, []);

	if (!currentUser) return null;

	if (defaultGiftMode) {
		return (
			<div className={styles.giftModeContainer}>
				<PremiumUpsellBanner />

				<GiftSection
					giftSectionRef={giftSectionRef}
					monthlyPrice={monthlyPrice}
					yearlyPrice={yearlyPrice}
					loadingCheckout={loadingCheckout}
					loadingSlots={loadingPrices}
					handleSelectPlan={handleSelectPlan}
				/>

				<div ref={perksSectionRef}>
					<section className={styles.perksSection}>
						<SectionHeader title={<Trans>Free vs Premium</Trans>} />
						<div className={styles.comparisonTableContainer}>
							<FeatureComparisonTable formatter={formatter} />
						</div>
					</section>
				</div>
			</div>
		);
	}

	return (
		<div className={styles.mainContainer}>
			<GiftInventoryBanner currentUser={currentUser} />

			<div className={styles.header}>
				<div className={styles.iconContainer}>
					<img src="/badges/premium.svg" alt="" className={styles.icon} />
				</div>
				<h1 className={styles.title}>
					<Trans>Floodilka Premium</Trans>
				</h1>
				<p className={styles.description}>
					<Trans>
						Unlock higher limits and exclusive features while supporting an independent communication platform.
					</Trans>
				</p>
			</div>

			{subscriptionStatus.hasEverPurchased && (
				<PurchaseHistorySection loadingPortal={loadingPortal} handleOpenCustomerPortal={handleOpenCustomerPortal} />
			)}

			{subscriptionStatus.shouldShowPremiumCard && (
				<section className={styles.subscriptionSection}>
					<SubscriptionCard
						currentUser={currentUser}
						locale={locale}
						isGiftSubscription={subscriptionStatus.isGiftSubscription}
						billingCycle={subscriptionStatus.billingCycle}
						monthlyPrice={monthlyPrice}
						yearlyPrice={yearlyPrice}
						gracePeriodInfo={subscriptionStatus.gracePeriodInfo}
						premiumWillCancel={subscriptionStatus.premiumWillCancel}
						subscriptionCardColorClass={subscriptionStatus.subscriptionCardColorClass}
						subscriptionStatusColor={subscriptionStatus.subscriptionStatusColor}
						hasEverPurchased={subscriptionStatus.hasEverPurchased}
						shouldUseCancelQuickAction={subscriptionStatus.shouldUseCancelQuickAction}
						shouldUseReactivateQuickAction={subscriptionStatus.shouldUseReactivateQuickAction}
						loadingPortal={loadingPortal}
						loadingCancel={loadingCancel}
						loadingReactivate={loadingReactivate}
						loadingRejoinCommunity={loadingRejoinCommunity}
						loadingCheckout={loadingCheckout}
						isCommunityMenuOpen={isCommunityMenuOpen}
						communityButtonRef={communityButtonRef}
						scrollToPerks={scrollToPerks}
						handlePerksKeyDown={handlePerksKeyDown}
						navigateToRedeemGift={navigateToRedeemGift}
						handleOpenCustomerPortal={handleOpenCustomerPortal}
						handleReactivateSubscription={handleReactivateSubscription}
						handleCancelSubscription={handleCancelSubscription}
						handleCommunityButtonPointerDown={handleCommunityButtonPointerDown}
						handleCommunityButtonClick={handleCommunityButtonClick}
						purchaseDisabled={purchaseDisabled}
						purchaseDisabledTooltip={purchaseDisabledTooltip}
					/>
					<div className={styles.disclaimerContainer}>
						<PurchaseDisclaimer align="center" isPremium />
					</div>
				</section>
			)}

			{!subscriptionStatus.shouldShowPremiumCard ? (
				<PricingSection
					isGiftMode={isGiftMode}
					setIsGiftMode={setIsGiftMode}
					monthlyPrice={monthlyPrice}
					yearlyPrice={yearlyPrice}
					loadingCheckout={loadingCheckout}
					loadingSlots={loadingPrices}
					handleSelectPlan={handleSelectPlanGuarded}
					purchaseDisabled={purchaseDisabled}
					purchaseDisabledTooltip={purchaseDisabledTooltip}
				/>
			) : (
				<GiftSection
					giftSectionRef={giftSectionRef}
					monthlyPrice={monthlyPrice}
					yearlyPrice={yearlyPrice}
					loadingCheckout={loadingCheckout}
					loadingSlots={loadingPrices}
					handleSelectPlan={handleSelectPlanGuarded}
					purchaseDisabled={purchaseDisabled}
					purchaseDisabledTooltip={purchaseDisabledTooltip}
				/>
			)}

			<div ref={perksSectionRef}>
				<section className={styles.perksSection}>
					<SectionHeader title={<Trans>Free vs Premium</Trans>} />
					<div className={styles.comparisonTableContainer}>
						<FeatureComparisonTable formatter={formatter} />
					</div>
				</section>
			</div>

			{!subscriptionStatus.isPremium && (
				<BottomCTASection
					isGiftMode={isGiftMode}
					monthlyPrice={monthlyPrice}
					yearlyPrice={yearlyPrice}
					loadingCheckout={loadingCheckout}
					handleSelectPlan={handleSelectPlanGuarded}
					purchaseDisabled={purchaseDisabled}
					purchaseDisabledTooltip={purchaseDisabledTooltip}
				/>
			)}
		</div>
	);
});
