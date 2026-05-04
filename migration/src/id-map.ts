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

import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {snowflakeFromTimestamp} from './utils/snowflake.js';

const MAP_FILE = 'id-map.json';

// ObjectId hex string → Snowflake bigint
const idMap = new Map<string, bigint>();

export function mapId(objectIdHex: string, timestamp: Date): bigint {
	const existing = idMap.get(objectIdHex);
	if (existing !== undefined) return existing;

	const snowflake = snowflakeFromTimestamp(timestamp);
	idMap.set(objectIdHex, snowflake);
	return snowflake;
}

export function setId(objectIdHex: string, snowflake: bigint) {
	idMap.set(objectIdHex, snowflake);
}

export function getId(objectIdHex: string): bigint | undefined {
	return idMap.get(objectIdHex);
}

export function requireId(objectIdHex: string): bigint {
	const id = idMap.get(objectIdHex);
	if (id === undefined) {
		throw new Error(`No snowflake mapping for ObjectId: ${objectIdHex}`);
	}
	return id;
}

export function saveIdMap() {
	const serializable: Record<string, string> = {};
	for (const [k, v] of idMap) {
		serializable[k] = v.toString();
	}
	writeFileSync(MAP_FILE, JSON.stringify(serializable, null, 2));
	console.log(`  ID map saved (${idMap.size} entries)`);
}

export function loadIdMap() {
	if (!existsSync(MAP_FILE)) return;
	const data = JSON.parse(readFileSync(MAP_FILE, 'utf-8')) as Record<string, string>;
	for (const [k, v] of Object.entries(data)) {
		idMap.set(k, BigInt(v));
	}
	console.log(`  ID map loaded (${idMap.size} entries)`);
}

export function getMapSize(): number {
	return idMap.size;
}
