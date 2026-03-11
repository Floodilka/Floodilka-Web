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

import type {ChannelID, MessageID, UserID} from '~/BrandedTypes';
import type {
	GiftCodeRow,
	PaymentRow,
	PushSubscriptionRow,
	RecentMentionRow,
} from '~/database/CassandraTypes';
import type {GiftCode, Payment, PushSubscription, RecentMention, SavedMessage} from '~/Models';
import {GiftCodeRepository} from './GiftCodeRepository';
import type {IUserContentRepository} from './IUserContentRepository';
import {PaymentRepository} from './PaymentRepository';
import {PushSubscriptionRepository} from './PushSubscriptionRepository';
import {RecentMentionRepository} from './RecentMentionRepository';
import {SavedMessageRepository} from './SavedMessageRepository';

export class UserContentRepository implements IUserContentRepository {
	private giftCodeRepository: GiftCodeRepository;
	private paymentRepository: PaymentRepository;
	private pushSubscriptionRepository: PushSubscriptionRepository;
	private recentMentionRepository: RecentMentionRepository;
	private savedMessageRepository: SavedMessageRepository;

	constructor() {
		this.giftCodeRepository = new GiftCodeRepository();
		this.paymentRepository = new PaymentRepository();
		this.pushSubscriptionRepository = new PushSubscriptionRepository();
		this.recentMentionRepository = new RecentMentionRepository();
		this.savedMessageRepository = new SavedMessageRepository();
	}

	async createGiftCode(data: GiftCodeRow): Promise<void> {
		return this.giftCodeRepository.createGiftCode(data);
	}

	async findGiftCode(code: string): Promise<GiftCode | null> {
		return this.giftCodeRepository.findGiftCode(code);
	}

	async findGiftCodeByTransactionId(transactionId: number): Promise<GiftCode | null> {
		return this.giftCodeRepository.findGiftCodeByTransactionId(transactionId);
	}

	async findGiftCodesByCreator(userId: UserID): Promise<Array<GiftCode>> {
		return this.giftCodeRepository.findGiftCodesByCreator(userId);
	}

	async redeemGiftCode(code: string, userId: UserID): Promise<{applied: boolean}> {
		return this.giftCodeRepository.redeemGiftCode(code, userId);
	}

	async updateGiftCode(code: string, data: Partial<GiftCodeRow>): Promise<void> {
		return this.giftCodeRepository.updateGiftCode(code, data);
	}

	async createPayment(data: {
		payment_id: string;
		user_id: UserID;
		product_type: string;
		amount_cents: number;
		currency: string;
		status: string;
		is_gift: boolean;
		created_at: Date;
		cloudpayments_transaction_id?: number | null;
		cloudpayments_subscription_id?: string | null;
		gift_code?: string | null;
		completed_at?: Date | null;
	}): Promise<void> {
		return this.paymentRepository.createPayment(data);
	}

	async updatePayment(data: Partial<PaymentRow> & {payment_id: string}): Promise<{applied: boolean}> {
		return this.paymentRepository.updatePayment(data);
	}

	async getPaymentById(paymentId: string): Promise<Payment | null> {
		return this.paymentRepository.getPaymentById(paymentId);
	}

	async getPaymentByTransactionId(transactionId: number): Promise<Payment | null> {
		return this.paymentRepository.getPaymentByTransactionId(transactionId);
	}

	async listPushSubscriptions(userId: UserID): Promise<Array<PushSubscription>> {
		return this.pushSubscriptionRepository.listPushSubscriptions(userId);
	}

	async createPushSubscription(data: PushSubscriptionRow): Promise<PushSubscription> {
		return this.pushSubscriptionRepository.createPushSubscription(data);
	}

	async deletePushSubscription(userId: UserID, subscriptionId: string): Promise<void> {
		return this.pushSubscriptionRepository.deletePushSubscription(userId, subscriptionId);
	}

	async getBulkPushSubscriptions(userIds: Array<UserID>): Promise<Map<UserID, Array<PushSubscription>>> {
		return this.pushSubscriptionRepository.getBulkPushSubscriptions(userIds);
	}

	async deleteAllPushSubscriptions(userId: UserID): Promise<void> {
		return this.pushSubscriptionRepository.deleteAllPushSubscriptions(userId);
	}

	async getRecentMention(userId: UserID, messageId: MessageID): Promise<RecentMention | null> {
		return this.recentMentionRepository.getRecentMention(userId, messageId);
	}

	async listRecentMentions(
		userId: UserID,
		includeEveryone: boolean = true,
		includeRole: boolean = true,
		includeGuilds: boolean = true,
		limit: number = 25,
		before?: MessageID,
	): Promise<Array<RecentMention>> {
		return this.recentMentionRepository.listRecentMentions(
			userId,
			includeEveryone,
			includeRole,
			includeGuilds,
			limit,
			before,
		);
	}

	async createRecentMention(mention: RecentMentionRow): Promise<RecentMention> {
		return this.recentMentionRepository.createRecentMention(mention);
	}

	async createRecentMentions(mentions: Array<RecentMentionRow>): Promise<void> {
		return this.recentMentionRepository.createRecentMentions(mentions);
	}

	async deleteRecentMention(mention: RecentMention): Promise<void> {
		return this.recentMentionRepository.deleteRecentMention(mention);
	}

	async deleteAllRecentMentions(userId: UserID): Promise<void> {
		return this.recentMentionRepository.deleteAllRecentMentions(userId);
	}

	async listSavedMessages(userId: UserID, limit: number = 25, before?: MessageID): Promise<Array<SavedMessage>> {
		return this.savedMessageRepository.listSavedMessages(userId, limit, before);
	}

	async createSavedMessage(userId: UserID, channelId: ChannelID, messageId: MessageID): Promise<SavedMessage> {
		return this.savedMessageRepository.createSavedMessage(userId, channelId, messageId);
	}

	async deleteSavedMessage(userId: UserID, messageId: MessageID): Promise<void> {
		return this.savedMessageRepository.deleteSavedMessage(userId, messageId);
	}

	async deleteAllSavedMessages(userId: UserID): Promise<void> {
		return this.savedMessageRepository.deleteAllSavedMessages(userId);
	}

}
