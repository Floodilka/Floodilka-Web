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

import fs from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {Config} from '~/Config';
import {Logger as logger} from '~/Logger';

const require = createRequire(import.meta.url);

let firebaseAdmin: typeof import('firebase-admin') | null = null;
let apn: typeof import('@parse/node-apn') | null = null;

try {
	firebaseAdmin = require('firebase-admin');
} catch {
	// firebase-admin not installed
}

try {
	apn = require('@parse/node-apn');
} catch {
	// @parse/node-apn not installed
}

export interface MobilePushNotification {
	userId: string;
	tokenId: string;
	token: string;
	platform: 'ios' | 'android';
	type: string;
	title: string;
	body: string;
	badgeCount: number;
	data: Record<string, string>;
}

export interface FailedToken {
	userId: string;
	tokenId: string;
}

export interface MobilePushResult {
	sent: number;
	failedTokens: Array<FailedToken>;
}

class MobilePushServiceImpl {
	private fcmInitialized = false;
	private apnProvider: InstanceType<typeof import('@parse/node-apn').Provider> | null = null;
	private apnsBundleId: string = 'com.floodilka.floodilka';

	initialize(): void {
		const config = Config.mobilePush;

		if (config.fcmEnabled && firebaseAdmin) {
			this.initializeFcm(config.fcmServiceAccountPath);
		} else if (config.fcmEnabled) {
			logger.warn('[MobilePush] FCM enabled but firebase-admin not installed');
		}

		if (config.apnsEnabled && apn) {
			this.initializeApns(config);
		} else if (config.apnsEnabled) {
			logger.warn('[MobilePush] APNs enabled but @parse/node-apn not installed');
		}
	}

	private initializeFcm(serviceAccountPath?: string): void {
		if (!firebaseAdmin) return;

		try {
			const resolvedPath = serviceAccountPath
				? path.isAbsolute(serviceAccountPath)
					? serviceAccountPath
					: path.resolve(serviceAccountPath)
				: null;

			if (!resolvedPath || !fs.existsSync(resolvedPath)) {
				logger.warn('[MobilePush] FCM service account file not found: %s', resolvedPath);
				return;
			}

			if (firebaseAdmin.apps.length === 0) {
				const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
				firebaseAdmin.initializeApp({
					credential: firebaseAdmin.credential.cert(serviceAccount),
				});
			}

			this.fcmInitialized = true;
			logger.info('[MobilePush] FCM initialized');
		} catch (error) {
			logger.error('[MobilePush] FCM initialization failed: %s', error);
		}
	}

	private initializeApns(config: typeof Config.mobilePush): void {
		if (!apn) return;

		try {
			const keyPath = config.apnsKeyPath
				? path.isAbsolute(config.apnsKeyPath)
					? config.apnsKeyPath
					: path.resolve(config.apnsKeyPath)
				: null;

			if (!keyPath || !fs.existsSync(keyPath)) {
				logger.warn('[MobilePush] APNs key file not found: %s', keyPath);
				return;
			}

			if (!config.apnsKeyId || !config.apnsTeamId) {
				logger.warn('[MobilePush] APNs key ID or team ID not configured');
				return;
			}

			const keyContent = fs.readFileSync(keyPath, 'utf8');

			this.apnProvider = new apn.Provider({
				token: {
					key: keyContent,
					keyId: config.apnsKeyId,
					teamId: config.apnsTeamId,
				},
				production: config.apnsProduction,
			});

			this.apnsBundleId = config.apnsBundleId;
			logger.info('[MobilePush] APNs initialized (production: %s)', config.apnsProduction);
		} catch (error) {
			logger.error('[MobilePush] APNs initialization failed: %s', error);
		}
	}

	get isConfigured(): {fcm: boolean; apns: boolean} {
		return {
			fcm: this.fcmInitialized,
			apns: this.apnProvider !== null,
		};
	}

