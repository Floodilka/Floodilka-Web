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

import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type {ReactElement} from 'react';
import {GenericErrorModal} from './GenericErrorModal';

export const GroupOwnershipTransferFailedModal: React.FC<{username?: string}> = observer(({username}) => {
	const {t} = useLingui();
	const message: ReactElement = (
		<Trans>
			Ownership could not be transferred to <strong>{username}</strong> at this time.
		</Trans>
	);
	return <GenericErrorModal title={t`Failed to transfer ownership`} message={message} />;
});
