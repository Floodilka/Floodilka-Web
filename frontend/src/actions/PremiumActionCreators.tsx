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

import {Endpoints} from '~/Endpoints';
import http from '~/lib/HttpClient';
import {Logger} from '~/lib/Logger';

const logger = new Logger('Premium');

export interface Prices {
	monthly: number;
	yearly: number;
	gift1Month: number;
	gift1Year: number;
	currency: 'RUB';
	publicId: string;
}

export const fetchPrices = async (): Promise<Prices> => {
	try {
		const response = await http.get<Prices>(Endpoints.PREMIUM_PRICES);
		logger.debug('Prices fetched', response.body);
		return response.body;
	} catch (error) {
		logger.error('Prices fetch failed', error);
		throw error;
	}
};

export const cancelSubscriptionAtPeriodEnd = async (): Promise<void> => {
	try {
		await http.post({url: Endpoints.PREMIUM_CANCEL_SUBSCRIPTION});
		logger.info('Subscription set to cancel at period end');
	} catch (error) {
		logger.error('Failed to cancel subscription at period end', error);
		throw error;
	}
};

export const reactivateSubscription = async (): Promise<void> => {
	try {
		await http.post({url: Endpoints.PREMIUM_REACTIVATE_SUBSCRIPTION});
		logger.info('Subscription reactivated');
	} catch (error) {
		logger.error('Failed to reactivate subscription', error);
		throw error;
	}
};

export const rejoinOperatorGuild = async (): Promise<void> => {
	try {
		await http.post({url: Endpoints.PREMIUM_OPERATOR_REJOIN});
		logger.info('Operator guild rejoin requested');
	} catch (error) {
		logger.error('Failed to rejoin Operator guild', error);
		throw error;
	}
};
