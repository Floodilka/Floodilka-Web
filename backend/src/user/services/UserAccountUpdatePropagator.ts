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
import {GatewayRpcClient} from '~/infrastructure/GatewayRpcClient';
import type {IGatewayService} from '~/infrastructure/IGatewayService';
import type {IMediaService} from '~/infrastructure/IMediaService';
import type {UserCacheService} from '~/infrastructure/UserCacheService';
import {Logger} from '~/Logger';
import type {UserGuildSettings, UserSettings} from '~/Models';
import {mapUserGuildSettingsToResponse, mapUserSettingsToResponse} from '~/user/UserModel';
import {BaseUserUpdatePropagator} from './BaseUserUpdatePropagator';

interface UserAccountUpdatePropagatorDeps {
	userCacheService: UserCacheService;
	gatewayService: IGatewayService;
	mediaService: IMediaService;
}

export class UserAccountUpdatePropagator extends BaseUserUpdatePropagator {
	constructor(private readonly deps: UserAccountUpdatePropagatorDeps) {
		super({
			userCacheService: deps.userCacheService,
			gatewayService: deps.gatewayService,
		});
	}

	async dispatchUserSettingsUpdate({userId, settings}: {userId: UserID; settings: UserSettings}): Promise<void> {
		await this.deps.gatewayService.dispatchPresence({
			userId,
			event: 'USER_SETTINGS_UPDATE',
			data: mapUserSettingsToResponse({settings}),
		});
	}

	async dispatchUserGuildSettingsUpdate({
		userId,
		settings,
	}: {
		userId: UserID;
		settings: UserGuildSettings;
	}): Promise<void> {
		await this.deps.gatewayService.dispatchPresence({
			userId,
			event: 'USER_GUILD_SETTINGS_UPDATE',
			data: mapUserGuildSettingsToResponse(settings),
		});

		// Sync push notification cache in gateway so eligibility checks use updated settings
		const settingsPayload = mapUserGuildSettingsToResponse(settings);
		Logger.info('[UserAccountUpdatePropagator] Syncing push cache for user %s guild %s: %j', userId.toString(), settings.guildId.toString(), settingsPayload);
		try {
			const result = await GatewayRpcClient.getInstance().call('push.sync_user_guild_settings', {
				user_id: userId.toString(),
				guild_id: settings.guildId.toString(),
				user_guild_settings: settingsPayload,
			});
			Logger.info('[UserAccountUpdatePropagator] Push cache sync result: %j', result);
		} catch (error) {
			Logger.error({error}, '[UserAccountUpdatePropagator] Failed to sync push guild settings cache');
		}
	}

	async dispatchUserNoteUpdate(params: {userId: UserID; targetId: UserID; note: string}): Promise<void> {
		const {userId, targetId, note} = params;
		await this.deps.gatewayService.dispatchPresence({
			userId,
			event: 'USER_NOTE_UPDATE',
			data: {id: targetId.toString(), note},
		});
	}
}
