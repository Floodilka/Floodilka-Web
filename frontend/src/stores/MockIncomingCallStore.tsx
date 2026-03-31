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

import {makeAutoObservable} from 'mobx';
import type {ChannelRecord} from '~/records/ChannelRecord';
import type {UserRecord} from '~/records/UserRecord';

interface MockIncomingCallData {
	channel: ChannelRecord;
	initiator: UserRecord;
}

class MockIncomingCallStore {
	mockCall: MockIncomingCallData | null = null;

	constructor() {
		makeAutoObservable(this);
	}

	setMockCall(data: MockIncomingCallData): void {
		this.mockCall = data;
	}

	clearMockCall(): void {
		this.mockCall = null;
	}

	isMockCall(channelId: string): boolean {
		return this.mockCall?.channel.id === channelId;
	}
}

export default new MockIncomingCallStore();
