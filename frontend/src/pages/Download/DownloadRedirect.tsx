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

import {useEffect} from 'react';

const APP_STORE_URL = 'https://apps.apple.com/app/id6755156241';
const GOOGLE_PLAY_URL = 'https://play.google.com/store/apps/details?id=com.floodilka.android';

export const DownloadRedirect = () => {
	useEffect(() => {
		const ua = navigator.userAgent;

		if (/iPhone|iPad|iPod/.test(ua)) {
			window.location.href = APP_STORE_URL;
		} else if (/Android/.test(ua)) {
			window.location.href = GOOGLE_PLAY_URL;
		} else {
			window.location.href = '/download';
		}
	}, []);

	return null;
};
