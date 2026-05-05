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
import type {DesktopSource, DisplayMediaRequestInfo, ScreenShareAudioMode} from '~/../src-electron/common/types';
import * as ModalActionCreators from '~/actions/ModalActionCreators';
import {modal} from '~/actions/ModalActionCreators';
import {ScreenRecordingPermissionDeniedModal} from '~/components/alerts/ScreenRecordingPermissionDeniedModal';
import {ScreenShareSourceModal} from '~/components/modals/ScreenShareSourceModal';
import {Logger} from '~/lib/Logger';
import MediaPermissionStore from '~/stores/MediaPermissionStore';
import {checkNativePermission} from '~/utils/NativePermissions';
import {getElectronAPI, isNativeMacOS} from '~/utils/NativeUtils';

const logger = new Logger('ElectronScreenSharePicker');
const DESKTOP_SOURCE_TYPES: Array<'screen' | 'window'> = ['screen', 'window'];

const SCREEN_SHARE_SELECTION_TIMEOUT_MS = 55_000;

const promptDesktopSourceSelection = (
	sources: Array<DesktopSource>,
	audioMode: ScreenShareAudioMode,
): Promise<string | null> => {
	return new Promise((resolve) => {
		let resolved = false;
		let selectionTimeoutId: ReturnType<typeof setTimeout> | null = null;

		const clearSelectionTimeout = () => {
			if (selectionTimeoutId !== null) {
				clearTimeout(selectionTimeoutId);
				selectionTimeoutId = null;
			}
		};

		const handleSelection = (sourceId: string | null) => {
			if (resolved) return;
			resolved = true;
			clearSelectionTimeout();
			ModalActionCreators.pop();
			resolve(sourceId);
		};

		selectionTimeoutId = setTimeout(() => handleSelection(null), SCREEN_SHARE_SELECTION_TIMEOUT_MS);

		ModalActionCreators.push(
			modal(() => (
				<ScreenShareSourceModal sources={sources} audioMode={audioMode} onSelect={handleSelection} />
			)),
		);
	});
};

export const useElectronScreenSharePicker = (): void => {
	useEffect(() => {
		const electronApi = getElectronAPI();
		if (!electronApi || !electronApi.onDisplayMediaRequested) {
			logger.info('[useEffect] Screen share picker unavailable (missing platform handler)');
			return;
		}

		let handlingRequest = false;

		const handleRequest = async (requestId: string, info: DisplayMediaRequestInfo) => {
			const requestedAudioMode: ScreenShareAudioMode = info.audioRequested ? 'system' : 'off';

			if (handlingRequest) {
				electronApi.selectDisplayMediaSource(requestId, null, 'off');
				return;
			}

			handlingRequest = true;

			try {
				if (isNativeMacOS()) {
					const permission = await checkNativePermission('screen');
					if (permission === 'denied') {
						logger.warn('[handleRequest] Screen recording permission denied');
						if (!MediaPermissionStore.isScreenRecordingExplicitlyDenied()) {
							MediaPermissionStore.markScreenRecordingExplicitlyDenied();
							ModalActionCreators.push(modal(() => <ScreenRecordingPermissionDeniedModal />));
						}
						electronApi.selectDisplayMediaSource(requestId, null, 'off');
						return;
					}
				}

				const sources = await electronApi.getDesktopSources(DESKTOP_SOURCE_TYPES);
				if (sources.length === 0) {
					logger.warn('[handleRequest] No desktop sources available');
					electronApi.selectDisplayMediaSource(requestId, null, 'off');
					return;
				}

				const selectedSourceId = await promptDesktopSourceSelection(sources, requestedAudioMode);
				electronApi.selectDisplayMediaSource(requestId, selectedSourceId, requestedAudioMode);
			} catch (error) {
				logger.error('[handleRequest] Failed to handle display media request', error);
				electronApi.selectDisplayMediaSource(requestId, null, 'off');
			} finally {
				handlingRequest = false;
			}
		};

		const unsubscribe = electronApi.onDisplayMediaRequested((requestId, info) => {
			void handleRequest(requestId, info);
		});

		return () => {
			unsubscribe();
		};
	}, []);
};
