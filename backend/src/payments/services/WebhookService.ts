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
import {DeletionReasons, UserFlags} from '~/Constants';
import {PaymentError, WebhookVerificationError} from '~/Errors';
import type {IEmailService} from '~/infrastructure/IEmailService';
import type {IGatewayService} from '~/infrastructure/IGatewayService';
import {Logger} from '~/Logger';
import type {GiftCode, User} from '~/Models';
import type {IUserRepository} from '~/user/IUserRepository';
import {mapUserToPrivateResponse} from '~/user/UserModel';
import {verifyCloudPaymentsWebhook} from '../PaymentUtils';
import type {GiftService} from './GiftService';
import type {PremiumService} from './PremiumService';
import type {SubscriptionService} from './SubscriptionService';

export interface WebhookBody {
	TransactionId?: number;
	Amount?: number;
	Currency?: string;
	Status?: string;
	StatusCode?: number;
	AccountId?: string;
	Token?: string;
	SubscriptionId?: string;
	InvoiceId?: string;
	Data?: string;
}

export type WebhookType = 'check' | 'pay' | 'fail' | 'recurrent' | 'refund';

export interface HandleWebhookParams {
	type: WebhookType;
	body: string;
	signature: string;
	parsedBody: WebhookBody;
}

export class WebhookService {
	constructor(
		private userRepository: IUserRepository,
		private authService: AuthService,
		private emailService: IEmailService,
		private gatewayService: IGatewayService,
		private premiumService: PremiumService,
		private giftService: GiftService,
		private subscriptionService: SubscriptionService,
	) {}

	async handleWebhook({type, body, signature, parsedBody}: HandleWebhookParams): Promise<{code: number}> {
		if (!Config.cloudpayments.apiSecret) {
			throw new PaymentError('Webhook processing is not available');
		}

		if (!verifyCloudPaymentsWebhook(body, signature, Config.cloudpayments.apiSecret)) {
			throw new WebhookVerificationError();
		}

		Logger.debug({type, transactionId: parsedBody.TransactionId}, 'Processing CloudPayments webhook');

		try {
			switch (type) {
				case 'check':
					return await this.handleCheck(parsedBody);
				case 'pay':
					return await this.handlePay(parsedBody);
				case 'fail':
					return await this.handleFail(parsedBody);
				case 'recurrent':
					return await this.handleRecurrent(parsedBody);
				case 'refund':
					return await this.handleRefund(parsedBody);
				default:
					Logger.debug({type}, 'Unhandled webhook type');
					return {code: 0};
			}
		} catch (error: unknown) {
			Logger.error({error, type, transactionId: parsedBody.TransactionId}, 'Failed to process webhook');
			throw error;
		}
	}

	private async handleCheck(body: WebhookBody): Promise<{code: number}> {
		if (!body.AccountId) {
			return {code: 13}; // reject — no account
		}
		return {code: 0}; // approve
	}

