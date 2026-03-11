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

import {createHmac} from 'crypto';

export function addMonthsClamp(date: Date, months: number): Date {
	const d = new Date(date);
	const day = d.getDate();
	d.setMonth(d.getMonth() + months);
	if (d.getDate() < day) {
		d.setDate(0);
	}
	return d;
}

export function verifyCloudPaymentsWebhook(body: string, signature: string, apiSecret: string): boolean {
	const expectedSignature = createHmac('sha256', apiSecret).update(body).digest('base64');
	return signature === expectedSignature;
}

export function rublesToKopecks(rubles: number): number {
	return Math.round(rubles * 100);
}
