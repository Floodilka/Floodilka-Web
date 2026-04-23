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
import {BatchBuilder, Db, executeVersionedUpdate, fetchMany, fetchOne} from '~/database/Cassandra';
import type {PaymentRow} from '~/database/CassandraTypes';
import {Payment} from '~/Models';
import {Payments, PaymentsByTransaction, PaymentsByUser} from '~/Tables';

const FETCH_PAYMENT_BY_ID_QUERY = Payments.selectCql({
	where: Payments.where.eq('payment_id'),
	limit: 1,
});

const FETCH_PAYMENT_BY_TRANSACTION_QUERY = PaymentsByTransaction.selectCql({
	columns: ['payment_id'],
	where: PaymentsByTransaction.where.eq('cloudpayments_transaction_id'),
});

const FETCH_PAYMENTS_BY_USER_QUERY = PaymentsByUser.selectCql({
	columns: ['payment_id'],
	where: PaymentsByUser.where.eq('user_id'),
});

const FETCH_PAYMENTS_BY_IDS_QUERY = Payments.selectCql({
	where: Payments.where.in('payment_id', 'payment_ids'),
});

export class PaymentRepository {
	async createPayment(data: {
		payment_id: string;
		user_id: UserID;
		product_type: string;
		amount_cents: number;
		currency: string;
		status: string;
		is_gift: boolean;
		created_at: Date;
		cloudpayments_transaction_id?: number | null;
		cloudpayments_subscription_id?: string | null;
		gift_code?: string | null;
		completed_at?: Date | null;
	}): Promise<void> {
		const batch = new BatchBuilder();

		const paymentRow: PaymentRow = {
			payment_id: data.payment_id,
			user_id: data.user_id,
			cloudpayments_transaction_id: data.cloudpayments_transaction_id ?? null,
			cloudpayments_subscription_id: data.cloudpayments_subscription_id ?? null,
			product_type: data.product_type,
			amount_cents: data.amount_cents,
			currency: data.currency,
			status: data.status,
			is_gift: data.is_gift,
			gift_code: data.gift_code ?? null,
			created_at: data.created_at,
			completed_at: data.completed_at ?? null,
			version: 1,
		};

		batch.addPrepared(Payments.upsertAll(paymentRow));

		batch.addPrepared(
			PaymentsByUser.upsertAll({
				user_id: data.user_id,
				created_at: data.created_at,
				payment_id: data.payment_id,
			}),
		);

		await batch.execute();
	}

	async updatePayment(data: Partial<PaymentRow> & {payment_id: string}): Promise<{applied: boolean}> {
		const paymentId = data.payment_id;

		const result = await executeVersionedUpdate(
			() =>
				fetchOne<PaymentRow>(FETCH_PAYMENT_BY_ID_QUERY, {
					payment_id: paymentId,
				}),
			(current) => {
				type PatchOp = ReturnType<typeof Db.set> | ReturnType<typeof Db.clear>;
				const patch: Record<string, PatchOp> = {};

				const addField = <K extends keyof PaymentRow>(key: K) => {
					const newVal = data[key];
					const oldVal = current?.[key];
					if (newVal === null) {
						if (current && oldVal !== null && oldVal !== undefined) {
							patch[key] = Db.clear();
						}
					} else if (newVal !== undefined) {
						patch[key] = Db.set(newVal);
					}
				};

				addField('cloudpayments_transaction_id');
				addField('cloudpayments_subscription_id');
				addField('amount_cents');
				addField('currency');
				addField('status');
				addField('gift_code');
				addField('completed_at');

				return {
					pk: {payment_id: paymentId},
					patch,
				};
			},
			Payments,
			{onFailure: 'throw'},
		);

		if (result.applied) {
			await this.updatePaymentIndexes(data);
		}

		return result;
	}

	private async updatePaymentIndexes(data: Partial<PaymentRow> & {payment_id: string}): Promise<void> {
		const batch = new BatchBuilder();

		if (data.cloudpayments_transaction_id) {
			batch.addPrepared(
				PaymentsByTransaction.upsertAll({
					cloudpayments_transaction_id: data.cloudpayments_transaction_id,
					payment_id: data.payment_id,
				}),
			);
		}

		await batch.execute();
	}

	async getPaymentById(paymentId: string): Promise<Payment | null> {
		const result = await fetchOne<PaymentRow>(FETCH_PAYMENT_BY_ID_QUERY, {
			payment_id: paymentId,
		});
		return result ? new Payment(result) : null;
	}

	async getPaymentByTransactionId(transactionId: number | bigint): Promise<Payment | null> {
		const mapping = await fetchOne<{payment_id: string}>(FETCH_PAYMENT_BY_TRANSACTION_QUERY, {
			cloudpayments_transaction_id: typeof transactionId === 'bigint' ? transactionId : BigInt(transactionId),
		});
		if (!mapping) return null;
		return this.getPaymentById(mapping.payment_id);
	}

	async findPaymentsByUserId(userId: UserID): Promise<Array<Payment>> {
		const paymentRefs = await fetchMany<{payment_id: string}>(FETCH_PAYMENTS_BY_USER_QUERY, {
			user_id: userId,
		});
		if (paymentRefs.length === 0) return [];
		const rows = await fetchMany<PaymentRow>(FETCH_PAYMENTS_BY_IDS_QUERY, {
			payment_ids: paymentRefs.map((r) => r.payment_id),
		});
		return rows.map((r) => new Payment(r));
	}
}
