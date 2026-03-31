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

import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {SettingsSection} from '~/components/modals/shared/SettingsSection';
import NotificationStore from '~/stores/NotificationStore';
import SoundStore from '~/stores/SoundStore';
import styles from './Inline.module.css';
import {Notifications} from './Notifications';
import {Sounds} from './Sounds';
import {useSoundSettings} from './useSoundSettings';

export const NotificationsInlineTab: React.FC = observer(() => {
	const {t} = useLingui();
	const browserNotificationsEnabled = NotificationStore.browserNotificationsEnabled;
	const unreadMessageBadgeEnabled = NotificationStore.unreadMessageBadgeEnabled;
	const soundSettings = SoundStore.settings;

	const {
		hasPremium,
		soundTypeLabels,
		customSounds,
		handleToggleAllSounds,
		handleToggleSound,
		handleEnableAllSounds,
		handleDisableAllSounds,
		handlePreviewSound,
		handleUploadClick,
		handleCustomSoundDelete,
	} = useSoundSettings();

	return (
		<div className={styles.container}>
			<SettingsSection id="notifications" title={t`Notifications`}>
				<Notifications
					browserNotificationsEnabled={browserNotificationsEnabled}
					unreadMessageBadgeEnabled={unreadMessageBadgeEnabled}
				/>
			</SettingsSection>
			<SettingsSection id="sounds" title={t`Sounds`}>
				<Sounds
					soundSettings={soundSettings}
					hasPremium={hasPremium}
					soundTypeLabels={soundTypeLabels}
					customSounds={customSounds}
					onToggleAllSounds={handleToggleAllSounds}
					onToggleSound={handleToggleSound}
					onEnableAllSounds={handleEnableAllSounds}
					onDisableAllSounds={handleDisableAllSounds}
					onPreviewSound={handlePreviewSound}
					onUploadClick={handleUploadClick}
					onCustomSoundDelete={handleCustomSoundDelete}
				/>
			</SettingsSection>
		</div>
	);
});
