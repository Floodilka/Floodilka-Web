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

import {Logger} from '~/Logger';
import {PaymentError} from '~/Errors';

const BASE_URL = 'https://api.cloudpayments.ru';

export interface CloudPaymentsChargeParams {
	Amount: number;
	Currency: string;
	IpAddress: string;
	CardCryptogramPacket: string;
	Name?: string;
	AccountId: string;
	Description: string;
	JsonData?: Record<string, unknown>;
	InvoiceId?: string;
}

export interface CloudPaymentsChargeResponse {
	Success: boolean;
	Message?: string;
	Model?: {
		TransactionId: number;
		Amount: number;
		Currency: string;
		CardFirstSix: string;
		CardLastFour: string;
		CardType: string;
		Status: string;
		StatusCode: number;
		Token?: string;
		AccountId?: string;
		SubscriptionId?: string;
	};
}

export interface CloudPaymentsSubscriptionCreateParams {
	Token: string;
	AccountId: string;
	Description: string;
	Amount: number;
	Currency: string;
	RequireConfirmation: boolean;
	Interval: 'Day' | 'Week' | 'Month';
	Period: number;
	StartDate?: string;
}

export interface CloudPaymentsSubscriptionResponse {
	Success: boolean;
	Message?: string;
	Model?: {
		Id: string;
		AccountId: string;
		Description: string;
		Amount: number;
		Currency: string;
		Status: string;
		StatusCode: number;
		Interval: string;
		Period: number;
		StartDate: string;
		NextTransactionDate: string;
		LastTransactionDate?: string;
	};
}

export interface CloudPaymentsSubscriptionGetResponse {
	Success: boolean;
	Message?: string;
	Model?: {
		Id: string;
		AccountId: string;
		Status: string;
		StatusCode: number;
		Amount: number;
		Currency: string;
		Interval: string;
		Period: number;
		StartDate: string;
		NextTransactionDate: string;
	};
}

export interface CloudPaymentsSubscriptionFindResponse {
	Success: boolean;
	Message?: string;
	Model?: Array<{
		Id: string;
		AccountId: string;
		Status: string;
		StatusCode: number;
		Amount: number;
		Currency: string;
	}>;
}

export interface CloudPaymentsRefundParams {
	TransactionId: number;
	Amount: number;
}

export interface CloudPaymentsRefundResponse {
	Success: boolean;
	Message?: string;
}

export interface CloudPaymentsGetPaymentResponse {
	Success: boolean;
	Message?: string;
	Model?: {
		TransactionId: number;
		Amount: number;
		Currency: string;
		Status: string;
		StatusCode: number;
		AccountId?: string;
		Token?: string;
	};
}

export class CloudPaymentsClient {
	private authHeader: string;

	constructor(publicId: string, apiSecret: string) {
		this.authHeader = `Basic ${Buffer.from(`${publicId}:${apiSecret}`).toString('base64')}`;
	}

	async charge(params: CloudPaymentsChargeParams): Promise<CloudPaymentsChargeResponse> {
		return this.request<CloudPaymentsChargeResponse>('/payments/cards/charge', params);
	}

	async auth(params: CloudPaymentsChargeParams): Promise<CloudPaymentsChargeResponse> {
		return this.request<CloudPaymentsChargeResponse>('/payments/cards/auth', params);
	}

	async getPayment(transactionId: number): Promise<CloudPaymentsGetPaymentResponse> {
		return this.request<CloudPaymentsGetPaymentResponse>('/payments/get', {TransactionId: transactionId});
	}

	async refund(transactionId: number, amount: number): Promise<CloudPaymentsRefundResponse> {
		return this.request<CloudPaymentsRefundResponse>('/payments/refund', {TransactionId: transactionId, Amount: amount});
	}

	async createSubscription(params: CloudPaymentsSubscriptionCreateParams): Promise<CloudPaymentsSubscriptionResponse> {
		return this.request<CloudPaymentsSubscriptionResponse>('/subscriptions/create', params);
	}

	async getSubscription(id: string): Promise<CloudPaymentsSubscriptionGetResponse> {
		return this.request<CloudPaymentsSubscriptionGetResponse>('/subscriptions/get', {Id: id});
	}

	async cancelSubscription(id: string): Promise<CloudPaymentsRefundResponse> {
		return this.request<CloudPaymentsRefundResponse>('/subscriptions/cancel', {Id: id});
	}

	async updateSubscription(
		id: string,
		params: Partial<CloudPaymentsSubscriptionCreateParams>,
	): Promise<CloudPaymentsSubscriptionResponse> {
		return this.request<CloudPaymentsSubscriptionResponse>('/subscriptions/update', {Id: id, ...params});
	}

	async findSubscriptions(accountId: string): Promise<CloudPaymentsSubscriptionFindResponse> {
		return this.request<CloudPaymentsSubscriptionFindResponse>('/subscriptions/find', {accountId});
	}

	private async request<T>(path: string, body: object): Promise<T> {
		const requestId = crypto.randomUUID();
		const url = `${BASE_URL}${path}`;

		try {
			const response = await fetch(url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: this.authHeader,
					'X-Request-ID': requestId,
				},
				body: JSON.stringify(body),
				signal: AbortSignal.timeout(15000),
			});

			if (!response.ok) {
				Logger.error({path, status: response.status, requestId}, 'CloudPayments HTTP error');
				throw new PaymentError(`CloudPayments request failed: HTTP ${response.status}`);
			}

			return (await response.json()) as T;
		} catch (error: unknown) {
			if (error instanceof PaymentError) throw error;
			Logger.error({error, path, requestId}, 'CloudPayments request failed');
			throw new PaymentError('Платёжный сервис недоступен');
		}
	}
}
