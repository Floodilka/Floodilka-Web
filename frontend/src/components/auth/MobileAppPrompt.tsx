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

import {Trans} from '@lingui/react/macro';
import {ArrowSquareOutIcon} from '@phosphor-icons/react';
import type React from 'react';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Button} from '~/components/uikit/Button/Button';
import {buildAppProtocolUrl} from '~/utils/appProtocol';
import {isDesktop} from '~/utils/NativeUtils';
import styles from './MobileAppPrompt.module.css';

const SMART_BANNER_APP_ID = '6755156241';
const BASE_SMART_BANNER_CONTENT = `app-id=${SMART_BANNER_APP_ID}`;

interface MobileAppPromptProps {
	code: string;
	kind: 'invite';
}

type MobilePlatform = 'ios' | 'android' | 'other';

const APP_STORE_URL = 'https://apps.apple.com/app/id6755156241';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.floodilka.android';
const FALLBACK_DELAY_MS = 2000;

const detectPlatform = (): MobilePlatform => {
	if (typeof navigator === 'undefined') return 'other';
	const ua = navigator.userAgent ?? '';
	if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
	if (/Android/i.test(ua)) return 'android';
	const isIPadOSDesktopMode =
		typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1 && /Macintosh/.test(ua);
	if (isIPadOSDesktopMode) return 'ios';
	return 'other';
};

const detectInAppBrowser = (): boolean => {
	if (typeof navigator === 'undefined') return false;
	const ua = navigator.userAgent ?? '';
	return /Telegram|Instagram|FBAN|FBAV|FB_IAB|Twitter|VKAndroidApp|VkMessenger|OKApp|Line\/|MicroMessenger/i.test(ua);
};

export const MobileAppPrompt: React.FC<MobileAppPromptProps> = ({code, kind}) => {
	const platform = useMemo(detectPlatform, []);
	const inAppBrowser = useMemo(detectInAppBrowser, []);
	const [opening, setOpening] = useState(false);
	const fallbackTimerRef = useRef<number | null>(null);

	useEffect(() => {
		if (typeof document === 'undefined') return undefined;
		const meta = document.querySelector('meta[name="apple-itunes-app"]') as HTMLMetaElement | null;
		if (!meta) return undefined;
		const previous = meta.content;
		const argument = `${window.location.origin}/${kind}/${code}`;
		meta.content = `${BASE_SMART_BANNER_CONTENT}, app-argument=${argument}`;
		return () => {
			meta.content = previous || BASE_SMART_BANNER_CONTENT;
		};
	}, [code, kind]);

	const handleOpen = useCallback(() => {
		const storeUrl = platform === 'ios' ? APP_STORE_URL : PLAY_STORE_URL;
		const deepLink = buildAppProtocolUrl(`${kind}/${code}`);

		setOpening(true);

		const cleanup = () => {
			if (fallbackTimerRef.current != null) {
				window.clearTimeout(fallbackTimerRef.current);
				fallbackTimerRef.current = null;
			}
			document.removeEventListener('visibilitychange', onVisibilityChange);
			window.removeEventListener('pagehide', cleanup);
		};

		const onVisibilityChange = () => {
			if (document.visibilityState === 'hidden') {
				cleanup();
			}
		};

		fallbackTimerRef.current = window.setTimeout(() => {
			cleanup();
			if (document.visibilityState === 'visible') {
				window.location.href = storeUrl;
			}
		}, FALLBACK_DELAY_MS);

		document.addEventListener('visibilitychange', onVisibilityChange);
		window.addEventListener('pagehide', cleanup);

		window.location.href = deepLink;
	}, [code, kind, platform]);

	if (isDesktop()) return null;
	if (platform === 'other') return null;

	if (inAppBrowser) {
		return (
			<div className={styles.banner}>
				<div className={styles.copy}>
					<p className={styles.title}>
						<Trans>Open in Флудилка</Trans>
					</p>
					<p className={styles.body}>
						{platform === 'ios' ? (
							<Trans>Tap the menu (⋯) at the top and choose «Open in Safari» — the app will open automatically.</Trans>
						) : (
							<Trans>Open this link in Chrome or another browser — the app will open automatically.</Trans>
						)}
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className={styles.banner}>
			<div className={styles.copy}>
				<p className={styles.title}>
					<Trans>Open in Флудилка</Trans>
				</p>
				<p className={styles.body}>
					<Trans>Continue in the mobile app for the best experience.</Trans>
				</p>
			</div>
			<Button variant="primary" onClick={handleOpen} className={styles.cta} submitting={opening}>
				<ArrowSquareOutIcon size={18} weight="fill" />
				<span>
					<Trans>Open app</Trans>
				</span>
			</Button>
		</div>
	);
};
