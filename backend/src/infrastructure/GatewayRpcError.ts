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

export const GatewayRpcMethodErrorCodes = {
	GUILD_NOT_FOUND: 'guild_not_found',
	FORBIDDEN: 'forbidden',
	USER_NOT_IN_VOICE: 'user_not_in_voice',
	NO_ACTIVE_CALL: 'no_active_call',
	CALL_ALREADY_EXISTS: 'call_already_exists',
	INVALID_CHANNEL_TYPE_FOR_CALL: 'invalid_channel_type_for_call',
	UNKNOWN_CHANNEL: 'unknown_channel',
	OVERLOADED: 'overloaded',
	MISSING_PERMISSIONS: 'missing_permissions',
} as const;

export type GatewayRpcMethodErrorCode = (typeof GatewayRpcMethodErrorCodes)[keyof typeof GatewayRpcMethodErrorCodes];

export class GatewayRpcMethodError extends Error {
	readonly code: string;

	constructor(code: string, message?: string) {
		super(message ?? code);
		this.name = 'GatewayRpcMethodError';
		this.code = code;
	}
}
