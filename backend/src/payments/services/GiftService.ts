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
import {GiftCodeAlreadyRedeemedError, PaymentError, UnknownGiftCodeError, UnknownUserError} from '~/Errors';
import type {ICacheService} from '~/infrastructure/ICacheService';
import type {IGatewayService} from '~/infrastructure/IGatewayService';
import {Logger} from '~/Logger';
import type {GiftCode, User} from '~/Models';
import type {IUserRepository} from '~/user/IUserRepository';
import {mapUserToPrivateResponse} from '~/user/UserModel';
import * as RandomUtils from '~/utils/RandomUtils';
import type {ProductInfo} from '../ProductRegistry';
import type {CheckoutService} from './CheckoutService';
import type {PremiumService} from './PremiumService';

export class GiftService {
	constructor(
		private userRepository: IUserRepository,
		private cacheService: ICacheService,
		private gatewayService: IGatewayService,
		private checkoutService: CheckoutService,
		private premiumService: PremiumService,
	) {}

	async getGiftCode(code: string): Promise<GiftCode> {
		const giftCode = await this.userRepository.findGiftCode(code);
		if (!giftCode) {
			throw new UnknownGiftCodeError();
		}
		return giftCode;
	}

	async redeemGiftCode(userId: UserID, code: string): Promise<void> {
		const inflightKey = `gift_redeem_inflight:${code}`;
		const appliedKey = `gift_redeem_applied:${code}`;

		if (await this.cacheService.get<boolean>(appliedKey)) {
			throw new GiftCodeAlreadyRedeemedError();
		}
		if (await this.cacheService.get<boolean>(inflightKey)) {
			throw new PaymentError('Подарочный код активируется. Попробуйте через несколько секунд.');
		}
		await this.cacheService.set(inflightKey, 60);

		try {
			const giftCode = await this.userRepository.findGiftCode(code);
			if (!giftCode) {
				throw new UnknownGiftCodeError();
			}

			if (giftCode.redeemedByUserId) {
				await this.cacheService.set(appliedKey, 365 * 24 * 60 * 60);
				throw new GiftCodeAlreadyRedeemedError();
			}

			if (await this.cacheService.get<boolean>(`redeemed_gift_codes:${code}`)) {
				await this.cacheService.set(appliedKey, 365 * 24 * 60 * 60);
				throw new GiftCodeAlreadyRedeemedError();
			}

			const user = await this.userRepository.findUnique(userId);
			if (!user) {
				throw new UnknownUserError();
			}

			this.checkoutService.validateUserCanPurchase(user);

			await this.premiumService.grantPremiumFromGift(userId, giftCode.durationMonths);

			const redeemResult = await this.userRepository.redeemGiftCode(code, userId);
			if (!redeemResult.applied) {
				throw new GiftCodeAlreadyRedeemedError();
			}

			await this.cacheService.set(`redeemed_gift_codes:${code}`, 300);
			await this.cacheService.set(appliedKey, 365 * 24 * 60 * 60);

			Logger.debug({userId, giftCode: code, durationMonths: giftCode.durationMonths}, 'Gift code redeemed');
		} finally {
			await this.cacheService.delete(inflightKey);
		}
	}

	async getUserGifts(userId: UserID): Promise<Array<GiftCode>> {
		const gifts = await this.userRepository.findGiftCodesByCreator(userId);
		return gifts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
	}

	async createGiftCode(
		paymentId: string,
		purchaser: User,
		productInfo: ProductInfo,
		transactionId: number | bigint | null,
	): Promise<void> {
		const payment = await this.userRepository.getPaymentById(paymentId);
		if (!payment) {
			Logger.error({paymentId}, 'Payment not found for gift code creation');
			return;
		}

		if (payment.giftCode) {
			Logger.debug({paymentId, code: payment.giftCode}, 'Gift code already exists for payment');
			return;
		}

		const code = await this.generateUniqueGiftCode();

		await this.userRepository.createGiftCode({
			code,
			duration_months: productInfo.durationMonths,
			created_at: new Date(),
			created_by_user_id: purchaser.id,
			redeemed_at: null,
			redeemed_by_user_id: null,
			cloudpayments_transaction_id: transactionId != null ? BigInt(transactionId) : null,
			payment_id: paymentId,
			version: 1,
		});

		await this.userRepository.updatePayment({
			...payment.toRow(),
			gift_code: code,
		});

		const updatedUser = await this.userRepository.patchUpsert(purchaser.id, {
			gift_inventory_server_seq: (purchaser.giftInventoryServerSeq ?? 0) + 1,
		});

		if (updatedUser) {
			await this.dispatchUser(updatedUser);
		}

		Logger.debug(
			{code, purchaserId: purchaser.id, durationMonths: productInfo.durationMonths, productType: productInfo.type},
			'Gift code created',
		);
	}

	private async generateUniqueGiftCode(): Promise<string> {
		let code: string;
		let exists = true;

		while (exists) {
			code = RandomUtils.randomString(32);
			const existing = await this.userRepository.findGiftCode(code);
			exists = !!existing;
		}

		return code!;
	}

	private async dispatchUser(user: User): Promise<void> {
		await this.gatewayService.dispatchPresence({
			userId: user.id,
			event: 'USER_UPDATE',
			data: mapUserToPrivateResponse(user),
		});
	}
}
