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

// @generated - DO NOT EDIT MANUALLY
// Run: pnpm generate:masks

export interface StatusGeometry {
	size: number;
	cx: number;
	cy: number;
	radius: number;
	borderWidth: number;
	isMobile?: boolean;
	phoneWidth?: number;
	phoneHeight?: number;
}

const STATUS_GEOMETRY: Record<number, StatusGeometry> = {
	16: {size: 10, cx: 15, cy: 15, radius: 5, borderWidth: 0, isMobile: false},
	20: {size: 10, cx: 19, cy: 19, radius: 5, borderWidth: 0, isMobile: false},
	24: {size: 10, cx: 22, cy: 22, radius: 7, borderWidth: 2, isMobile: false},
	32: {size: 10, cx: 30, cy: 30, radius: 8, borderWidth: 3, isMobile: false},
	36: {size: 10, cx: 34, cy: 34, radius: 8, borderWidth: 3, isMobile: false},
	40: {size: 12, cx: 38, cy: 38, radius: 9, borderWidth: 3, isMobile: false},
	48: {size: 14, cx: 45, cy: 45, radius: 10, borderWidth: 3, isMobile: false},
	56: {size: 16, cx: 53, cy: 53, radius: 11, borderWidth: 3, isMobile: false},
	80: {size: 16, cx: 75, cy: 75, radius: 14, borderWidth: 6, isMobile: false},
	120: {size: 24, cx: 113, cy: 113, radius: 20, borderWidth: 8, isMobile: false},
};

const STATUS_GEOMETRY_MOBILE: Record<number, StatusGeometry> = {
	16: {size: 10, cx: 15, cy: 15, radius: 5, borderWidth: 0, isMobile: true, phoneWidth: 10, phoneHeight: 15},
	20: {size: 10, cx: 19, cy: 19, radius: 5, borderWidth: 0, isMobile: true, phoneWidth: 10, phoneHeight: 15},
	24: {size: 10, cx: 22, cy: 22, radius: 7, borderWidth: 2, isMobile: true, phoneWidth: 10, phoneHeight: 15},
	32: {size: 10, cx: 30, cy: 30, radius: 8, borderWidth: 3, isMobile: true, phoneWidth: 10, phoneHeight: 15},
	36: {size: 10, cx: 34, cy: 34, radius: 8, borderWidth: 3, isMobile: true, phoneWidth: 10, phoneHeight: 15},
	40: {size: 12, cx: 38, cy: 38, radius: 9, borderWidth: 3, isMobile: true, phoneWidth: 12, phoneHeight: 18},
	48: {size: 14, cx: 45, cy: 45, radius: 10, borderWidth: 3, isMobile: true, phoneWidth: 14, phoneHeight: 21},
	56: {size: 16, cx: 53, cy: 53, radius: 11, borderWidth: 3, isMobile: true, phoneWidth: 16, phoneHeight: 23},
	80: {size: 16, cx: 75, cy: 75, radius: 14, borderWidth: 6, isMobile: true, phoneWidth: 16, phoneHeight: 23},
	120: {size: 24, cx: 113, cy: 113, radius: 20, borderWidth: 8, isMobile: true, phoneWidth: 24, phoneHeight: 34},
};

export function getStatusGeometry(avatarSize: number, isMobile: boolean = false): StatusGeometry {
	const map = isMobile ? STATUS_GEOMETRY_MOBILE : STATUS_GEOMETRY;

	if (map[avatarSize]) {
		return map[avatarSize];
	}

	const closestSize = Object.keys(map)
		.map(Number)
		.reduce((prev, curr) => (Math.abs(curr - avatarSize) < Math.abs(prev - avatarSize) ? curr : prev));

	return map[closestSize];
}
