/*
 * Copyright (C) 2026 Fluxer Contributors
 *
 * This file is part of Fluxer.
 *
 * Fluxer is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Fluxer is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Fluxer. If not, see <https://www.gnu.org/licenses/>.
 */

import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import * as AuthenticationActionCreators from '~/actions/AuthenticationActionCreators';
import {ConfirmModal} from '~/components/modals/ConfirmModal';

export const LogoutModal = observer(() => {
	const {t} = useLingui();
	return (
		<ConfirmModal
			title={t`Log out`}
			description={<Trans>Are you sure you want to log out?</Trans>}
			primaryText={t`Log out`}
			secondaryText={t`Cancel`}
			onPrimary={() => AuthenticationActionCreators.logout()}
		/>
	);
});
