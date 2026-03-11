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

import type {PaymentRow} from '~/database/CassandraTypes';
import type {UserID} from '../BrandedTypes';

export class Payment {
	readonly paymentId: string;
	readonly userId: UserID;
	readonly cloudpaymentsTransactionId: number | null;
	readonly cloudpaymentsSubscriptionId: string | null;
	readonly productType: string | null;
	readonly amountCents: number;
	readonly currency: string;
	readonly status: string;
	readonly isGift: boolean;
	readonly giftCode: string | null;
	readonly createdAt: Date;
	readonly completedAt: Date | null;
	readonly version: number;

	constructor(row: PaymentRow) {
		this.paymentId = row.payment_id;
		this.userId = row.user_id as UserID;
		this.cloudpaymentsTransactionId = row.cloudpayments_transaction_id ?? null;
		this.cloudpaymentsSubscriptionId = row.cloudpayments_subscription_id ?? null;
		this.productType = row.product_type ?? null;
		this.amountCents = row.amount_cents;
		this.currency = row.currency;
		this.status = row.status;
		this.isGift = row.is_gift;
		this.giftCode = row.gift_code ?? null;
		this.createdAt = row.created_at;
		this.completedAt = row.completed_at ?? null;
		this.version = row.version;
	}

	toRow(): PaymentRow {
		return {
			payment_id: this.paymentId,
			user_id: this.userId,
			cloudpayments_transaction_id: this.cloudpaymentsTransactionId,
			cloudpayments_subscription_id: this.cloudpaymentsSubscriptionId,
			product_type: this.productType,
			amount_cents: this.amountCents,
			currency: this.currency,
			status: this.status,
			is_gift: this.isGift,
			gift_code: this.giftCode,
			created_at: this.createdAt,
			completed_at: this.completedAt,
			version: this.version,
		};
	}
}
