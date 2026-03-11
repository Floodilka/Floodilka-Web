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

import * as fs from 'node:fs';
import * as os from 'node:os';
import type {HonoApp} from '~/App';
import {createUserID} from '~/BrandedTypes';
import {AdminACLs} from '~/Constants';
import {Logger} from '~/Logger';
import {requireAdminACL} from '~/middleware/AdminMiddleware';
import {RateLimitMiddleware} from '~/middleware/RateLimitMiddleware';
import {RateLimitConfigs} from '~/RateLimitConfig';

export const SystemAdminController = (app: HonoApp) => {
	app.get(
		'/admin/system/stats',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_LOOKUP),
		requireAdminACL(AdminACLs.GATEWAY_MEMORY_STATS),
		async (ctx) => {
			const gatewayService = ctx.get('gatewayService');
			const userRepository = ctx.get('userRepository');

			const cpus = os.cpus();
			const loadAvg = os.loadavg();
			const totalMem = os.totalmem();
			const freeMem = os.freemem();
			const usedMem = totalMem - freeMem;

			const [diskStats, gatewayStats, onlineUserIds] = await Promise.all([
				fs.promises.statfs('/').catch(() => null),
				gatewayService.getNodeStats().catch((err: unknown) => {
					Logger.warn({err}, '[admin] failed to get gateway stats');
					return null;
				}),
				gatewayService.getAllOnlineUserIds().catch((err: unknown) => {
					Logger.warn({err}, '[admin] failed to get online user ids');
					return [] as Array<string>;
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
					const userIdsBigInt = onlineUserIds.map((id) => createUserID(BigInt(id)));
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

			const disk = diskStats
				? {
						root: {
							total: Number(diskStats.bsize) * Number(diskStats.blocks),
							used:
								Number(diskStats.bsize) * Number(diskStats.blocks) -
								Number(diskStats.bsize) * Number(diskStats.bfree),
							available: Number(diskStats.bsize) * Number(diskStats.bavail),
							usagePercentage:
								diskStats.blocks > 0
									? Math.round(
											((Number(diskStats.blocks) - Number(diskStats.bfree)) / Number(diskStats.blocks)) * 100,
										)
									: 0,
						},
					}
				: null;

			const cpuUsage = calculateCpuUsage(cpus);

			return ctx.json({
				cpu: {
					count: cpus.length,
					usage: cpuUsage,
					loadAvg,
					model: cpus[0]?.model ?? 'Unknown',
				},
				memory: {
					total: totalMem,
					free: freeMem,
					used: usedMem,
					usagePercentage: Math.round((usedMem / totalMem) * 100),
				},
				disk,
				uptime: Math.floor(os.uptime()),
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
					list: onlineUsers,
				},
			});
		},
	);
};

function calculateCpuUsage(cpus: Array<os.CpuInfo>): number {
	let totalIdle = 0;
	let totalTick = 0;

	for (const cpu of cpus) {
		totalIdle += cpu.times.idle;
		totalTick += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle + cpu.times.irq;
	}

	return Math.round(((totalTick - totalIdle) / totalTick) * 100 * 10) / 10;
}
