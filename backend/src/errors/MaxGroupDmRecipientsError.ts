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

import {APIErrorCodes, MAX_GROUP_DM_RECIPIENTS} from '~/Constants';
import {BadRequestError} from './BadRequestError';

export class MaxGroupDmRecipientsError extends BadRequestError {
	constructor() {
		super({
			code: APIErrorCodes.MAX_GROUP_DM_RECIPIENTS,
			message: `Максимальное количество участников группового чата — ${MAX_GROUP_DM_RECIPIENTS}.`,
			data: {
				max_recipients: MAX_GROUP_DM_RECIPIENTS,
			},
		});
	}
}