	private async handlePay(body: WebhookBody): Promise<{code: number}> {
		if (!body.AccountId || !body.TransactionId) {
			Logger.warn({body}, 'Pay webhook missing required fields');
			return {code: 0};
		}

		const userId = BigInt(body.AccountId) as UserID;

		let jsonData: Record<string, unknown> = {};
		if (body.Data) {
			try {
				jsonData = typeof body.Data === 'string' ? JSON.parse(body.Data) : body.Data;
			} catch {
				// ignore
			}
		}

		const existingPaymentId = jsonData.paymentId as string | undefined;

		if (existingPaymentId) {
			const payment = await this.userRepository.getPaymentById(existingPaymentId);
			if (payment && payment.status === 'pending') {
				await this.userRepository.updatePayment({
					...payment.toRow(),
					cloudpayments_transaction_id: body.TransactionId != null ? BigInt(body.TransactionId) : null,
					status: 'completed',
					completed_at: new Date(),
				});
			}
		}

		if (body.Token) {
			await this.userRepository.patchUpsert(userId, {
				cloudpayments_token: body.Token,
			});
		}

		const plan = jsonData.plan as string | undefined;
		const isGift = plan === 'gift1Month' || plan === 'gift1Year';
		const durationMonths = (jsonData.duration_months as number) || (plan === 'gift1Year' ? 12 : 1);

		if (isGift) {
			const {getProductForGift} = await import('../ProductRegistry');
			const product = getProductForGift(durationMonths);
			if (!product) {
				Logger.error({plan, durationMonths}, 'Unknown gift product in pay webhook');
				return {code: 0};
			}

			const paymentId = existingPaymentId ?? crypto.randomUUID();

			if (!existingPaymentId) {
				await this.userRepository.createPayment({
					payment_id: paymentId,
					user_id: userId,
					cloudpayments_transaction_id: body.TransactionId != null ? BigInt(body.TransactionId) : null,
					product_type: product.type,
					amount_cents: Math.round((body.Amount || 0) * 100),
					currency: body.Currency || 'RUB',
					status: 'completed',
					is_gift: true,
					completed_at: new Date(),
					created_at: new Date(),
				});
			}

			const user = await this.userRepository.findUnique(userId);
			if (user) {
				await this.giftService.createGiftCode(paymentId, user, product, body.TransactionId);
				Logger.debug({userId: body.AccountId, transactionId: body.TransactionId, durationMonths}, 'Gift code created via webhook');
			}
		} else if (plan === 'monthly' || plan === 'yearly' || jsonData.billing_cycle) {
			const billingCycle = (jsonData.billing_cycle as string) || plan;
			const isYearly = billingCycle === 'yearly';
			const subDurationMonths = isYearly ? 12 : 1;

			if (!existingPaymentId) {
				const {getProductForSubscription} = await import('../ProductRegistry');
				const product = getProductForSubscription(isYearly ? 'yearly' : 'monthly');

				await this.userRepository.createPayment({
					payment_id: crypto.randomUUID(),
					user_id: userId,
					cloudpayments_transaction_id: body.TransactionId != null ? BigInt(body.TransactionId) : null,
					product_type: product.type,
					amount_cents: Math.round((body.Amount || 0) * 100),
					currency: body.Currency || 'RUB',
					status: 'completed',
					is_gift: false,
					completed_at: new Date(),
					created_at: new Date(),
				});
			}

			await this.premiumService.grantPremium(userId, subDurationMonths, isYearly ? 'yearly' : 'monthly', true);

			if (body.Token) {
				const cycle = isYearly ? 'yearly' as const : 'monthly' as const;
				const uid = userId;
				const token = body.Token;
				const accountId = body.AccountId;
				setTimeout(() => {
					this.createSubscriptionWithRetry(uid, token, cycle, accountId);
				}, 2000);
			}

			Logger.debug({userId: body.AccountId, transactionId: body.TransactionId, billingCycle}, 'Subscription activated via webhook');
		}

		Logger.debug({userId: body.AccountId, transactionId: body.TransactionId}, 'Pay webhook processed');
		return {code: 0};
	}

	private async handleFail(body: WebhookBody): Promise<{code: number}> {
		if (!body.AccountId || !body.TransactionId) {
			return {code: 0};
		}

		Logger.debug(
			{userId: body.AccountId, transactionId: body.TransactionId, statusCode: body.StatusCode},
			'Payment failed',
		);

		return {code: 0};
	}

	private async handleRecurrent(body: WebhookBody): Promise<{code: number}> {
		if (!body.AccountId || !body.TransactionId) {
			Logger.warn({body}, 'Recurrent webhook missing required fields');
			return {code: 0};
		}

		const userId = BigInt(body.AccountId) as UserID;

		if (body.StatusCode !== 0 && body.Status !== 'Completed') {
			Logger.warn(
				{userId, transactionId: body.TransactionId, status: body.Status, statusCode: body.StatusCode},
				'Recurrent payment failed',
			);
			return {code: 0};
		}

		const user = await this.userRepository.findUnique(userId);
		if (!user) {
			Logger.warn({userId, transactionId: body.TransactionId}, 'User not found for recurrent payment');
			return {code: 0};
		}

		const billingCycle = user.premiumBillingCycle as 'monthly' | 'yearly' | null;
		const durationMonths = billingCycle === 'yearly' ? 12 : 1;

		await this.premiumService.grantPremium(userId, durationMonths, billingCycle, true);

		const paymentId = crypto.randomUUID();
		await this.userRepository.createPayment({
			payment_id: paymentId,
			user_id: userId,
			cloudpayments_transaction_id: body.TransactionId != null ? BigInt(body.TransactionId) : null,
			cloudpayments_subscription_id: body.SubscriptionId || null,
			product_type: billingCycle === 'yearly' ? 'yearly_subscription' : 'monthly_subscription',
			amount_cents: Math.round((body.Amount || 0) * 100),
			currency: body.Currency || 'RUB',
			status: 'completed',
			is_gift: false,
			completed_at: new Date(),
			created_at: new Date(),
		});

		Logger.debug(
			{userId, transactionId: body.TransactionId, durationMonths, subscriptionId: body.SubscriptionId},
			'Recurrent payment processed — premium extended',
		);

		return {code: 0};
	}

