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

import {UserPremiumTypes} from '~/Constants';

export enum ProductType {
	MONTHLY_SUBSCRIPTION = 'monthly_subscription',
	YEARLY_SUBSCRIPTION = 'yearly_subscription',
	GIFT_1_MONTH = 'gift_1_month',
	GIFT_1_YEAR = 'gift_1_year',
}

export interface ProductInfo {
	type: ProductType;
	premiumType: 1;
	durationMonths: number;
	isGift: boolean;
	billingCycle?: 'monthly' | 'yearly';
	amountRub: number;
}

export function getProductByType(productType: string): ProductInfo | null {
	return PRODUCTS.get(productType) ?? null;
}

export function getProductForSubscription(billingCycle: 'monthly' | 'yearly'): ProductInfo {
	return billingCycle === 'yearly' ? PRODUCTS.get(ProductType.YEARLY_SUBSCRIPTION)! : PRODUCTS.get(ProductType.MONTHLY_SUBSCRIPTION)!;
}

export function getProductForGift(durationMonths: number): ProductInfo | null {
	if (durationMonths === 1) return PRODUCTS.get(ProductType.GIFT_1_MONTH) ?? null;
	if (durationMonths === 12) return PRODUCTS.get(ProductType.GIFT_1_YEAR) ?? null;
	return null;
}

export function isRecurringSubscription(info: ProductInfo): boolean {
	return !info.isGift && info.premiumType === UserPremiumTypes.SUBSCRIPTION;
}

const PRODUCTS = new Map<string, ProductInfo>([
	[
		ProductType.MONTHLY_SUBSCRIPTION,
		{
			type: ProductType.MONTHLY_SUBSCRIPTION,
			premiumType: UserPremiumTypes.SUBSCRIPTION,
			durationMonths: 1,
			isGift: false,
			billingCycle: 'monthly',
			amountRub: 0,
		},
	],
	[
		ProductType.YEARLY_SUBSCRIPTION,
		{
			type: ProductType.YEARLY_SUBSCRIPTION,
			premiumType: UserPremiumTypes.SUBSCRIPTION,
			durationMonths: 12,
			isGift: false,
			billingCycle: 'yearly',
			amountRub: 0,
		},
	],
	[
		ProductType.GIFT_1_MONTH,
		{
			type: ProductType.GIFT_1_MONTH,
			premiumType: UserPremiumTypes.SUBSCRIPTION,
			durationMonths: 1,
			isGift: true,
			amountRub: 0,
		},
	],
	[
		ProductType.GIFT_1_YEAR,
		{
			type: ProductType.GIFT_1_YEAR,
			premiumType: UserPremiumTypes.SUBSCRIPTION,
			durationMonths: 12,
			isGift: true,
			amountRub: 0,
		},
	],
]);

export function initializeProductPrices(prices: {
	monthlyRub: number;
	yearlyRub: number;
	gift1MonthRub: number;
	gift1YearRub: number;
}): void {
	const monthly = PRODUCTS.get(ProductType.MONTHLY_SUBSCRIPTION)!;
	monthly.amountRub = prices.monthlyRub;

	const yearly = PRODUCTS.get(ProductType.YEARLY_SUBSCRIPTION)!;
	yearly.amountRub = prices.yearlyRub;

	const gift1Month = PRODUCTS.get(ProductType.GIFT_1_MONTH)!;
	gift1Month.amountRub = prices.gift1MonthRub;

	const gift1Year = PRODUCTS.get(ProductType.GIFT_1_YEAR)!;
	gift1Year.amountRub = prices.gift1YearRub;
}
