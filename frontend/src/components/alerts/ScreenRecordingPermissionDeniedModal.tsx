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
import {ConfirmModal} from '~/components/modals/ConfirmModal';
import {openNativePermissionSettings} from '~/utils/NativePermissions';

export const ScreenRecordingPermissionDeniedModal = observer(() => {
	const {t} = useLingui();

	return (
		<ConfirmModal
			title={t`Screen Recording Permission Required`}
			description={t`Флудилка needs access to screen recording. Open System Settings → Privacy & Security → Screen Recording, allow Флудилка, and then try again.`}
			primaryText={t`Open Settings`}
			primaryVariant="primary"
			onPrimary={() => openNativePermissionSettings('screen')}
			secondaryText={t`Close`}
		/>
	);
});
