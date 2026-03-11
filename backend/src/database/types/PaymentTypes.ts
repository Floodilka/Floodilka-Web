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

type Nullish<T> = T | null;

export interface GiftCodeRow {
	code: string;
	duration_months: number;
	created_at: Date;
	created_by_user_id: UserID;
	redeemed_at: Nullish<Date>;
	redeemed_by_user_id: Nullish<UserID>;
	cloudpayments_transaction_id: Nullish<number | bigint>;
	payment_id: Nullish<string>;
	version: number;
}

export interface PaymentRow {
	payment_id: string;
	user_id: UserID;
	cloudpayments_transaction_id: Nullish<number | bigint>;
	cloudpayments_subscription_id: Nullish<string>;
	product_type: Nullish<string>;
	amount_cents: number;
	currency: string;
	status: string;
	is_gift: boolean;
	gift_code: Nullish<string>;
	created_at: Date;
	completed_at: Nullish<Date>;
	version: number;
}

export const PAYMENT_COLUMNS = [
	'payment_id',
	'user_id',
	'cloudpayments_transaction_id',
	'cloudpayments_subscription_id',
	'product_type',
	'amount_cents',
	'currency',
	'status',
	'is_gift',
	'gift_code',
	'created_at',
	'completed_at',
	'version',
] as const;

export const PAYMENT_BY_TRANSACTION_COLUMNS = ['cloudpayments_transaction_id', 'payment_id'] as const;

export const PAYMENT_BY_USER_COLUMNS = ['user_id', 'created_at', 'payment_id'] as const;

export const GIFT_CODE_COLUMNS = [
	'code',
	'duration_months',
	'created_at',
	'created_by_user_id',
	'redeemed_at',
	'redeemed_by_user_id',
	'cloudpayments_transaction_id',
	'payment_id',
	'version',
] as const;

export const GIFT_CODE_BY_CREATOR_COLUMNS = ['created_by_user_id', 'code'] as const;

export const GIFT_CODE_BY_TRANSACTION_COLUMNS = ['cloudpayments_transaction_id', 'code'] as const;

export const GIFT_CODE_BY_REDEEMER_COLUMNS = ['redeemed_by_user_id', 'code'] as const;

export interface PaymentByTransactionRow {
	cloudpayments_transaction_id: number | bigint;
	payment_id: string;
}

export interface PaymentByUserRow {
	user_id: UserID;
	created_at: Date;
	payment_id: string;
}

export interface GiftCodeByCreatorRow {
	created_by_user_id: UserID;
	code: string;
}

export interface GiftCodeByTransactionRow {
	cloudpayments_transaction_id: number | bigint;
	code: string;
}

export interface GiftCodeByRedeemerRow {
	redeemed_by_user_id: UserID;
	code: string;
}
