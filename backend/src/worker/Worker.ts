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

import '../instrument';
import 'module-alias/register';
import * as Sentry from '@sentry/node';
import {type Job, Worker as BullMQWorker} from 'bullmq';
import {Redis} from 'ioredis';
import {Config} from '~/Config';
import {getMetricsService, initializeMetricsService} from '~/infrastructure/MetricsService';
import {SnowflakeService} from '~/infrastructure/SnowflakeService';
import {Logger} from '~/Logger';
import {initializeMeilisearch} from '~/Meilisearch';
import {bullmqConnection, FLOODILKA_QUEUE_NAME, getQueue, shutdownQueue} from '~/worker/BullMQConnection';
import applicationProcessDeletion from '~/worker/tasks/applicationProcessDeletion';
import batchGuildAuditLogMessageDeletes from '~/worker/tasks/batchGuildAuditLogMessageDeletes';
import bulkDeleteUserMessages from '~/worker/tasks/bulkDeleteUserMessages';
import calculateRetention from '~/worker/tasks/calculateRetention';
import deleteUserMessagesInGuildByTime from '~/worker/tasks/deleteUserMessagesInGuildByTime';
import expireAttachments from '~/worker/tasks/expireAttachments';
import extractEmbeds from '~/worker/tasks/extractEmbeds';
import handleMentions from '~/worker/tasks/handleMentions';
import harvestGuildData from '~/worker/tasks/harvestGuildData';
import harvestUserData from '~/worker/tasks/harvestUserData';
import indexChannelMessages from '~/worker/tasks/indexChannelMessages';
import messageShred from '~/worker/tasks/messageShred';
import processAssetDeletionQueue from '~/worker/tasks/processAssetDeletionQueue';
import processCloudfarePurgeQueue from '~/worker/tasks/processCloudfarePurgeQueue';
import processInactivityDeletions from '~/worker/tasks/processInactivityDeletions';
import processPendingBulkMessageDeletions from '~/worker/tasks/processPendingBulkMessageDeletions';
import refreshSearchIndex from '~/worker/tasks/refreshSearchIndex';
import {sendScheduledMessage} from '~/worker/tasks/sendScheduledMessage';
import userProcessPendingDeletion from '~/worker/tasks/userProcessPendingDeletion';
import userProcessPendingDeletions from '~/worker/tasks/userProcessPendingDeletions';
import type {Task, TaskHelpers, TaskLogger} from '~/worker/TaskTypes';
import {setWorkerDependencies} from './WorkerContext';
import {initializeWorkerDependencies, shutdownWorkerDependencies} from './WorkerDependencies';
import {WorkerMetricsCollector} from './WorkerMetricsCollector';
import {WorkerService} from './WorkerService';

const taskList: Record<string, Task> = {
	applicationProcessDeletion,
	batchGuildAuditLogMessageDeletes,
	bulkDeleteUserMessages,
	calculateRetention,
	deleteUserMessagesInGuildByTime,
	expireAttachments,
	extractEmbeds,
	handleMentions,
	harvestGuildData,
	harvestUserData,
	indexChannelMessages,
	messageShred,
	processAssetDeletionQueue,
	processCloudfarePurgeQueue,
	processInactivityDeletions,
	processPendingBulkMessageDeletions,
	refreshSearchIndex,
	sendScheduledMessage,
	userProcessPendingDeletion,
	userProcessPendingDeletions,
};

const cronSchedule: Array<{taskName: string; pattern: string}> = [
	{taskName: 'processCloudfarePurgeQueue', pattern: '* * * * *'},
	{taskName: 'processAssetDeletionQueue', pattern: '* * * * *'},
	{taskName: 'processPendingBulkMessageDeletions', pattern: '* * * * *'},
	{taskName: 'expireAttachments', pattern: '15 * * * *'},
	{taskName: 'userProcessPendingDeletions', pattern: '0 3 * * *'},
	{taskName: 'processInactivityDeletions', pattern: '0 4 * * 0'},
	{taskName: 'calculateRetention', pattern: '0 23 * * *'},
];

function createTaskLogger(job: Job): TaskLogger {
	return Logger.child({task: job.name, jobId: job.id});
}

