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

import {useEffect, useState, useRef, type RefObject} from 'react';

const INITIAL_TOP = 16;
const RIGHT_LEFT_PCT = '88%';

export const useLandingScroll = (whyUsRef: RefObject<HTMLElement | null>) => {
	const [isPinned, setIsPinned] = useState(false);
	const [pinTop, setPinTop] = useState(0);
	const imgRef = useRef<HTMLImageElement>(null);

	useEffect(() => {
		const onScroll = () => {
			const why = whyUsRef?.current;
			const scrollY = window.scrollY || window.pageYOffset || 0;
			const Y = scrollY + INITIAL_TOP;

			if (why) {
				const whyTop = Math.max(0, why.offsetTop);
				if (Y >= whyTop) {
					if (!isPinned) {
						setIsPinned(true);
						setPinTop(whyTop);
					}
				} else if (isPinned) {
					setIsPinned(false);
				}
			}
		};

		onScroll();
		window.addEventListener('scroll', onScroll, {passive: true});
		window.addEventListener('resize', onScroll);

		return () => {
			window.removeEventListener('scroll', onScroll);
			window.removeEventListener('resize', onScroll);
		};
	}, [isPinned, whyUsRef]);

	return {
		imgRef,
		isPinned,
		pinTop,
		initialTop: INITIAL_TOP,
		rightLeftPct: RIGHT_LEFT_PCT,
	};
};
