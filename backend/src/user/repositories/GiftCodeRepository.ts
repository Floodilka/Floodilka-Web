/*
 * Copyright (C) 2026 Fluxer Contributors
 *
 * This file is part of Fluxer.
 *
 * Fluxer is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Fluxer is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Fluxer. If not, see <https://www.gnu.org/licenses/>.
 */

import type {UserID} from '~/BrandedTypes';
import {BatchBuilder, Db, executeConditional, fetchMany, fetchOne, upsertOne} from '~/database/Cassandra';
import type {GiftCodeRow} from '~/database/CassandraTypes';
import {GiftCode} from '~/Models';
import {GiftCodes, GiftCodesByCreator, GiftCodesByTransaction, GiftCodesByRedeemer} from '~/Tables';

const FETCH_GIFT_CODES_BY_CREATOR_QUERY = GiftCodesByCreator.selectCql({
	columns: ['code'],
	where: GiftCodesByCreator.where.eq('created_by_user_id'),
});

const FETCH_GIFT_CODE_BY_TRANSACTION_QUERY = GiftCodesByTransaction.selectCql({
	columns: ['code'],
	where: GiftCodesByTransaction.where.eq('cloudpayments_transaction_id'),
	limit: 1,
});

const FETCH_GIFT_CODE_QUERY = GiftCodes.selectCql({
	where: GiftCodes.where.eq('code'),
	limit: 1,
});

export class GiftCodeRepository {
	async createGiftCode(data: GiftCodeRow): Promise<void> {
		const batch = new BatchBuilder();
		batch.addPrepared(GiftCodes.upsertAll(data));
		batch.addPrepared(
			GiftCodesByCreator.upsertAll({
				created_by_user_id: data.created_by_user_id,
				code: data.code,
			}),
		);

		if (data.cloudpayments_transaction_id) {
			batch.addPrepared(
				GiftCodesByTransaction.upsertAll({
					cloudpayments_transaction_id: data.cloudpayments_transaction_id,
					code: data.code,
				}),
			);
		}

		await batch.execute();
	}

	async findGiftCode(code: string): Promise<GiftCode | null> {
		const row = await fetchOne<GiftCodeRow>(FETCH_GIFT_CODE_QUERY, {code});

		if (!row) {
			return null;
		}

		return new GiftCode(row);
	}

	async findGiftCodeByTransactionId(transactionId: number | bigint): Promise<GiftCode | null> {
		const row = await fetchOne<{code: string}>(FETCH_GIFT_CODE_BY_TRANSACTION_QUERY, {
			cloudpayments_transaction_id: transactionId,
		});

		if (!row) {
			return null;
		}

		return this.findGiftCode(row.code);
	}

	async findGiftCodesByCreator(userId: UserID): Promise<Array<GiftCode>> {
		const rows = await fetchMany<{code: string}>(FETCH_GIFT_CODES_BY_CREATOR_QUERY, {
			created_by_user_id: userId,
		});

		const giftCodes = await Promise.all(rows.map((row) => this.findGiftCode(row.code)));

		return giftCodes.filter((gc) => gc !== null) as Array<GiftCode>;
	}

	async redeemGiftCode(code: string, userId: UserID): Promise<{applied: boolean}> {
		const redeemedAt = new Date();

		const q = GiftCodes.patchByPkIf(
			{code},
			{
				redeemed_by_user_id: Db.set(userId),
				redeemed_at: Db.set(redeemedAt),
			},
			{col: 'redeemed_by_user_id', expectedParam: 'expected_redeemer', expectedValue: null},
		);

		const result = await executeConditional(q);

		if (result.applied) {
			await upsertOne(
				GiftCodesByRedeemer.upsertAll({
					redeemed_by_user_id: userId,
					code,
				}),
			);
		}

		return result;
	}

	async updateGiftCode(code: string, data: Partial<GiftCodeRow>): Promise<void> {
		const batch = new BatchBuilder();

		const patch: Record<string, ReturnType<typeof Db.set>> = {};
		if (data.redeemed_at !== undefined) {
			patch.redeemed_at = Db.set(data.redeemed_at);
		}
		if (data.redeemed_by_user_id !== undefined) {
			patch.redeemed_by_user_id = Db.set(data.redeemed_by_user_id);
		}

		if (Object.keys(patch).length > 0) {
			batch.addPrepared(GiftCodes.patchByPk({code}, patch));
		}

		if (data.redeemed_by_user_id) {
			batch.addPrepared(
				GiftCodesByRedeemer.upsertAll({
					redeemed_by_user_id: data.redeemed_by_user_id,
					code,
				}),
			);
		}

		await batch.execute();
	}

}
