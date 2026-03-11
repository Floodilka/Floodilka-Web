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
