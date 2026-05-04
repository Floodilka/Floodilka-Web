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

import type {Job, Queue} from 'bullmq';
import type {Redis} from 'ioredis';
import type {AssetDeletionQueue} from '~/infrastructure/AssetDeletionQueue';
import type {ICloudflarePurgeQueue} from '~/infrastructure/CloudflarePurgeQueue';
import type {IMetricsService} from '~/infrastructure/IMetricsService';
import type {RedisAccountDeletionQueueService} from '~/infrastructure/RedisAccountDeletionQueueService';
import type {RedisBulkMessageDeletionQueueService} from '~/infrastructure/RedisBulkMessageDeletionQueueService';
import {Logger} from '~/Logger';

const DEFAULT_REPORT_INTERVAL_MS = 30000;
const PER_TASK_SCAN_LIMIT = 5000;

interface JobStats {
	task: string;
	pending: number;
	running: number;
	failed: number;
}

interface WorkerMetricsCollectorOptions {
	queue: Queue;
	redis: Redis;
	metricsService: IMetricsService;
	assetDeletionQueue: AssetDeletionQueue;
	cloudflarePurgeQueue: ICloudflarePurgeQueue;
	bulkMessageDeletionQueue: RedisBulkMessageDeletionQueueService;
	accountDeletionQueue: RedisAccountDeletionQueueService;
	reportIntervalMs?: number;
	workerConcurrency?: number;
}

export class WorkerMetricsCollector {
	private readonly queue: Queue;
	private readonly redis: Redis;
	private readonly metricsService: IMetricsService;
	private readonly assetDeletionQueue: AssetDeletionQueue;
	private readonly cloudflarePurgeQueue: ICloudflarePurgeQueue;
	private readonly bulkMessageDeletionQueue: RedisBulkMessageDeletionQueueService;
	private readonly accountDeletionQueue: RedisAccountDeletionQueueService;
	private readonly reportIntervalMs: number;
	private readonly workerConcurrency: number;
	private intervalHandle: ReturnType<typeof setInterval> | null = null;
	private redisCommandErrorCount = 0;
	private redisErrorHandler: (() => void) | null = null;

	constructor(options: WorkerMetricsCollectorOptions) {
		this.queue = options.queue;
		this.redis = options.redis;
		this.metricsService = options.metricsService;
		this.assetDeletionQueue = options.assetDeletionQueue;
		this.cloudflarePurgeQueue = options.cloudflarePurgeQueue;
		this.bulkMessageDeletionQueue = options.bulkMessageDeletionQueue;
		this.accountDeletionQueue = options.accountDeletionQueue;
		this.reportIntervalMs = options.reportIntervalMs ?? DEFAULT_REPORT_INTERVAL_MS;
		this.workerConcurrency = options.workerConcurrency ?? 5;
		this.setupRedisErrorTracking();
	}

	private setupRedisErrorTracking(): void {
		this.redisErrorHandler = () => {
			this.redisCommandErrorCount++;
		};
		this.redis.on('error', this.redisErrorHandler);
	}

	start(): void {
		if (this.intervalHandle) {
			return;
		}

		Logger.info({intervalMs: this.reportIntervalMs}, 'Starting WorkerMetricsCollector');

		this.collectAndReport().catch((err) => {
			Logger.error({err}, 'Initial metrics collection failed');
		});

		this.intervalHandle = setInterval(() => {
			this.collectAndReport().catch((err) => {
				Logger.error({err}, 'Metrics collection failed');
			});
		}, this.reportIntervalMs);
	}

	stop(): void {
		if (this.intervalHandle) {
			clearInterval(this.intervalHandle);
			this.intervalHandle = null;
			Logger.info('Stopped WorkerMetricsCollector');
		}
		if (this.redisErrorHandler) {
			this.redis.off('error', this.redisErrorHandler);
			this.redisErrorHandler = null;
		}
	}

	private async collectAndReport(): Promise<void> {
		const [jobStats, redisQueueSizes, redisConnectionStatus] = await Promise.all([
			this.collectBullMQJobStats(),
			this.collectRedisQueueSizes(),
			this.collectRedisConnectionStatus(),
		]);

		this.reportJobStats(jobStats);
		this.reportRedisQueueSizes(redisQueueSizes);
		this.reportWorkerConcurrencyUtilization(jobStats);
		this.reportRedisHealthMetrics(redisConnectionStatus);
	}

