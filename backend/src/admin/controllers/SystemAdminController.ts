/*
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright (C) 2020-2026 Fluxer Contributors
 * Copyright (C) 2026 Floodilka Contributors
 * Modified by Floodilka Contributors starting March 2026. See LICENSE and NOTICE.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import {PrometheusQueryService} from '~/admin/services/PrometheusQueryService';
import type {HonoApp} from '~/App';
import {createUserID, type UserID} from '~/BrandedTypes';
import {Config} from '~/Config';
import {AdminACLs} from '~/Constants';
import type {ICacheService} from '~/infrastructure/ICacheService';
import {Logger} from '~/Logger';
import {requireAdminACL} from '~/middleware/AdminMiddleware';
import {RateLimitMiddleware} from '~/middleware/RateLimitMiddleware';
import {RateLimitConfigs} from '~/RateLimitConfig';
import type {IUserRepository} from '~/user/IUserRepository';

const prometheus = new PrometheusQueryService(Config.prometheus.url);
const USER_TOTAL_COUNT_CACHE_KEY = 'admin:system:stats:user_total_count';
const USER_TOTAL_COUNT_CACHE_TTL_SECONDS = 300;
const USER_TOTAL_COUNT_BATCH_SIZE = 1000;

export const SystemAdminController = (app: HonoApp) => {
	app.get(
		'/admin/system/stats',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_LOOKUP),
		requireAdminACL(AdminACLs.GATEWAY_MEMORY_STATS),
		async (ctx) => {
			const gatewayService = ctx.get('gatewayService');
			const userRepository = ctx.get('userRepository');
			const cacheService = ctx.get('cacheService');

			const [clusterStats, gatewayStats, onlineUserIds, totalUserCount] = await Promise.all([
				prometheus.getClusterStatsSafe(),
				gatewayService.getNodeStats().catch((err: unknown) => {
					Logger.warn({err}, '[admin] failed to get gateway stats');
					return null;
				}),
				gatewayService.getAllOnlineUserIds().catch((err: unknown) => {
					Logger.warn({err}, '[admin] failed to get online user ids');
					return [] as Array<string>;
				}),
				getCachedTotalUserCount(userRepository, cacheService).catch((err: unknown) => {
					Logger.warn({err}, '[admin] failed to get total user count');
					return 0;
				}),
			]);

			let onlineUsers: Array<{
				id: string;
				username: string;
				displayName: string | null;
				avatar: string | null;
				createdAt: string | null;
			}> = [];

			if (onlineUserIds.length > 0) {
				try {
					const userIdsBigInt = parseOnlineUserIds(onlineUserIds);
					const users = await userRepository.listUsers(userIdsBigInt);
					onlineUsers = users.map((u) => ({
						id: u.id.toString(),
						username: u.username,
						displayName: u.globalName,
						avatar: u.avatarHash,
						createdAt: null,
					}));
				} catch (err) {
					Logger.warn({err}, '[admin] failed to fetch online user details');
				}
			}

			const cpu = clusterStats
				? {
						count: Math.round(clusterStats.cpu.cores),
						usage: Math.round(clusterStats.cpu.usagePercent * 10) / 10,
						loadAvg: [clusterStats.cpu.loadAvg1, clusterStats.cpu.loadAvg5, clusterStats.cpu.loadAvg15],
						model: 'cluster aggregate',
					}
				: localCpu();

			const memory = clusterStats
				? {
						total: clusterStats.memory.totalBytes,
						free: clusterStats.memory.freeBytes,
						used: clusterStats.memory.usedBytes,
						usagePercentage: clusterStats.memory.usagePercent,
					}
				: localMemory();

			const disk = clusterStats
				? {
						root: {
							total: clusterStats.disk.totalBytes,
							used: clusterStats.disk.usedBytes,
							available: clusterStats.disk.availableBytes,
							usagePercentage: clusterStats.disk.usagePercent,
						},
					}
				: localDisk();

			const uptime = clusterStats ? clusterStats.uptime : Math.floor(os.uptime());

			return ctx.json({
				cpu,
				memory,
				disk,
				uptime,
				connections: gatewayStats?.sessions ?? 0,
				presences: gatewayStats?.presences ?? 0,
				guilds: gatewayStats?.guilds ?? 0,
				calls: gatewayStats?.calls ?? 0,
				os: {
					platform: os.platform(),
					release: os.release(),
					type: os.type(),
					arch: os.arch(),
				},
				nodeVersion: process.version,
				timestamp: new Date().toISOString(),
				users: {
					online: onlineUsers.length,
					total: totalUserCount,
					list: onlineUsers,
				},
				source: clusterStats ? 'prometheus' : 'local',
			});
		},
	);

	app.get(
		'/admin/system/nodes',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_LOOKUP),
		requireAdminACL(AdminACLs.GATEWAY_MEMORY_STATS),
		async (ctx) => {
			if (!prometheus.isConfigured) {
				return ctx.json({nodes: [], source: 'unavailable'}, 200);
			}
			try {
				const rows = await prometheus.getPerNodeRows();
				return ctx.json({nodes: rows, source: 'prometheus'});
			} catch (err) {
				Logger.warn({err}, '[admin] failed to fetch per-node stats from Prometheus');
				return ctx.json({nodes: [], source: 'error'}, 200);
			}
		},
	);
};

async function getCachedTotalUserCount(userRepository: IUserRepository, cacheService: ICacheService): Promise<number> {
	const cached = await cacheService.get<number>(USER_TOTAL_COUNT_CACHE_KEY);
	if (typeof cached === 'number') return cached;

	const total = await countAllUsers(userRepository);
	await cacheService.set(USER_TOTAL_COUNT_CACHE_KEY, total, USER_TOTAL_COUNT_CACHE_TTL_SECONDS);
	return total;
}

async function countAllUsers(userRepository: IUserRepository): Promise<number> {
	let total = 0;
	let lastUserId: UserID | undefined;
	let hasMore = true;

	while (hasMore) {
		const users = await userRepository.listAllUsersPaginated(USER_TOTAL_COUNT_BATCH_SIZE, lastUserId);
		total += users.length;

		if (users.length === 0) {
			hasMore = false;
			continue;
		}

		lastUserId = users[users.length - 1].id;
		hasMore = users.length === USER_TOTAL_COUNT_BATCH_SIZE;
	}

	return total;
}

function parseOnlineUserIds(userIds: Array<string>): Array<UserID> {
	const uniqueUserIds = new Set(userIds);
	const parsedUserIds: Array<UserID> = [];

	for (const userId of uniqueUserIds) {
		try {
			parsedUserIds.push(createUserID(BigInt(userId)));
		} catch (err) {
			Logger.warn({err, userId}, '[admin] gateway returned invalid online user id');
		}
	}

	return parsedUserIds;
}

function localCpu() {
	const cpus = os.cpus();
	let totalIdle = 0;
	let totalTick = 0;
	for (const c of cpus) {
		totalIdle += c.times.idle;
		totalTick += c.times.user + c.times.nice + c.times.sys + c.times.idle + c.times.irq;
	}
	const usage = totalTick > 0 ? Math.round(((totalTick - totalIdle) / totalTick) * 100 * 10) / 10 : 0;
	return {
		count: cpus.length,
		usage,
		loadAvg: os.loadavg(),
		model: cpus[0]?.model ?? 'Unknown',
	};
}

function localMemory() {
	const total = os.totalmem();
	const free = os.freemem();
	const used = total - free;
	return {
		total,
		free,
		used,
		usagePercentage: total > 0 ? Math.round((used / total) * 100) : 0,
	};
}

function localDisk() {
	try {
		const stat = fs.statfsSync('/');
		const total = Number(stat.bsize) * Number(stat.blocks);
		const used = total - Number(stat.bsize) * Number(stat.bfree);
		const available = Number(stat.bsize) * Number(stat.bavail);
		return {
			root: {
				total,
				used,
				available,
				usagePercentage: total > 0 ? Math.round((used / total) * 100) : 0,
			},
		};
	} catch {
		return null;
	}
}
