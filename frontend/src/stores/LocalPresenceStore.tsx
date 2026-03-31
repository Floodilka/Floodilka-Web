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

import {makeAutoObservable, reaction} from 'mobx';
import type {StatusType} from '~/Constants';
import {StatusTypes} from '~/Constants';
import {
	type CustomStatus,
	customStatusToKey,
	type GatewayCustomStatusPayload,
	normalizeCustomStatus,
	toGatewayCustomStatus,
} from '~/lib/customStatus';
import MobileLayoutStore from '~/stores/MobileLayoutStore';
import UserSettingsStore from '~/stores/UserSettingsStore';

type Presence = Readonly<{
	status: StatusType;
	since: number;
	afk: boolean;
	mobile: boolean;
	custom_status: GatewayCustomStatusPayload | null;
}>;

class LocalPresenceStore {
	status: StatusType = StatusTypes.ONLINE;

	since: number = 0;

	afk: boolean = false;

	mobile: boolean = false;

	customStatus: CustomStatus | null = null;

	constructor() {
		makeAutoObservable(this, {}, {autoBind: true});

		reaction(
			() => MobileLayoutStore.isMobileLayout(),
			() => this.updatePresence(),
		);
	}

	reset(): void {
		this.status = StatusTypes.ONLINE;
		this.since = 0;
		this.afk = false;
		this.mobile = false;
		this.customStatus = null;
	}

	updatePresence(): void {
		const userStatus = UserSettingsStore.status;
		const isMobile = MobileLayoutStore.isMobileLayout();

		const normalizedCustomStatus = normalizeCustomStatus(UserSettingsStore.getCustomStatus());
		this.customStatus = normalizedCustomStatus ? {...normalizedCustomStatus} : null;
		this.status = userStatus;
		this.since = 0;
		this.afk = false;
		this.mobile = isMobile;
	}

	getStatus(): StatusType {
		return this.status;
	}

	getPresence(): Presence {
		return {
			status: this.status,
			since: this.since,
			afk: this.afk,
			mobile: this.mobile,
			custom_status: toGatewayCustomStatus(this.customStatus),
		};
	}

	get presenceFingerprint(): string {
		return `${this.status}|${customStatusToKey(this.customStatus)}`;
	}
}

export default new LocalPresenceStore();