async function main() {
	Logger.info('Starting BullMQ Worker...');

	initializeMetricsService(Config.metrics.host ?? null);
	Logger.info('MetricsService initialized');

	const snowflakeRedis = new Redis(Config.redis.url);
	const snowflakeService = new SnowflakeService(snowflakeRedis);
	await snowflakeService.initialize();
	Logger.info('Shared SnowflakeService initialized');

	const dependencies = await initializeWorkerDependencies(snowflakeService);

	setWorkerDependencies(dependencies);

	const workerService = new WorkerService();

	try {
		await initializeMeilisearch();

		const queue = getQueue();

		Logger.info('Registering cron jobs as BullMQ Job Schedulers');
		for (const {taskName, pattern} of cronSchedule) {
			await queue.upsertJobScheduler(
				`cron-${taskName}`,
				{pattern},
				{
					name: taskName,
					data: {},
					opts: {removeOnComplete: true, removeOnFail: {age: 24 * 60 * 60}},
				},
			);
		}
		Logger.info({count: cronSchedule.length}, 'Cron jobs registered');

		const workerConcurrency = 5;

		const jobTimings = new Map<string, number>();

		const bullWorker = new BullMQWorker(
			FLOODILKA_QUEUE_NAME,
			async (job: Job) => {
				const handler = taskList[job.name];
				if (!handler) {
					throw new Error(`Unknown task type: ${job.name}`);
				}
				const helpers: TaskHelpers = {
					logger: createTaskLogger(job),
					addJob: (taskType, payload, options) => workerService.addJob(taskType, payload, options),
				};
				await handler(job.data, helpers);
			},
			{
				connection: bullmqConnection,
				concurrency: workerConcurrency,
			},
		);

		bullWorker.on('active', (job) => {
			jobTimings.set(job.id ?? `${job.name}:${job.timestamp}`, performance.now());

			if (job.opts.delay) {
				const waitTimeMs = Date.now() - job.timestamp;
				if (waitTimeMs > 0) {
					getMetricsService().histogram({
						name: 'worker.job.wait_time',
						dimensions: {task: job.name},
						valueMs: waitTimeMs,
					});
				}
			}
		});

		bullWorker.on('completed', (job) => {
			const key = job.id ?? `${job.name}:${job.timestamp}`;
			const startTime = jobTimings.get(key) ?? performance.now();
			const durationMs = performance.now() - startTime;
			jobTimings.delete(key);

			getMetricsService().counter({
				name: 'worker.job.success',
				dimensions: {task: job.name},
			});
			getMetricsService().histogram({
				name: 'worker.job.latency',
				dimensions: {task: job.name, status: 'success'},
				valueMs: durationMs,
			});
		});

		bullWorker.on('failed', (job, error) => {
			if (!job) {
				Logger.error({err: error}, 'Job failed without job context');
				Sentry.captureException(error);
				return;
			}
			const key = job.id ?? `${job.name}:${job.timestamp}`;
			const startTime = jobTimings.get(key) ?? performance.now();
			const durationMs = performance.now() - startTime;
			jobTimings.delete(key);

			getMetricsService().counter({
				name: 'worker.job.error',
				dimensions: {task: job.name},
			});
			getMetricsService().histogram({
				name: 'worker.job.latency',
				dimensions: {task: job.name, status: 'error'},
				valueMs: durationMs,
			});

			const attemptsMade = job.attemptsMade ?? 0;
			const maxAttempts = job.opts.attempts ?? 1;
			const willRetry = attemptsMade < maxAttempts;

			if (attemptsMade > 1) {
				getMetricsService().counter({
					name: 'worker.job.retry',
					dimensions: {task: job.name},
				});
			}
			getMetricsService().counter({
				name: willRetry ? 'worker.job.retry_scheduled' : 'worker.job.permanently_failed',
				dimensions: {task: job.name},
			});

			Sentry.withScope((scope) => {
				scope.setTag('task', job.name);
				scope.setExtra('job_id', job.id);
				scope.setExtra('attempts_made', attemptsMade);
				scope.setExtra('max_attempts', maxAttempts);
				scope.setExtra('payload', job.data);
				Sentry.captureException(error);
			});
		});

		bullWorker.on('error', (error) => {
			Logger.error({err: error}, 'BullMQ Worker error');
			Sentry.captureException(error);
		});

		Logger.info({concurrency: workerConcurrency}, 'BullMQ Worker started successfully');

		const metricsCollector = new WorkerMetricsCollector({
			queue,
			redis: dependencies.redis,
			metricsService: getMetricsService(),
			assetDeletionQueue: dependencies.assetDeletionQueue,
			cloudflarePurgeQueue: dependencies.cloudflarePurgeQueue,
			bulkMessageDeletionQueue: dependencies.bulkMessageDeletionQueueService,
			accountDeletionQueue: dependencies.deletionQueueService,
			workerConcurrency,
		});
		metricsCollector.start();
		Logger.info('WorkerMetricsCollector started');

		const shutdown = async () => {
			Logger.info('Shutting down BullMQ Worker...');
			metricsCollector.stop();
			await bullWorker.close();
			await shutdownQueue();
			await snowflakeService.shutdown();
			await shutdownWorkerDependencies(dependencies);
			await snowflakeRedis.quit();
			process.exit(0);
		};

		process.on('SIGINT', shutdown);
		process.on('SIGTERM', shutdown);

		process.on('uncaughtException', async (error) => {
			Logger.error({err: error}, 'Uncaught Exception');
			Sentry.captureException(error);
			await Sentry.flush(2000);
			shutdown();
		});

		process.on('unhandledRejection', async (reason) => {
			Logger.error({err: reason}, 'Unhandled Rejection at Promise');
			Sentry.captureException(reason);
			await Sentry.flush(2000);
			shutdown();
		});

		await new Promise<void>(() => {
			// Keep the process alive; bullWorker handles its own loop
		});
	} catch (error) {
		Logger.error({err: error}, 'Failed to start BullMQ Worker');
		Sentry.captureException(error);
		await Sentry.flush(2000);
		process.exit(1);
	}
}

main();
