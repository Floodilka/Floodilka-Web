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
import {BatchBuilder} from '~/database/Cassandra';
import type {UserRow} from '~/database/CassandraTypes';
import {UserByCloudpaymentsSubscriptionId, UserByEmail, UserByPhone, UserByUsername} from '~/Tables';

export class UserIndexRepository {
	async syncIndices(data: UserRow, oldData?: UserRow | null): Promise<void> {
		const batch = new BatchBuilder();

		if (!!data.username) {
			batch.addPrepared(
				UserByUsername.upsertAll({
					username: data.username.toLowerCase(),
					user_id: data.user_id,
				}),
			);
		}
		if (oldData?.username) {
			if (oldData.username.toLowerCase() !== data.username?.toLowerCase()) {
				batch.addPrepared(
					UserByUsername.deleteByPk({
						username: oldData.username.toLowerCase(),
						user_id: oldData.user_id,
					}),
				);
			}
		}

		if (data.email) {
			batch.addPrepared(
				UserByEmail.upsertAll({
					email_lower: data.email.toLowerCase(),
					user_id: data.user_id,
				}),
			);
		}
		if (oldData?.email && oldData.email.toLowerCase() !== data.email?.toLowerCase()) {
			batch.addPrepared(
				UserByEmail.deleteByPk({
					email_lower: oldData.email.toLowerCase(),
					user_id: oldData.user_id,
				}),
			);
		}

		if (data.phone) {
			batch.addPrepared(
				UserByPhone.upsertAll({
					phone: data.phone,
					user_id: data.user_id,
				}),
			);
		}
		if (oldData?.phone && oldData.phone !== data.phone) {
			batch.addPrepared(
				UserByPhone.deleteByPk({
					phone: oldData.phone,
					user_id: oldData.user_id,
				}),
			);
		}

		if (data.cloudpayments_subscription_id) {
			batch.addPrepared(
				UserByCloudpaymentsSubscriptionId.upsertAll({
					cloudpayments_subscription_id: data.cloudpayments_subscription_id,
					user_id: data.user_id,
				}),
			);
		}
		if (oldData?.cloudpayments_subscription_id && oldData.cloudpayments_subscription_id !== data.cloudpayments_subscription_id) {
			batch.addPrepared(
				UserByCloudpaymentsSubscriptionId.deleteByPk({
					cloudpayments_subscription_id: oldData.cloudpayments_subscription_id,
					user_id: oldData.user_id,
				}),
			);
		}

		await batch.execute();
	}

	async deleteIndices(
		userId: UserID,
		username: string,
		email?: string | null,
		phone?: string | null,
		cloudpaymentsSubscriptionId?: string | null,
	): Promise<void> {
		const batch = new BatchBuilder();

		batch.addPrepared(
			UserByUsername.deleteByPk({
				username: username.toLowerCase(),
				user_id: userId,
			}),
		);

		if (email) {
			batch.addPrepared(
				UserByEmail.deleteByPk({
					email_lower: email.toLowerCase(),
					user_id: userId,
				}),
			);
		}

		if (phone) {
			batch.addPrepared(
				UserByPhone.deleteByPk({
					phone: phone,
					user_id: userId,
				}),
			);
		}

		if (cloudpaymentsSubscriptionId) {
			batch.addPrepared(
				UserByCloudpaymentsSubscriptionId.deleteByPk({
					cloudpayments_subscription_id: cloudpaymentsSubscriptionId,
					user_id: userId,
				}),
			);
		}

		await batch.execute();
	}
}
