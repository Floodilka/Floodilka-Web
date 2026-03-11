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

import {Logger} from '~/lib/Logger';

const logger = new Logger('CloudPayments');

const WIDGET_SCRIPT_URL = 'https://widget.cloudpayments.ru/bundles/cloudpayments.js';

let scriptLoadPromise: Promise<void> | null = null;

interface CloudPaymentsWidgetOptions {
	publicId: string;
	description: string;
	amount: number;
	currency: string;
	accountId: string;
	skin?: 'mini' | 'classic';
	requireConfirmation?: boolean;
	data?: Record<string, unknown>;
}

interface CloudPaymentsWidget {
	pay(
		method: 'charge' | 'auth',
		options: CloudPaymentsWidgetOptions,
		callbacks: {
			onSuccess?: (options: Record<string, unknown>) => void;
			onFail?: (reason: string, options: Record<string, unknown>) => void;
			onComplete?: (paymentResult: Record<string, unknown>, options: Record<string, unknown>) => void;
		},
	): void;
}

declare global {
	interface Window {
		cp?: {
			CloudPayments: new () => CloudPaymentsWidget;
		};
	}
}

function loadWidgetScript(): Promise<void> {
	if (scriptLoadPromise) return scriptLoadPromise;

	scriptLoadPromise = new Promise<void>((resolve, reject) => {
		if (window.cp) {
			resolve();
			return;
		}

		const script = document.createElement('script');
		script.src = WIDGET_SCRIPT_URL;
		script.async = true;
		script.onload = () => {
			logger.info('CloudPayments widget script loaded');
			resolve();
		};
		script.onerror = () => {
			scriptLoadPromise = null;
			reject(new Error('Failed to load CloudPayments widget script'));
		};
		document.head.appendChild(script);
	});

	return scriptLoadPromise;
}

export interface CheckoutParams {
	publicId: string;
	description: string;
	amountRubles: number;
	accountId: string;
	billingCycle?: 'monthly' | 'yearly';
	metadata?: Record<string, unknown>;
}

export interface CheckoutResult {
	success: boolean;
	paymentResult?: Record<string, unknown>;
	failReason?: string;
}

export async function openCheckoutWidget(params: CheckoutParams): Promise<CheckoutResult> {
	await loadWidgetScript();

	if (!window.cp) {
		throw new Error('CloudPayments widget not available');
	}

	const widget = new window.cp.CloudPayments();

	const options: CloudPaymentsWidgetOptions = {
		publicId: params.publicId,
		description: params.description,
		amount: params.amountRubles,
		currency: 'RUB',
		accountId: params.accountId,
		skin: 'mini',
		data: {
			...params.metadata,
			...(params.billingCycle ? {billing_cycle: params.billingCycle} : {}),
		},
	};

	return new Promise<CheckoutResult>((resolve) => {
		widget.pay('charge', options, {
			onSuccess: (result) => {
				logger.info('Payment successful');
				resolve({success: true, paymentResult: result});
			},
			onFail: (reason, result) => {
				logger.warn('Payment failed', {reason});
				resolve({success: false, failReason: reason, paymentResult: result});
			},
			onComplete: (paymentResult, _options) => {
				logger.info('Payment complete', {paymentResult});
			},
		});
	});
}

export async function openGiftCheckoutWidget(params: Omit<CheckoutParams, 'billingCycle'>): Promise<CheckoutResult> {
	await loadWidgetScript();

	if (!window.cp) {
		throw new Error('CloudPayments widget not available');
	}

	const widget = new window.cp.CloudPayments();

	const options: CloudPaymentsWidgetOptions = {
		publicId: params.publicId,
		description: params.description,
		amount: params.amountRubles,
		currency: 'RUB',
		accountId: params.accountId,
		skin: 'mini',
		data: params.metadata,
	};

	return new Promise<CheckoutResult>((resolve) => {
		widget.pay('charge', options, {
			onSuccess: (result) => {
				logger.info('Gift payment successful');
				resolve({success: true, paymentResult: result});
			},
			onFail: (reason, result) => {
				logger.warn('Gift payment failed', {reason});
				resolve({success: false, failReason: reason, paymentResult: result});
			},
		});
	});
}