	private async handleRefund(body: WebhookBody): Promise<{code: number}> {
		if (!body.TransactionId) {
			Logger.warn({body}, 'Refund webhook missing transaction ID');
			return {code: 0};
		}

		const payment = await this.userRepository.getPaymentByTransactionId(body.TransactionId);
		if (!payment) {
			Logger.warn({transactionId: body.TransactionId}, 'No payment found for refund');
			return {code: 0};
		}

		const user = await this.userRepository.findUnique(payment.userId);
		if (!user) {
			Logger.error({userId: payment.userId, transactionId: body.TransactionId}, 'User not found for refund');
			return {code: 0};
		}

		await this.userRepository.updatePayment({
			...payment.toRow(),
			status: 'refunded',
		});

		if (payment.isGift) {
			const giftCode = await this.userRepository.findGiftCodeByTransactionId(body.TransactionId);
			if (giftCode) {
				await this.handleGiftRefund(giftCode);
			}
		} else {
			await this.premiumService.revokePremium(payment.userId);
		}

		if (!user.firstRefundAt) {
			await this.userRepository.patchUpsert(payment.userId, {
				first_refund_at: new Date(),
			});
			Logger.debug(
				{userId: payment.userId, transactionId: body.TransactionId},
				'First refund recorded — 30 day purchase block applied',
			);
		} else {
			const updatedUser = await this.userRepository.patchUpsert(payment.userId, {
				flags: user.flags | UserFlags.PREMIUM_PURCHASE_DISABLED,
			});

			if (updatedUser) {
				await this.dispatchUser(updatedUser);
			}

			Logger.debug(
				{userId: payment.userId, transactionId: body.TransactionId},
				'Second refund recorded — permanent purchase block applied',
			);
		}

		return {code: 0};
	}

	private createSubscriptionWithRetry(
		userId: UserID,
		token: string,
		billingCycle: 'monthly' | 'yearly',
		accountId: string,
		attempt = 1,
	): void {
		const maxAttempts = 5;
		const delayMs = attempt * 3000;

		this.subscriptionService.createSubscription(userId, token, billingCycle).then(() => {
			Logger.debug({userId: accountId, billingCycle, attempt}, 'Recurring subscription created via webhook');
		}).catch((error) => {
			if (attempt < maxAttempts) {
				Logger.warn({error, userId: accountId, attempt, nextRetryMs: delayMs}, 'Retrying subscription creation');
				setTimeout(() => {
					this.createSubscriptionWithRetry(userId, token, billingCycle, accountId, attempt + 1);
				}, delayMs);
			} else {
				Logger.error({error, userId: accountId, attempts: maxAttempts}, 'Failed to create recurring subscription after all retries');
			}
		});
	}

	private async handleGiftRefund(giftCode: GiftCode): Promise<void> {
		if (giftCode.redeemedByUserId) {
			await this.premiumService.revokePremium(giftCode.redeemedByUserId);

			const redeemer = await this.userRepository.findUnique(giftCode.redeemedByUserId);
			if (redeemer?.email) {
				this.emailService.sendGiftChargebackNotification(redeemer.email, redeemer.username, redeemer.locale).catch((error) => {
					Logger.warn({error, userId: redeemer.id.toString()}, 'Failed to send gift chargeback notification');
				});
			}

			Logger.debug(
				{giftCode: giftCode.code, redeemerId: giftCode.redeemedByUserId},
				'Premium revoked due to gift refund',
			);
		}

		await this.scheduleAccountDeletionForFraud(giftCode.createdByUserId);
	}

	private async scheduleAccountDeletionForFraud(userId: UserID): Promise<void> {
		const user = await this.userRepository.findUnique(userId);
		if (!user) {
			return;
		}

		const pendingDeletionAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

		const updatedUser = await this.userRepository.patchUpsert(userId, {
			flags: user.flags | UserFlags.DELETED,
			pending_deletion_at: pendingDeletionAt,
			deletion_reason_code: DeletionReasons.FRIENDLY_FRAUD,
			deletion_public_reason: 'Payment dispute',
			deletion_audit_log_reason: 'Refund/chargeback filed',
		});

		await this.userRepository.addPendingDeletion(userId, pendingDeletionAt, DeletionReasons.FRIENDLY_FRAUD);

		await this.authService.terminateAllUserSessions(userId);

		if (updatedUser?.email) {
			this.emailService.sendScheduledDeletionNotification(
				updatedUser.email,
				updatedUser.username,
				pendingDeletionAt,
				'Payment dispute — refund/chargeback filed',
				updatedUser.locale,
			).catch((error) => {
				Logger.warn({error, userId: updatedUser.id.toString()}, 'Failed to send scheduled deletion notification');
			});
		}

		Logger.debug({userId, pendingDeletionAt}, 'Account scheduled for deletion due to payment dispute');
	}

	private async dispatchUser(user: User): Promise<void> {
		await this.gatewayService.dispatchPresence({
			userId: user.id,
			event: 'USER_UPDATE',
			data: mapUserToPrivateResponse(user),
		});
	}
}
