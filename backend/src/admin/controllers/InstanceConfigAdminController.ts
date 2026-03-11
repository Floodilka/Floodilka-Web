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

import type {HonoApp} from '~/App';
import {AdminACLs} from '~/Constants';
import {InstanceConfigRepository} from '~/instance/InstanceConfigRepository';
import {requireAdminACL} from '~/middleware/AdminMiddleware';
import {RateLimitMiddleware} from '~/middleware/RateLimitMiddleware';
import {RateLimitConfigs} from '~/RateLimitConfig';
import {z} from '~/Schema';
import {Validator} from '~/Validator';

const instanceConfigRepository = new InstanceConfigRepository();

export const InstanceConfigAdminController = (app: HonoApp) => {
	app.post(
		'/admin/instance-config/get',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_LOOKUP),
		requireAdminACL(AdminACLs.INSTANCE_CONFIG_VIEW),
		async (ctx) => {
			const config = await instanceConfigRepository.getInstanceConfig();

			return ctx.json({
				registration_alerts_webhook_url: config.registrationAlertsWebhookUrl,
				system_alerts_webhook_url: config.systemAlertsWebhookUrl,
			});
		},
	);

	app.post(
		'/admin/instance-config/update',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_USER_MODIFY),
		requireAdminACL(AdminACLs.INSTANCE_CONFIG_UPDATE),
		Validator(
			'json',
			z.object({
				registration_alerts_webhook_url: z.string().url().nullable().optional(),
				system_alerts_webhook_url: z.string().url().nullable().optional(),
			}),
		),
		async (ctx) => {
			const data = ctx.req.valid('json');

			if (data.registration_alerts_webhook_url !== undefined) {
				await instanceConfigRepository.setRegistrationAlertsWebhookUrl(data.registration_alerts_webhook_url);
			}

			if (data.system_alerts_webhook_url !== undefined) {
				await instanceConfigRepository.setSystemAlertsWebhookUrl(data.system_alerts_webhook_url);
			}

			const updatedConfig = await instanceConfigRepository.getInstanceConfig();

			return ctx.json({
				registration_alerts_webhook_url: updatedConfig.registrationAlertsWebhookUrl,
				system_alerts_webhook_url: updatedConfig.systemAlertsWebhookUrl,
			});
		},
	);
};
