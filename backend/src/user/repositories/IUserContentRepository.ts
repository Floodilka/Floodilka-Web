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

export interface IUserContentRepository {
	getRecentMention(userId: UserID, messageId: MessageID): Promise<RecentMention | null>;
	listRecentMentions(
		userId: UserID,
		includeEveryone: boolean,
		includeRole: boolean,
		includeGuilds: boolean,
		limit: number,
		before?: MessageID,
	): Promise<Array<RecentMention>>;
	createRecentMention(mention: RecentMentionRow): Promise<RecentMention>;
	createRecentMentions(mentions: Array<RecentMentionRow>): Promise<void>;
	deleteRecentMention(mention: RecentMention): Promise<void>;
	deleteAllRecentMentions(userId: UserID): Promise<void>;

	listSavedMessages(userId: UserID, limit?: number, before?: MessageID): Promise<Array<SavedMessage>>;
	createSavedMessage(userId: UserID, channelId: ChannelID, messageId: MessageID): Promise<SavedMessage>;
	deleteSavedMessage(userId: UserID, messageId: MessageID): Promise<void>;
	deleteAllSavedMessages(userId: UserID): Promise<void>;

	createGiftCode(data: GiftCodeRow): Promise<void>;
	findGiftCode(code: string): Promise<GiftCode | null>;
	findGiftCodeByTransactionId(transactionId: number): Promise<GiftCode | null>;
	findGiftCodesByCreator(userId: UserID): Promise<Array<GiftCode>>;
	redeemGiftCode(code: string, userId: UserID): Promise<{applied: boolean}>;
	updateGiftCode(code: string, data: Partial<GiftCodeRow>): Promise<void>;

	listPushSubscriptions(userId: UserID): Promise<Array<PushSubscription>>;
	createPushSubscription(data: PushSubscriptionRow): Promise<PushSubscription>;
	deletePushSubscription(userId: UserID, subscriptionId: string): Promise<void>;
	getBulkPushSubscriptions(userIds: Array<UserID>): Promise<Map<UserID, Array<PushSubscription>>>;
	deleteAllPushSubscriptions(userId: UserID): Promise<void>;

	createPayment(data: {
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
	}): Promise<void>;
	updatePayment(data: Partial<PaymentRow> & {payment_id: string}): Promise<{applied: boolean}>;
	getPaymentById(paymentId: string): Promise<Payment | null>;
	getPaymentByTransactionId(transactionId: number): Promise<Payment | null>;
}
