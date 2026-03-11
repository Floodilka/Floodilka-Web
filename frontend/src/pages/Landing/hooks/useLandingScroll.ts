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
