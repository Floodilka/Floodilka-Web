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

import {HTTPException} from 'hono/http-exception';

type ErrorStatusCode = 202 | 400 | 401 | 403 | 404 | 423 | 429 | 500 | 502 | 503 | 504;

export type FloodilkaErrorData = Record<string, unknown>;

export class FloodilkaAPIError extends HTTPException {
	code: string;
	override message: string;
	override status: ErrorStatusCode;
	data?: FloodilkaErrorData;
	headers?: Record<string, string>;

	constructor({
		code,
		message,
		status,
		data,
		headers,
	}: {
		code: string;
		message: string;
		status: ErrorStatusCode;
		data?: FloodilkaErrorData;
		headers?: Record<string, string>;
	}) {
		super(status, {message});
		this.code = code;
		this.message = message;
		this.status = status;
		this.data = data;
		this.headers = headers;
		this.name = 'FloodilkaAPIError';
	}

	override getResponse(): Response {
		return new Response(
			JSON.stringify({
				code: this.code,
				message: this.message,
				...this.data,
			}),
			{
				status: this.status,
				headers: {
					'Content-Type': 'application/json',
					...this.headers,
				},
			},
		);
	}
}
