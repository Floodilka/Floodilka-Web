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

import {useState, useEffect, useCallback} from 'react';

export const useMenu = () => {
	const [menuOpen, setMenuOpen] = useState(false);

	useEffect(() => {
		const onResize = () => {
			if (window.innerWidth > 768 && menuOpen) {
				setMenuOpen(false);
			}
		};
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	}, [menuOpen]);

	useEffect(() => {
		if (menuOpen) {
			const prev = document.body.style.overflow;
			document.body.style.overflow = 'hidden';
			return () => {
				document.body.style.overflow = prev;
			};
		}
	}, [menuOpen]);

	const toggleMenu = useCallback(() => setMenuOpen((prev) => !prev), []);
	const closeMenu = useCallback(() => setMenuOpen(false), []);

	return {menuOpen, toggleMenu, closeMenu};
};
