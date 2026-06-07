/*
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright (C) 2020-2026 Fluxer Contributors
 * Copyright (C) 2026 Floodilka Contributors
 * Modified by Floodilka Contributors starting March 2026. See LICENSE and NOTICE.
 */

import type {UserID} from '~/BrandedTypes';
import {UserFlags} from '~/Constants';
import {PaymentError, PremiumPurchaseBlockedError, UnclaimedAccountRestrictedError, UnknownUserError} from '~/Errors';
import {Logger} from '~/Logger';
import type {User} from '~/Models';
import type {IUserRepository} from '~/user/IUserRepository';
import type {CloudPaymentsClient} from '../CloudPaymentsClient';
import {rublesToKopecks} from '../PaymentUtils';
import {type ProductInfo, getProductForGift, getProductForSubscription} from '../ProductRegistry';

const FIRST_REFUND_BLOCK_DAYS = 30;

export interface ChargeParams {
	userId: UserID;
	cryptogram: string;
	billingCycle: 'monthly' | 'yearly';
	name?: string;
	ipAddress: string;
}

export interface GiftChargeParams {
	userId: UserID;
	cryptogram: string;
	durationMonths: 1 | 12;
	name?: string;
	ipAddress: string;
}

export class CheckoutService {
	constructor(
		private client: CloudPaymentsClient,
		private userRepository: IUserRepository,
	) {}

	async chargeSubscription({userId, cryptogram, billingCycle, name, ipAddress}: ChargeParams): Promise<{
		transactionId: number;
		token: string;
		product: ProductInfo;
	}> {
		const user = await this.userRepository.findUnique(userId);
		if (!user) {
			throw new UnknownUserError();
		}

		this.validateUserCanPurchase(user);

		const product = getProductForSubscription(billingCycle);

		const paymentId = crypto.randomUUID();

		await this.userRepository.createPayment({
			payment_id: paymentId,
			user_id: userId,
			product_type: product.type,
			amount_cents: rublesToKopecks(product.amountRub),
			currency: 'RUB',
			status: 'pending',
			is_gift: false,
			created_at: new Date(),
		});

		const result = await this.client.charge({
			Amount: product.amountRub,
			Currency: 'RUB',
			IpAddress: ipAddress,
			CardCryptogramPacket: cryptogram,
			Name: name,
			AccountId: userId.toString(),
			Description: `Floodilka Premium — ${billingCycle === 'yearly' ? 'Годовая' : 'Месячная'} подписка`,
			JsonData: {
				paymentId,
				productType: product.type,
				plan: billingCycle,
				billing_cycle: billingCycle,
				duration_months: product.durationMonths,
				isGift: false,
			},
		});

		if (!result.Success || !result.Model) {
			await this.userRepository.updatePayment({
				payment_id: paymentId,
				user_id: userId,
				product_type: product.type,
				amount_cents: rublesToKopecks(product.amountRub),
				currency: 'RUB',
				status: 'failed',
				is_gift: false,
				created_at: new Date(),
			});
			Logger.error({userId, message: result.Message}, 'CloudPayments charge failed');
			throw new PaymentError(result.Message || 'Платёж отклонён');
		}

		const token = result.Model.Token;
		if (!token) {
			Logger.error({userId, transactionId: result.Model.TransactionId}, 'No token returned from charge');
			throw new PaymentError('Платёж обработан, но токен карты не получен');
		}

		await this.userRepository.updatePayment({
			payment_id: paymentId,
			user_id: userId,
			cloudpayments_transaction_id: result.Model.TransactionId != null ? BigInt(result.Model.TransactionId) : null,
			product_type: product.type,
			amount_cents: rublesToKopecks(product.amountRub),
			currency: 'RUB',
			status: 'completed',
			is_gift: false,
			completed_at: new Date(),
			created_at: new Date(),
		});

		await this.userRepository.patchUpsert(userId, {
			cloudpayments_token: token,
			has_ever_purchased: true,
		});

		Logger.debug(
			{userId, transactionId: result.Model.TransactionId, billingCycle},
			'Subscription charge successful',
		);

		return {transactionId: result.Model.TransactionId, token, product};
	}

	async chargeGift({userId, cryptogram, durationMonths, name, ipAddress}: GiftChargeParams): Promise<{
		transactionId: number;
		paymentId: string;
		product: ProductInfo;
	}> {
		const user = await this.userRepository.findUnique(userId);
		if (!user) {
			throw new UnknownUserError();
		}

		this.validateUserCanPurchase(user);

		const product = getProductForGift(durationMonths);
		if (!product) {
			throw new PaymentError('Неверный срок подарка');
		}

		const paymentId = crypto.randomUUID();

		await this.userRepository.createPayment({
			payment_id: paymentId,
			user_id: userId,
			product_type: product.type,
			amount_cents: rublesToKopecks(product.amountRub),
			currency: 'RUB',
			status: 'pending',
			is_gift: true,
			created_at: new Date(),
		});

		const result = await this.client.charge({
			Amount: product.amountRub,
			Currency: 'RUB',
			IpAddress: ipAddress,
			CardCryptogramPacket: cryptogram,
			Name: name,
			AccountId: userId.toString(),
			Description: `Floodilka Premium — Подарочный код (${durationMonths === 12 ? '1 год' : '1 месяц'})`,
			JsonData: {
				paymentId,
				productType: product.type,
				plan: durationMonths === 12 ? 'gift1Year' : 'gift1Month',
				duration_months: product.durationMonths,
				isGift: true,
			},
		});

		if (!result.Success || !result.Model) {
			await this.userRepository.updatePayment({
				payment_id: paymentId,
				user_id: userId,
				product_type: product.type,
				amount_cents: rublesToKopecks(product.amountRub),
				currency: 'RUB',
				status: 'failed',
				is_gift: true,
				created_at: new Date(),
			});
			Logger.error({userId, message: result.Message}, 'CloudPayments gift charge failed');
			throw new PaymentError(result.Message || 'Платёж отклонён');
		}

		await this.userRepository.updatePayment({
			payment_id: paymentId,
			user_id: userId,
			cloudpayments_transaction_id: result.Model.TransactionId != null ? BigInt(result.Model.TransactionId) : null,
			product_type: product.type,
			amount_cents: rublesToKopecks(product.amountRub),
			currency: 'RUB',
			status: 'completed',
			is_gift: true,
			completed_at: new Date(),
			created_at: new Date(),
		});

		await this.userRepository.patchUpsert(userId, {
			has_ever_purchased: true,
		});

		Logger.debug(
			{userId, transactionId: result.Model.TransactionId, durationMonths},
			'Gift charge successful',
		);

		return {transactionId: result.Model.TransactionId, paymentId, product};
	}

	validateUserCanPurchase(user: User): void {
		if (user.isUnclaimedAccount()) {
			throw new UnclaimedAccountRestrictedError('совершать покупки');
		}

		if (user.flags & UserFlags.PREMIUM_PURCHASE_DISABLED) {
			throw new PremiumPurchaseBlockedError();
		}

		if (user.firstRefundAt) {
			const daysSinceFirstRefund = Math.floor((Date.now() - user.firstRefundAt.getTime()) / (1000 * 60 * 60 * 24));
			if (daysSinceFirstRefund < FIRST_REFUND_BLOCK_DAYS) {
				throw new PremiumPurchaseBlockedError();
			}
		}
	}
}
