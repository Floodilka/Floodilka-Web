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

import type {XYCoord} from 'react-dnd';

export function computeVerticalDropPosition(
	clientOffset: XYCoord,
	boundingRect: DOMRect,
	edgeThreshold: number = 0.5,
): 'before' | 'after' | 'center' {
	const height = boundingRect.bottom - boundingRect.top;
	const offsetY = clientOffset.y - boundingRect.top;

	if (edgeThreshold >= 0.5) {
		return offsetY < height / 2 ? 'before' : 'after';
	}

	const threshold = height * edgeThreshold;
	if (offsetY < threshold) return 'before';
	if (offsetY > height - threshold) return 'after';
	return 'center';
}
