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

import {makeAutoObservable, runInAction} from 'mobx';
import HttpClient from '~/lib/HttpClient';

interface GeoIPData {
	countryCode: string;
	regionCode: string | null;
	latitude: string;
	longitude: string;
}

class GeoIPStore {
	countryCode: string | null = null;
	regionCode: string | null = null;
	latitude: string | null = null;
	longitude: string | null = null;
	loaded = false;
	error: string | null = null;

	constructor() {
		makeAutoObservable(this, {}, {autoBind: true});
	}

	async fetchGeoData(): Promise<void> {
		try {
			const response = await HttpClient.get<GeoIPData>('/geoip');
			if (!response.ok) {
				throw new Error(`Failed to fetch geo data: ${response.status}`);
			}

			const data = response.body;

			runInAction(() => {
				this.countryCode = data.countryCode;
				this.regionCode = data.regionCode;
				this.latitude = data.latitude;
				this.longitude = data.longitude;
				this.loaded = true;
				this.error = null;
			});
		} catch (error) {
			runInAction(() => {
				this.countryCode = null;
				this.regionCode = null;
				this.latitude = null;
				this.longitude = null;
				this.loaded = true;
				this.error = error instanceof Error ? error.message : 'Unknown error';
			});
		}
	}
}

export default new GeoIPStore();
