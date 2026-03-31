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

import {useLingui} from '@lingui/react/macro';
import React from 'react';
import type {Prices} from '~/actions/PremiumActionCreators';
import * as PremiumActionCreators from '~/actions/PremiumActionCreators';
import * as ToastActionCreators from '~/actions/ToastActionCreators';
import {Logger} from '~/lib/Logger';

const logger = new Logger('usePremiumData');

export interface PremiumData {
	priceIds: Prices | null;
	loadingPrices: boolean;
	pricesError: boolean;
}

export const usePremiumData = (_countryCode: string | null): PremiumData => {
	const {t} = useLingui();
	const [priceIds, setPriceIds] = React.useState<Prices | null>(null);
	const [loadingPrices, setLoadingPrices] = React.useState(true);
	const [pricesError, setPricesError] = React.useState(false);

	React.useEffect(() => {
		let mounted = true;
		const fetchData = async () => {
			try {
				const prices = await PremiumActionCreators.fetchPrices();
				if (!mounted) return;
				setPriceIds(prices);
				setLoadingPrices(false);
			} catch (error) {
				logger.error('Failed to fetch premium data', error);
				if (!mounted) return;
				ToastActionCreators.error(t`Failed to load premium information. Please try again later.`);
				setPricesError(true);
				setLoadingPrices(false);
			}
		};
		fetchData();
		return () => {
			mounted = false;
		};
	}, []);

	return {
		priceIds,
		loadingPrices,
		pricesError,
	};
};