	async sendBatch(notifications: Array<MobilePushNotification>): Promise<MobilePushResult> {
		const failedTokens: Array<FailedToken> = [];
		let sent = 0;

		const iosNotifications = notifications.filter((n) => n.platform === 'ios');
		const androidNotifications = notifications.filter((n) => n.platform === 'android');

		const [iosResults, androidResults] = await Promise.all([
			this.sendApnsBatch(iosNotifications),
			this.sendFcmBatch(androidNotifications),
		]);

		sent += iosResults.sent + androidResults.sent;
		failedTokens.push(...iosResults.failedTokens, ...androidResults.failedTokens);

		return {sent, failedTokens};
	}

	private async sendFcmBatch(notifications: Array<MobilePushNotification>): Promise<MobilePushResult> {
		if (!this.fcmInitialized || !firebaseAdmin || notifications.length === 0) {
			return {sent: 0, failedTokens: []};
		}

		const failedTokens: Array<FailedToken> = [];
		let sent = 0;

		await Promise.allSettled(
			notifications.map(async (notification) => {
				try {
					const channelId = this.getFcmChannelId(notification.type);

					await firebaseAdmin!.messaging().send({
						token: notification.token,
						notification: {
							title: notification.title,
							body: notification.body,
						},
						data: notification.data,
						android: {
							priority: 'high' as const,
							notification: {
								channelId,
								sound: 'default',
							},
						},
					});

					sent++;
				} catch (error: any) {
					if (
						error?.code === 'messaging/invalid-registration-token' ||
						error?.code === 'messaging/registration-token-not-registered'
					) {
						failedTokens.push({userId: notification.userId, tokenId: notification.tokenId});
					}
					logger.debug('[MobilePush] FCM send failed for user %s: %s', notification.userId, error?.message);
				}
			}),
		);

		if (sent > 0) {
			logger.info('[MobilePush] FCM: sent %d/%d notifications', sent, notifications.length);
		}

		return {sent, failedTokens};
	}

	private async sendApnsBatch(notifications: Array<MobilePushNotification>): Promise<MobilePushResult> {
		if (!this.apnProvider || !apn || notifications.length === 0) {
			return {sent: 0, failedTokens: []};
		}

		const failedTokens: Array<FailedToken> = [];
		let sent = 0;

		await Promise.allSettled(
			notifications.map(async (notification) => {
				try {
					const apnNotification = new apn!.Notification({
						topic: this.apnsBundleId,
						alert: {
							title: notification.title,
							body: notification.body,
						},
						sound: 'default',
						badge: notification.badgeCount,
						mutableContent: true,
						pushType: 'alert',
						priority: 10,
						expiration: Math.floor(Date.now() / 1000) + 86400,
						payload: notification.data,
					});

					const tokenHex = notification.token.replace(/\s+/g, '').trim();
					const result = await this.apnProvider!.send(apnNotification, tokenHex);

					if (result.sent && result.sent.length > 0) {
						sent++;
					} else if (result.failed && result.failed.length > 0) {
						const reason = result.failed[0]?.response?.reason;
						if (reason === 'BadDeviceToken' || reason === 'Unregistered') {
							failedTokens.push({userId: notification.userId, tokenId: notification.tokenId});
						}
						logger.debug('[MobilePush] APNs send failed for user %s: %s', notification.userId, reason);
					}
				} catch (error: any) {
					logger.debug('[MobilePush] APNs send error for user %s: %s', notification.userId, error?.message);
				}
			}),
		);

		if (sent > 0) {
			logger.info('[MobilePush] APNs: sent %d/%d notifications', sent, notifications.length);
		}

		return {sent, failedTokens};
	}

	private getFcmChannelId(type: string): string {
		switch (type) {
			case 'mention':
				return 'mentions';
			case 'friend_request':
				return 'friends';
			default:
				return 'messages';
		}
	}

	async shutdown(): Promise<void> {
		if (this.apnProvider) {
			this.apnProvider.shutdown();
			this.apnProvider = null;
		}
	}
}

export const MobilePushService = new MobilePushServiceImpl();
