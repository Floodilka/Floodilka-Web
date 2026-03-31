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
import {fetchOne} from '~/database/Cassandra';
import type {
	UserByEmailRow,
	UserByPhoneRow,
	UserByCloudpaymentsSubscriptionIdRow,
	UserByUsernameRow,
} from '~/database/CassandraTypes';
import type {User} from '~/Models';
import {UserByEmail, UserByPhone, UserByCloudpaymentsSubscriptionId, UserByUsername} from '~/Tables';

const FETCH_USER_ID_BY_EMAIL_QUERY = UserByEmail.select({
	columns: ['user_id'],
	where: UserByEmail.where.eq('email_lower'),
	limit: 1,
});

const FETCH_USER_ID_BY_PHONE_QUERY = UserByPhone.select({
	columns: ['user_id'],
	where: UserByPhone.where.eq('phone'),
	limit: 1,
});

const FETCH_USER_ID_BY_CLOUDPAYMENTS_SUBSCRIPTION_ID_QUERY = UserByCloudpaymentsSubscriptionId.select({
	columns: ['user_id'],
	where: UserByCloudpaymentsSubscriptionId.where.eq('cloudpayments_subscription_id'),
	limit: 1,
});

const FETCH_USER_ID_BY_USERNAME_QUERY = UserByUsername.select({
	columns: ['user_id'],
	where: UserByUsername.where.eq('username'),
	limit: 1,
});

export class UserLookupRepository {
	constructor(private findUniqueUser: (userId: UserID) => Promise<User | null>) {}

	async findByEmail(email: string): Promise<User | null> {
		const emailLower = email.toLowerCase();
		const result = await fetchOne<Pick<UserByEmailRow, 'user_id'>>(
			FETCH_USER_ID_BY_EMAIL_QUERY.bind({email_lower: emailLower}),
		);
		if (!result) return null;
		return await this.findUniqueUser(result.user_id);
	}

	async findByPhone(phone: string): Promise<User | null> {
		const result = await fetchOne<Pick<UserByPhoneRow, 'user_id'>>(FETCH_USER_ID_BY_PHONE_QUERY.bind({phone}));
		if (!result) return null;
		return await this.findUniqueUser(result.user_id);
	}

	async findByCloudpaymentsSubscriptionId(cloudpaymentsSubscriptionId: string): Promise<User | null> {
		const result = await fetchOne<Pick<UserByCloudpaymentsSubscriptionIdRow, 'user_id'>>(
			FETCH_USER_ID_BY_CLOUDPAYMENTS_SUBSCRIPTION_ID_QUERY.bind({cloudpayments_subscription_id: cloudpaymentsSubscriptionId}),
		);
		if (!result) return null;
		return await this.findUniqueUser(result.user_id);
	}

	async findByUsername(username: string): Promise<User | null> {
		const usernameLower = username.toLowerCase();
		const result = await fetchOne<Pick<UserByUsernameRow, 'user_id'>>(
			FETCH_USER_ID_BY_USERNAME_QUERY.bind({username: usernameLower}),
		);
		if (!result) return null;
		return await this.findUniqueUser(result.user_id);
	}
}
