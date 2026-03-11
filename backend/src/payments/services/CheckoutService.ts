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
			JsonData: {paymentId, productType: product.type},
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
			throw new PaymentError(result.Message || 'Payment declined');
		}

		const token = result.Model.Token;
		if (!token) {
			Logger.error({userId, transactionId: result.Model.TransactionId}, 'No token returned from charge');
			throw new PaymentError('Payment processed but card token not received');
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
			throw new PaymentError('Invalid gift duration');
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
			JsonData: {paymentId, productType: product.type, isGift: true},
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
			throw new PaymentError(result.Message || 'Payment declined');
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
			throw new UnclaimedAccountRestrictedError('make purchases');
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
