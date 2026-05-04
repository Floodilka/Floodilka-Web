/*
 * Copyright (C) 2020-2026 Fluxer Contributors
 * Copyright (C) 2026 Floodilka Contributors
 *
 * This file is part of Floodilka, a fork of Fluxer
 * (https://github.com/fluxerapp/fluxer).
 * Modified by Floodilka Contributors starting March 2026.
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

import type {Hono} from 'hono';
import type {HonoEnv} from '~/App';
import {extractClientIp, lookupGeoip} from '~/utils/IpUtils';

export function GeoIPController(app: Hono<HonoEnv>) {
	app.get('/geoip', async (ctx) => {
		const ip = extractClientIp(ctx.req.raw) ?? '127.0.0.1';
		const geoip = await lookupGeoip(ip);

		return ctx.json({
			countryCode: geoip.countryCode ?? 'US',
			regionCode: geoip.region ?? null,
			latitude: geoip.latitude != null ? String(geoip.latitude) : '0',
			longitude: geoip.longitude != null ? String(geoip.longitude) : '0',
		});
	});
}
