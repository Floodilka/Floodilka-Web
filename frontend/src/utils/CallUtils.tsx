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

import * as CallActionCreators from '~/actions/CallActionCreators';
import * as ModalActionCreators from '~/actions/ModalActionCreators';
import {modal} from '~/actions/ModalActionCreators';
import {CallNotRingableModal} from '~/components/alerts/CallNotRingableModal';

export async function checkAndStartCall(channelId: string, silent = false): Promise<boolean> {
	try {
		const {ringable} = await CallActionCreators.checkCallEligibility(channelId);
		if (!ringable) {
			ModalActionCreators.push(modal(() => <CallNotRingableModal />));
			return false;
		}
		CallActionCreators.startCall(channelId, silent);
		return true;
	} catch (error) {
		console.error('Failed to check call eligibility:', error);
		return false;
	}
}
