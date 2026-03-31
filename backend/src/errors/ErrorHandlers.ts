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

import * as Sentry from '@sentry/node';
import type {ErrorHandler, NotFoundHandler} from 'hono';
import {HTTPException} from 'hono/http-exception';
import type {HonoEnv} from '~/App';
import {APIErrorCodes} from '~/Constants';
import {Logger} from '~/Logger';
import {FloodilkaAPIError} from './FloodilkaAPIError';

export const AppErrorHandler: ErrorHandler<HonoEnv> = (err) => {
	const isExpectedError = err instanceof Error && 'isExpected' in err && err.isExpected;

	if (!(err instanceof FloodilkaAPIError || isExpectedError)) {
		Sentry.captureException(err);
	}

	if (err instanceof FloodilkaAPIError) {
		return err.getResponse();
	}
	if (err instanceof HTTPException) {
		return new Response(JSON.stringify({code: APIErrorCodes.GENERAL_ERROR, message: err.message}), {
			status: err.status,
			headers: {'Content-Type': 'application/json'},
		});
	}
	if (isExpectedError) {
		Logger.warn({err}, 'Expected error occurred');
		return new Response(JSON.stringify({code: APIErrorCodes.GENERAL_ERROR, message: err.message}), {
			status: 400,
			headers: {'Content-Type': 'application/json'},
		});
	}
	Logger.error({err}, 'Unhandled error occurred');
	const error = new FloodilkaAPIError({
		code: APIErrorCodes.GENERAL_ERROR,
		message: 'Произошла внутренняя ошибка сервера.',
		status: 500,
	});
	return error.getResponse();
};

export const AppNotFoundHandler: NotFoundHandler<HonoEnv> = () => {
	const error = new FloodilkaAPIError({
		code: APIErrorCodes.GENERAL_ERROR,
		message: 'Запрашиваемый эндпоинт не существует.',
		status: 404,
	});
	return error.getResponse();
};
