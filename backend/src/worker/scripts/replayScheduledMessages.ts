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

import 'module-alias/register';
import {fetchMany} from '~/database/Cassandra';
import type {ScheduledMessageRow} from '~/database/types/UserTypes';
import {Logger} from '~/Logger';
import {shutdownQueue} from '~/worker/BullMQConnection';
import {WorkerService} from '~/worker/WorkerService';

const SCHEDULED_TASK_NAME = 'sendScheduledMessage';

interface ScheduledRow extends ScheduledMessageRow {}

async function main() {
	Logger.info('Starting replay of pending scheduled messages...');

	const cql = `
		SELECT user_id, scheduled_message_id, channel_id, scheduled_at, status, invalidated_at
		FROM scheduled_messages
		WHERE status = 'scheduled'
		ALLOW FILTERING
	`;

	const rows = await fetchMany<ScheduledRow>(cql, {});
	Logger.info({total: rows.length}, 'Fetched scheduled messages');

	const now = Date.now();
	const candidates = rows.filter((r) => {
		if (r.invalidated_at !== null) return false;
		if (!r.scheduled_at) return false;
		return r.scheduled_at.getTime() > now;
	});

	Logger.info({pending: candidates.length, skipped: rows.length - candidates.length}, 'Filtered to enqueue');

	const workerService = new WorkerService();
	let enqueued = 0;
	let failed = 0;

	for (const row of candidates) {
		try {
			await workerService.addJob(
				SCHEDULED_TASK_NAME,
				{
					userId: row.user_id.toString(),
					scheduledMessageId: row.scheduled_message_id.toString(),
					expectedScheduledAt: row.scheduled_at.toISOString(),
				},
				{
					runAt: row.scheduled_at,
					jobKey: `replay-${row.scheduled_message_id.toString()}`,
				},
			);
			enqueued++;
		} catch (err) {
			Logger.error({err, scheduledMessageId: row.scheduled_message_id.toString()}, 'Failed to enqueue replay');
			failed++;
		}
	}

	Logger.info({enqueued, failed}, 'Replay complete');

	await shutdownQueue();
	process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
	Logger.error({err}, 'Replay script crashed');
	process.exit(2);
});
