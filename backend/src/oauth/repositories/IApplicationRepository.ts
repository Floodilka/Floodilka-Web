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

import type {ApplicationID, UserID} from '~/BrandedTypes';
import type {ApplicationRow, OAuthBotTokenByClientRow} from '~/database/types/OAuth2Types';
import type {Application} from '~/models/Application';

export interface IApplicationRepository {
	getApplication(applicationId: ApplicationID): Promise<Application | null>;
	listApplicationsByOwner(ownerUserId: UserID): Promise<Array<Application>>;
	upsertApplication(data: ApplicationRow, oldData?: ApplicationRow | null): Promise<Application>;
	deleteApplication(applicationId: ApplicationID): Promise<void>;
	recordBotToken(data: OAuthBotTokenByClientRow): Promise<void>;
	listBotTokensByClient(clientId: ApplicationID): Promise<Array<OAuthBotTokenByClientRow>>;
	deleteAllBotTokensByClient(clientId: ApplicationID): Promise<void>;
}
