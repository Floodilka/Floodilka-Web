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
import {BatchBuilder, buildPatchFromData, executeVersionedUpdate, fetchMany, fetchOne} from '~/database/Cassandra';
import {APPLICATION_COLUMNS} from '~/database/CassandraTypes';
import type {ApplicationByOwnerRow, ApplicationRow, OAuthBotTokenByClientRow} from '~/database/types/OAuth2Types';
import {Application} from '~/models/Application';
import {Applications, ApplicationsByOwner, OAuthBotTokensByClient} from '~/Tables';
import type {IApplicationRepository} from './IApplicationRepository';

const SELECT_APPLICATION_CQL = Applications.selectCql({
	where: Applications.where.eq('application_id'),
});

const SELECT_APPLICATION_IDS_BY_OWNER_CQL = ApplicationsByOwner.selectCql({
	columns: ['application_id'],
	where: ApplicationsByOwner.where.eq('owner_user_id'),
});

const FETCH_APPLICATIONS_BY_IDS_CQL = Applications.selectCql({
	where: Applications.where.in('application_id', 'application_ids'),
});

export class ApplicationRepository implements IApplicationRepository {
	async getApplication(applicationId: ApplicationID): Promise<Application | null> {
		const row = await fetchOne<ApplicationRow>(SELECT_APPLICATION_CQL, {application_id: applicationId});
		return row ? new Application(row) : null;
	}

	async listApplicationsByOwner(ownerUserId: UserID): Promise<Array<Application>> {
		const ids = await fetchMany<ApplicationByOwnerRow>(SELECT_APPLICATION_IDS_BY_OWNER_CQL, {
			owner_user_id: ownerUserId,
		});

		if (ids.length === 0) {
			return [];
		}

		const rows = await fetchMany<ApplicationRow>(FETCH_APPLICATIONS_BY_IDS_CQL, {
			application_ids: ids.map((r) => r.application_id),
		});

		return rows.map((r) => new Application(r));
	}

	async upsertApplication(data: ApplicationRow, oldData?: ApplicationRow | null): Promise<Application> {
		const applicationId = data.application_id;

		const result = await executeVersionedUpdate<ApplicationRow, 'application_id'>(
			async () => {
				if (oldData !== undefined) return oldData;
				return await fetchOne<ApplicationRow>(SELECT_APPLICATION_CQL, {application_id: applicationId});
			},
			(current) => ({
				pk: {application_id: applicationId},
				patch: buildPatchFromData(data, current, APPLICATION_COLUMNS, ['application_id']),
			}),
			Applications,
			{onFailure: 'log'},
		);

		const batch = new BatchBuilder();
		batch.addPrepared(
			ApplicationsByOwner.upsertAll({
				owner_user_id: data.owner_user_id,
				application_id: data.application_id,
			}),
		);
		await batch.execute();

		return new Application({...data, version: result.finalVersion});
	}

	async deleteApplication(applicationId: ApplicationID): Promise<void> {
		const application = await this.getApplication(applicationId);
		if (!application) {
			return;
		}

		const batch = new BatchBuilder();
		batch.addPrepared(Applications.deleteByPk({application_id: applicationId}));
		batch.addPrepared(
			ApplicationsByOwner.deleteByPk({
				owner_user_id: application.ownerUserId,
				application_id: applicationId,
			}),
		);
		await batch.execute();

		await this.deleteAllBotTokensByClient(applicationId);
	}

	async recordBotToken(data: OAuthBotTokenByClientRow): Promise<void> {
		const batch = new BatchBuilder();
		batch.addPrepared(OAuthBotTokensByClient.upsertAll(data));
		await batch.execute();
	}

	async listBotTokensByClient(clientId: ApplicationID): Promise<Array<OAuthBotTokenByClientRow>> {
		const cql = OAuthBotTokensByClient.selectCql({
			where: OAuthBotTokensByClient.where.eq('client_id'),
		});
		return fetchMany<OAuthBotTokenByClientRow>(cql, {client_id: clientId});
	}

	async deleteAllBotTokensByClient(clientId: ApplicationID): Promise<void> {
		const existing = await this.listBotTokensByClient(clientId);
		if (existing.length === 0) {
			return;
		}
		const batch = new BatchBuilder();
		for (const row of existing) {
			batch.addPrepared(
				OAuthBotTokensByClient.deleteByPk({
					client_id: clientId,
					token_: row.token_,
				}),
			);
		}
		await batch.execute();
	}
}
