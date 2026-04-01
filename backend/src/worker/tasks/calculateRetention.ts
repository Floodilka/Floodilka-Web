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

import type {Task} from 'graphile-worker';
import {getMetricsService} from '~/infrastructure/MetricsService';
import {Logger} from '~/Logger';
import {getWorkerDependencies} from '../WorkerContext';

const RETENTION_WINDOWS: Array<[string, number]> = [
	['d1', 1],
	['d7', 7],
	['d30', 30],
];

const calculateRetention: Task = async (_payload, _helpers) => {
	const {redis} = getWorkerDependencies();
	const metrics = getMetricsService();
	const today = new Date().toISOString().slice(0, 10);

	for (const [window, days] of RETENTION_WINDOWS) {
		try {
			const cohortDate = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
			const cohortKey = `registrations:${cohortDate}`;
			const cohortUsers = await redis.smembers(cohortKey);

			if (cohortUsers.length === 0) {
				continue;
			}

			const pipeline = redis.pipeline();
			for (const userId of cohortUsers) {
				pipeline.exists(`dau:${today}:${userId}`);
			}
			const results = await pipeline.exec();
			if (!results) {
				Logger.warn({window, cohortDate}, 'Retention pipeline returned null');
				continue;
			}

			const activeCount = results.filter(([err, val]) => !err && val === 1).length;
			const rate = (activeCount / cohortUsers.length) * 100;

			metrics.gauge({
				name: 'retention.rate',
				dimensions: {window, cohort_date: cohortDate},
				value: Math.round(rate * 10) / 10,
			});
			metrics.gauge({
				name: 'retention.cohort_size',
				dimensions: {window, cohort_date: cohortDate},
				value: cohortUsers.length,
			});
			metrics.gauge({
				name: 'retention.active_count',
				dimensions: {window, cohort_date: cohortDate},
				value: activeCount,
			});

			Logger.info(
				{window, cohortDate, cohortSize: cohortUsers.length, activeCount, rate: Math.round(rate * 10) / 10},
				'Retention calculated',
			);
		} catch (error) {
			Logger.error({error, window}, 'Failed to calculate retention for window');
		}
	}
};

export default calculateRetention;
