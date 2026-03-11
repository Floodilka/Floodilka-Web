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
import {UserPremiumTypes} from '~/Constants';
import type {IGatewayService} from '~/infrastructure/IGatewayService';
import {Logger} from '~/Logger';
import type {User} from '~/Models';
import type {IUserRepository} from '~/user/IUserRepository';
import {mapUserToPrivateResponse} from '~/user/UserModel';
import {addMonthsClamp} from '../PaymentUtils';

export class PremiumService {
	constructor(
		private userRepository: IUserRepository,
		private gatewayService: IGatewayService,
	) {}

	async grantPremium(
		userId: UserID,
		durationMonths: number,
		billingCycle: string | null = null,
		hasEverPurchased: boolean = false,
	): Promise<void> {
		const user = await this.userRepository.findUnique(userId);
		if (!user) {
			return;
		}

		const now = new Date();
		let premiumUntil: Date | null = null;

		if (durationMonths > 0) {
			const currentPremiumUntil = user.premiumUntil && user.premiumUntil > now ? user.premiumUntil : now;
			premiumUntil = addMonthsClamp(currentPremiumUntil, durationMonths);
		}

		const updatedUser = await this.userRepository.patchUpsert(userId, {
			premium_type: UserPremiumTypes.SUBSCRIPTION,
			premium_since: user.premiumSince || now,
			premium_until: premiumUntil,
			has_ever_purchased: hasEverPurchased,
			premium_will_cancel: false,
			premium_billing_cycle: billingCycle,
		});

		if (updatedUser) {
			await this.dispatchUser(updatedUser);
		}

		Logger.debug({userId, durationMonths, billingCycle}, 'Premium granted to user');
	}

	async grantPremiumFromGift(userId: UserID, durationMonths: number): Promise<void> {
		const user = await this.userRepository.findUnique(userId);
		if (!user) {
			return;
		}

		const now = new Date();
		let premiumUntil: Date | null = null;

		if (durationMonths > 0) {
			const currentPremiumUntil = user.premiumUntil && user.premiumUntil > now ? user.premiumUntil : now;
			premiumUntil = addMonthsClamp(currentPremiumUntil, durationMonths);
		}

		const updatedUser = await this.userRepository.patchUpsert(userId, {
			premium_type: UserPremiumTypes.SUBSCRIPTION,
			premium_since: user.premiumSince || now,
			premium_until: premiumUntil,
			premium_will_cancel: false,
		});

		if (updatedUser) {
			await this.dispatchUser(updatedUser);
		}

		Logger.debug({userId, durationMonths}, 'Premium granted to user from gift');
	}

	async revokePremium(userId: UserID): Promise<void> {
		const updatedUser = await this.userRepository.patchUpsert(userId, {
			premium_type: UserPremiumTypes.NONE,
			premium_until: null,
		});

		if (updatedUser) {
			await this.dispatchUser(updatedUser);
		}
	}

	private async dispatchUser(user: User): Promise<void> {
		await this.gatewayService.dispatchPresence({
			userId: user.id,
			event: 'USER_UPDATE',
			data: mapUserToPrivateResponse(user),
		});
	}
}
