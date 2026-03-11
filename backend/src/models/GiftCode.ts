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

import type {GiftCodeRow} from '~/database/CassandraTypes';
import type {UserID} from '../BrandedTypes';

export class GiftCode {
	readonly code: string;
	readonly durationMonths: number;
	readonly createdAt: Date;
	readonly createdByUserId: UserID;
	readonly redeemedAt: Date | null;
	readonly redeemedByUserId: UserID | null;
	readonly cloudpaymentsTransactionId: number | null;
	readonly paymentId: string | null;
	readonly version: number;

	constructor(row: GiftCodeRow) {
		this.code = row.code;
		this.durationMonths = row.duration_months;
		this.createdAt = row.created_at;
		this.createdByUserId = row.created_by_user_id as UserID;
		this.redeemedAt = row.redeemed_at ?? null;
		this.redeemedByUserId = row.redeemed_by_user_id ? (row.redeemed_by_user_id as UserID) : null;
		this.cloudpaymentsTransactionId = row.cloudpayments_transaction_id ?? null;
		this.paymentId = row.payment_id ?? null;
		this.version = row.version;
	}

	toRow(): GiftCodeRow {
		return {
			code: this.code,
			duration_months: this.durationMonths,
			created_at: this.createdAt,
			created_by_user_id: this.createdByUserId,
			redeemed_at: this.redeemedAt,
			redeemed_by_user_id: this.redeemedByUserId,
			cloudpayments_transaction_id: this.cloudpaymentsTransactionId,
			payment_id: this.paymentId,
			version: this.version,
		};
	}
}
