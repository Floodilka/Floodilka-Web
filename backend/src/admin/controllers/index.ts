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

import type {HonoApp} from '~/App';
import {ApplicationAdminController} from './ApplicationAdminController';
import {ArchiveAdminController} from './ArchiveAdminController';
import {AssetAdminController} from './AssetAdminController';
import {AuditLogAdminController} from './AuditLogAdminController';
import {BanAdminController} from './BanAdminController';
import {BulkAdminController} from './BulkAdminController';
import {CodesAdminController} from './CodesAdminController';
import {FeatureFlagAdminController} from './FeatureFlagAdminController';
import {GatewayAdminController} from './GatewayAdminController';
import {GuildAdminController} from './GuildAdminController';
import {InstanceConfigAdminController} from './InstanceConfigAdminController';
import {MessageAdminController} from './MessageAdminController';
import {ReportAdminController} from './ReportAdminController';
import {SearchAdminController} from './SearchAdminController';
import {SnowflakeReservationAdminController} from './SnowflakeReservationAdminController';
import {SystemAdminController} from './SystemAdminController';
import {UserAdminController} from './UserAdminController';
import {VoiceAdminController} from './VoiceAdminController';

export const registerAdminControllers = (app: HonoApp) => {
	UserAdminController(app);
	CodesAdminController(app);
	GuildAdminController(app);
	ApplicationAdminController(app);
	AssetAdminController(app);
	BanAdminController(app);
	InstanceConfigAdminController(app);
	SnowflakeReservationAdminController(app);
	MessageAdminController(app);
	BulkAdminController(app);
	AuditLogAdminController(app);
	ArchiveAdminController(app);
	ReportAdminController(app);
	VoiceAdminController(app);
	GatewayAdminController(app);
	SystemAdminController(app);
	SearchAdminController(app);
	FeatureFlagAdminController(app);
};