	private async collectBullMQJobStats(): Promise<Array<JobStats>> {
		try {
			const [waiting, active, failed, delayed] = await Promise.all([
				this.queue.getJobs(['waiting'], 0, PER_TASK_SCAN_LIMIT - 1),
				this.queue.getJobs(['active'], 0, PER_TASK_SCAN_LIMIT - 1),
				this.queue.getJobs(['failed'], 0, PER_TASK_SCAN_LIMIT - 1),
				this.queue.getJobs(['delayed'], 0, PER_TASK_SCAN_LIMIT - 1),
			]);

			const statsMap = new Map<string, JobStats>();

			const ensure = (task: string): JobStats => {
				let stats = statsMap.get(task);
				if (!stats) {
					stats = {task, pending: 0, running: 0, failed: 0};
					statsMap.set(task, stats);
				}
				return stats;
			};

			const tally = (jobs: Array<Job>, kind: 'pending' | 'running' | 'failed') => {
				for (const job of jobs) {
					if (!job?.name) continue;
					ensure(job.name)[kind]++;
				}
			};

			tally(waiting, 'pending');
			tally(delayed, 'pending');
			tally(active, 'running');
			tally(failed, 'failed');

			return Array.from(statsMap.values());
		} catch (err) {
			Logger.error({err}, 'Failed to collect BullMQ job stats');
			return [];
		}
	}

	private async collectRedisQueueSizes(): Promise<{
		assetDeletion: number;
		cloudflarePurge: number;
		bulkMessageDeletion: number;
		accountDeletion: number;
	}> {
		try {
			const [assetDeletion, cloudflarePurge, bulkMessageDeletion, accountDeletion] = await Promise.all([
				this.assetDeletionQueue.getQueueSize(),
				this.cloudflarePurgeQueue.getQueueSize(),
				this.bulkMessageDeletionQueue.getQueueSize(),
				this.accountDeletionQueue.getQueueSize(),
			]);

			return {assetDeletion, cloudflarePurge, bulkMessageDeletion, accountDeletion};
		} catch (err) {
			Logger.error({err}, 'Failed to collect Redis queue sizes');
			return {assetDeletion: 0, cloudflarePurge: 0, bulkMessageDeletion: 0, accountDeletion: 0};
		}
	}

	private reportJobStats(stats: Array<JobStats>): void {
		let totalPending = 0;
		let totalRunning = 0;
		let totalFailed = 0;

		for (const stat of stats) {
			totalPending += stat.pending;
			totalRunning += stat.running;
			totalFailed += stat.failed;

			this.metricsService.gauge({
				name: 'worker.queue.pending',
				dimensions: {task: stat.task},
				value: stat.pending,
			});
			this.metricsService.gauge({
				name: 'worker.queue.running',
				dimensions: {task: stat.task},
				value: stat.running,
			});
			this.metricsService.gauge({
				name: 'worker.queue.failed',
				dimensions: {task: stat.task},
				value: stat.failed,
			});
		}

		this.metricsService.gauge({
			name: 'worker.queue.total_pending',
			value: totalPending,
		});
		this.metricsService.gauge({
			name: 'worker.queue.total_running',
			value: totalRunning,
		});
		this.metricsService.gauge({
			name: 'worker.queue.total_failed',
			value: totalFailed,
		});
	}

	private reportRedisQueueSizes(sizes: {
		assetDeletion: number;
		cloudflarePurge: number;
		bulkMessageDeletion: number;
		accountDeletion: number;
	}): void {
		this.metricsService.gauge({
			name: 'worker.redis_queue.asset_deletion',
			value: sizes.assetDeletion,
		});
		this.metricsService.gauge({
			name: 'worker.redis_queue.cloudflare_purge',
			value: sizes.cloudflarePurge,
		});
		this.metricsService.gauge({
			name: 'worker.redis_queue.bulk_message_deletion',
			value: sizes.bulkMessageDeletion,
		});
		this.metricsService.gauge({
			name: 'worker.redis_queue.account_deletion',
			value: sizes.accountDeletion,
		});
	}

	private reportWorkerConcurrencyUtilization(jobStats: Array<JobStats>): void {
		let totalRunning = 0;
		for (const stat of jobStats) {
			totalRunning += stat.running;
		}

		const utilizationPercent = (totalRunning / this.workerConcurrency) * 100;
		this.metricsService.gauge({
			name: 'worker.concurrency.utilization_percent',
			value: Math.min(utilizationPercent, 100),
		});
		this.metricsService.gauge({
			name: 'worker.concurrency.available_slots',
			value: Math.max(this.workerConcurrency - totalRunning, 0),
		});
	}

	private async collectRedisConnectionStatus(): Promise<boolean> {
		try {
			const result = await this.redis.ping();
			return result === 'PONG';
		} catch (err) {
			Logger.error({err}, 'Redis ping failed');
			return false;
		}
	}

	private reportRedisHealthMetrics(isConnected: boolean): void {
		this.metricsService.gauge({
			name: 'redis.connection.status',
			value: isConnected ? 1 : 0,
		});

		if (this.redisCommandErrorCount > 0) {
			this.metricsService.counter({
				name: 'redis.command.error',
				value: this.redisCommandErrorCount,
			});
			this.redisCommandErrorCount = 0;
		}
	}
}
