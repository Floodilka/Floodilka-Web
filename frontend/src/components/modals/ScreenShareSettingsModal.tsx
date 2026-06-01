/*
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright (C) 2020-2026 Fluxer Contributors
 * Copyright (C) 2026 Floodilka Contributors
 * Modified by Floodilka Contributors starting March 2026. See LICENSE and NOTICE.
 */

import {Trans, useLingui} from '@lingui/react/macro';
import {CrownIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import {useMemo} from 'react';
import {Switch} from '~/components/form/Switch';
import * as Modal from '~/components/modals/Modal';
import styles from '~/components/modals/ScreenShareSettingsModal.module.css';
import {Button} from '~/components/uikit/Button/Button';
import FocusRing from '~/components/uikit/FocusRing/FocusRing';
import {useScreenShareSettingsModal} from '~/utils/modals/ScreenShareSettingsModalUtils';
import {isDesktop} from '~/utils/NativeUtils';

interface ScreenShareSettingsModalProps {
	onStartShare: (
		resolution: 'low' | 'medium' | 'high',
		frameRate: number,
		includeAudio: boolean,
	) => Promise<void>;
}

export const ScreenShareSettingsModal = observer(({onStartShare}: ScreenShareSettingsModalProps) => {
	const {t} = useLingui();
	const {
		hasPremium,
		isSharing,
		selectedResolution,
		selectedFrameRate,
		includeAudio,
		setIncludeAudio,
		handleStartShare,
		handleCancel,
		handleResolutionClick,
		handleFrameRateClick,
		RESOLUTION_OPTIONS,
		FRAMERATE_OPTIONS,
	} = useScreenShareSettingsModal({onStartShare});

	const resolutionOptions = useMemo(
		() => RESOLUTION_OPTIONS.map((option) => ({...option, label: t(option.label)})),
		[t],
	);

	const framerateOptions = useMemo(() => FRAMERATE_OPTIONS.map((option) => ({...option, label: t(option.label)})), [t]);
	const audioDescription = isDesktop()
		? t`Share system audio, excluding Floodilka voice`
		: t`Share audio from the selected browser tab`;

	const getOptionButtonClass = (isSelected: boolean, isLocked: boolean) =>
		clsx(styles.optionButton, {
			[styles.optionButtonSelected]: isSelected && !isLocked,
			[styles.optionButtonSelectedLocked]: isSelected && isLocked,
			[styles.optionButtonUnselected]: !isSelected && !isLocked,
			[styles.optionButtonUnselectedLocked]: !isSelected && isLocked,
		});

	return (
		<Modal.Root size="small" centered>
			<Modal.Header title={t`Screen Share Settings`} />
			<Modal.Content>
				<div className={styles.content}>
					<div className={styles.section}>
						<div className={styles.sectionLabel}>
							<Trans>Video Quality</Trans>
						</div>
						<div className={styles.optionGrid}>
							{resolutionOptions.map((option) => {
								const isSelected = selectedResolution === option.value;
								const isLocked = option.isPremium && !hasPremium;

								return (
									<FocusRing key={option.value} offset={-2}>
										<button
											type="button"
											onClick={() => handleResolutionClick(option.value, option.isPremium)}
											className={getOptionButtonClass(isSelected, isLocked)}
										>
											{isLocked && <CrownIcon weight="fill" size={14} className={styles.lockIcon} />}
											{option.label}
										</button>
									</FocusRing>
								);
							})}
						</div>
					</div>

					<div className={styles.section}>
						<div className={styles.sectionLabel}>
							<Trans>Frame Rate</Trans>
						</div>
						<div className={styles.optionGrid}>
							{framerateOptions.map((option) => {
								const isSelected = selectedFrameRate === option.value;
								const isLocked = option.isPremium && !hasPremium;

								return (
									<FocusRing key={option.value} offset={-2}>
										<button
											type="button"
											onClick={() => handleFrameRateClick(option.value, option.isPremium)}
											className={getOptionButtonClass(isSelected, isLocked)}
										>
											{isLocked && <CrownIcon weight="fill" size={14} className={styles.lockIcon} />}
											{option.label}
										</button>
									</FocusRing>
								);
							})}
						</div>
					</div>

					<div className={styles.section}>
						<div className={styles.audioToggleRow}>
							<div className={styles.audioToggleInfo}>
								<div className={styles.sectionLabel}>
									<Trans>Share Audio</Trans>
								</div>
								<div className={styles.audioToggleDescription}>
									{audioDescription}
								</div>
							</div>
							<Switch value={includeAudio} onChange={setIncludeAudio} />
						</div>
					</div>

					{!hasPremium && (
						<div className={styles.premiumBanner}>
							<div className={styles.premiumBannerHeader}>
								<CrownIcon weight="fill" size={16} className={styles.premiumBannerIcon} />
								<span className={styles.premiumBannerTitle}>
									<Trans>Unlock HD Video with Premium</Trans>
								</span>
							</div>
							<p className={styles.premiumBannerDescription}>
								<Trans>
									Get High (1080p) resolution and 60 fps for the smoothest experience.
								</Trans>
							</p>
						</div>
					)}
				</div>
			</Modal.Content>
			<Modal.Footer>
				<Button variant="secondary" onClick={handleCancel}>
					<Trans>Cancel</Trans>
				</Button>
				<Button onClick={handleStartShare} submitting={isSharing}>
					<Trans>Start Sharing</Trans>
				</Button>
			</Modal.Footer>
		</Modal.Root>
	);
});
