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

import type {AuthService} from '~/auth/AuthService';
import type {UserID} from '~/BrandedTypes';
import {Config} from '~/Config';
import type {ICacheService} from '~/infrastructure/ICacheService';
import type {IEmailService} from '~/infrastructure/IEmailService';
import type {IGatewayService} from '~/infrastructure/IGatewayService';
import type {GiftCode} from '~/Models';
import type {IUserRepository} from '~/user/IUserRepository';
import {CloudPaymentsClient} from './CloudPaymentsClient';
import {initializeProductPrices} from './ProductRegistry';
import type {ChargeParams, GiftChargeParams} from './services/CheckoutService';
import {CheckoutService} from './services/CheckoutService';
import {GiftService} from './services/GiftService';
import {PremiumService} from './services/PremiumService';
import {SubscriptionService} from './services/SubscriptionService';
import type {HandleWebhookParams} from './services/WebhookService';
import {WebhookService} from './services/WebhookService';

export class PaymentService {
	private client: CloudPaymentsClient | null = null;
	private checkoutService!: CheckoutService;
	private subscriptionService!: SubscriptionService;
	private giftService!: GiftService;
	private premiumService!: PremiumService;
	private webhookService!: WebhookService;

	constructor(
		private userRepository: IUserRepository,
		private authService: AuthService,
		private gatewayService: IGatewayService,
		private emailService: IEmailService,
		private cacheService: ICacheService,
	) {
		if (Config.cloudpayments.enabled && Config.cloudpayments.publicId && Config.cloudpayments.apiSecret) {
			this.client = new CloudPaymentsClient(Config.cloudpayments.publicId, Config.cloudpayments.apiSecret);

			if (Config.cloudpayments.prices) {
				initializeProductPrices(Config.cloudpayments.prices);
			}
		}

		this.premiumService = new PremiumService(this.userRepository, this.gatewayService);

		this.checkoutService = new CheckoutService(this.client!, this.userRepository);

		this.subscriptionService = new SubscriptionService(this.client!, this.userRepository, this.gatewayService);

		this.giftService = new GiftService(
			this.userRepository,
			this.cacheService,
			this.gatewayService,
			this.checkoutService,
			this.premiumService,
		);

		this.webhookService = new WebhookService(
			this.userRepository,
			this.authService,
			this.emailService,
			this.gatewayService,
			this.premiumService,
			this.giftService,
			this.subscriptionService,
		);
	}

	async chargeSubscription(params: ChargeParams): Promise<void> {
		const {token, product} = await this.checkoutService.chargeSubscription(params);

		await this.subscriptionService.createSubscription(params.userId, token, params.billingCycle);

		await this.premiumService.grantPremium(params.userId, product.durationMonths, params.billingCycle, true);
	}

	async chargeGift(params: GiftChargeParams): Promise<void> {
		const {transactionId, paymentId, product} = await this.checkoutService.chargeGift(params);

		const user = await this.userRepository.findUnique(params.userId);
		if (!user) return;

		await this.giftService.createGiftCode(paymentId, user, product, transactionId);
	}

	getPrices(): {
		monthly: number;
		yearly: number;
		gift1Month: number;
		gift1Year: number;
		currency: 'RUB';
		publicId: string;
	} {
		const prices = Config.cloudpayments.prices;
		return {
			monthly: prices?.monthlyRub ?? 0,
			yearly: prices?.yearlyRub ?? 0,
			gift1Month: prices?.gift1MonthRub ?? 0,
			gift1Year: prices?.gift1YearRub ?? 0,
			currency: 'RUB',
			publicId: Config.cloudpayments.publicId ?? '',
		};
	}

	async cancelSubscriptionAtPeriodEnd(userId: UserID): Promise<void> {
		return this.subscriptionService.cancelSubscriptionAtPeriodEnd(userId);
	}

	async reactivateSubscription(userId: UserID): Promise<void> {
		return this.subscriptionService.reactivateSubscription(userId);
	}

	async getGiftCode(code: string): Promise<GiftCode> {
		return this.giftService.getGiftCode(code);
	}

	async redeemGiftCode(userId: UserID, code: string): Promise<void> {
		return this.giftService.redeemGiftCode(userId, code);
	}

	async getUserGifts(userId: UserID): Promise<Array<GiftCode>> {
		return this.giftService.getUserGifts(userId);
	}

	async handleWebhook(params: HandleWebhookParams): Promise<{code: number}> {
		return this.webhookService.handleWebhook(params);
	}
}
