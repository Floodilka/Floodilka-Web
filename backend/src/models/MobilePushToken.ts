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

import type {MobilePushTokenRow} from '~/database/CassandraTypes';
import type {UserID} from '../BrandedTypes';

export class MobilePushToken {
	readonly userId: UserID;
	readonly tokenId: string;
	readonly token: string;
	readonly platform: string;
	readonly createdAt: Date;

	constructor(row: MobilePushTokenRow) {
		this.userId = row.user_id;
		this.tokenId = row.token_id;
		this.token = row.push_token;
		this.platform = row.platform;
		this.createdAt = row.created_at;
	}

	toRow(): MobilePushTokenRow {
		return {
			user_id: this.userId,
			token_id: this.tokenId,
			push_token: this.token,
			platform: this.platform,
			created_at: this.createdAt,
		};
	}
}
