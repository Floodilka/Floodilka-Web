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

export function createProgress(label: string, total: number) {
	let current = 0;
	const startTime = Date.now();

	return {
		tick(n = 1) {
			current += n;
			if (current % 500 === 0 || current === total) {
				const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
				const pct = ((current / total) * 100).toFixed(1);
				process.stdout.write(`\r  [${label}] ${current}/${total} (${pct}%) - ${elapsed}s`);
			}
		},
		done() {
			const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
			console.log(`\r  [${label}] ${current}/${total} done in ${elapsed}s`);
		},
	};
}
