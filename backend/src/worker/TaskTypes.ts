/*
 * Copyright (C) 2020-2026 Fluxer Contributors
 * Copyright (C) 2026 Floodilka Contributors
 *
 * This file is part of Floodilka, a fork of Fluxer
 * (https://github.com/fluxerapp/fluxer).
 * Modified by Floodilka Contributors starting March 2026.
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
 */

import type {WorkerJobOptions, WorkerJobPayload} from './IWorkerService';

export interface TaskLogger {
	debug(msg: string, meta?: object): void;
	debug(obj: object, msg?: string): void;
	info(msg: string, meta?: object): void;
	info(obj: object, msg?: string): void;
	warn(msg: string, meta?: object): void;
	warn(obj: object, msg?: string): void;
	error(msg: string, meta?: object): void;
	error(obj: object, msg?: string): void;
}

export interface TaskHelpers {
	logger: TaskLogger;
	addJob<TPayload extends WorkerJobPayload = WorkerJobPayload>(
		taskType: string,
		payload: TPayload,
		options?: WorkerJobOptions,
	): Promise<void>;
}

export type Task<P extends WorkerJobPayload = WorkerJobPayload> = (
	payload: P,
	helpers: TaskHelpers,
) => Promise<void>;
