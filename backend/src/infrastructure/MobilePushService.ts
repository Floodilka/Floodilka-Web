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

import crypto from 'node:crypto';
import fs from 'node:fs';
import http2 from 'node:http2';
import {createRequire} from 'node:module';
import path from 'node:path';
import {Config} from '~/Config';
import {Logger as logger} from '~/Logger';

const require = createRequire(import.meta.url);

let firebaseAdmin: typeof import('firebase-admin') | null = null;

try {
	firebaseAdmin = require('firebase-admin');
} catch {
	// firebase-admin not installed
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
	private apnsInitialized = false;
	private apnsBundleId: string = 'com.floodilka.floodilka';
	private apnsProduction = false;
	private apnsKeyContent: string | null = null;
	private apnsKeyId: string | null = null;
	private apnsTeamId: string | null = null;
	private apnsJwt: string | null = null;
	private apnsJwtGeneratedAt = 0;

	initialize(): void {
		const config = Config.mobilePush;

		if (config.fcmEnabled && firebaseAdmin) {
			this.initializeFcm(config.fcmServiceAccountPath);
		} else if (config.fcmEnabled) {
			logger.warn('[MobilePush] FCM enabled but firebase-admin not installed');
		}

		if (config.apnsEnabled) {
			this.initializeApns(config);
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

			this.apnsKeyContent = fs.readFileSync(keyPath, 'utf8');
			this.apnsKeyId = config.apnsKeyId;
			this.apnsTeamId = config.apnsTeamId;
			this.apnsProduction = config.apnsProduction;
			this.apnsBundleId = config.apnsBundleId;
			this.apnsInitialized = true;
			logger.info('[MobilePush] APNs initialized (production: %s)', config.apnsProduction);
		} catch (error) {
			logger.error('[MobilePush] APNs initialization failed: %s', error);
		}
	}

	private getApnsJwt(): string {
		const now = Math.floor(Date.now() / 1000);
		// Refresh JWT every 50 minutes (Apple requires refresh within 60 min)
		if (this.apnsJwt && now - this.apnsJwtGeneratedAt < 3000) {
			return this.apnsJwt;
		}

		const header = Buffer.from(JSON.stringify({alg: 'ES256', kid: this.apnsKeyId})).toString('base64url');
		const payload = Buffer.from(JSON.stringify({iss: this.apnsTeamId, iat: now})).toString('base64url');
		const signature = crypto
			.sign('sha256', Buffer.from(`${header}.${payload}`), {
				key: this.apnsKeyContent!,
				dsaEncoding: 'ieee-p1363',
			})
			.toString('base64url');

		this.apnsJwt = `${header}.${payload}.${signature}`;
		this.apnsJwtGeneratedAt = now;
		return this.apnsJwt;
	}

	get isConfigured(): {fcm: boolean; apns: boolean} {
		return {
			fcm: this.fcmInitialized,
			apns: this.apnsInitialized,
		};
	}

	async sendBatch(notifications: Array<MobilePushNotification>): Promise<MobilePushResult> {
		logger.info('[MobilePush] sendBatch called with %d notifications', notifications.length);
		const failedTokens: Array<FailedToken> = [];
		let sent = 0;

		const iosNotifications = notifications.filter((n) => n.platform === 'ios');
		const androidNotifications = notifications.filter((n) => n.platform === 'android');
		logger.info('[MobilePush] iOS: %d, Android: %d', iosNotifications.length, androidNotifications.length);

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
		if (!this.apnsInitialized || notifications.length === 0) {
			return {sent: 0, failedTokens: []};
		}

		const failedTokens: Array<FailedToken> = [];
		let sent = 0;

		const host = this.apnsProduction ? 'api.push.apple.com' : 'api.sandbox.push.apple.com';

		let client: http2.ClientHttp2Session;
		try {
			client = await this.connectHttp2(host);
		} catch (error: any) {
			logger.error('[MobilePush] APNs connection failed: %s', error?.message);
			return {sent: 0, failedTokens: []};
		}

		try {
			const jwt = this.getApnsJwt();

			await Promise.allSettled(
				notifications.map(async (notification) => {
					try {
						const tokenHex = notification.token.replace(/\s+/g, '').trim();
						const body = JSON.stringify({
							aps: {
								alert: {
									title: notification.title,
									body: notification.body,
								},
								sound: 'default',
								badge: notification.badgeCount,
								'mutable-content': 1,
							},
							...notification.data,
						});

						const result = await this.sendApnsRequest(client, jwt, tokenHex, body);

						if (result.status === 200) {
							sent++;
						} else {
							const reason = result.reason;
							if (reason === 'BadDeviceToken' || reason === 'Unregistered') {
								failedTokens.push({userId: notification.userId, tokenId: notification.tokenId});
							}
							logger.info(
								'[MobilePush] APNs send failed for user %s: %d %s',
								notification.userId,
								result.status,
								reason,
							);
						}
					} catch (error: any) {
						logger.info(
							'[MobilePush] APNs send error for user %s: %s',
							notification.userId,
							error?.message,
						);
					}
				}),
			);
		} finally {
			client.close();
		}

		if (sent > 0) {
			logger.info('[MobilePush] APNs: sent %d/%d notifications', sent, notifications.length);
		}

		return {sent, failedTokens};
	}

	private connectHttp2(host: string): Promise<http2.ClientHttp2Session> {
		return new Promise((resolve, reject) => {
			const client = http2.connect(`https://${host}`, {settings: {enablePush: false}});
			const timeout = setTimeout(() => {
				client.destroy();
				reject(new Error('HTTP/2 connection timeout'));
			}, 10000);
			client.on('connect', () => {
				clearTimeout(timeout);
				resolve(client);
			});
			client.on('error', (err) => {
				clearTimeout(timeout);
				reject(err);
			});
		});
	}

	private sendApnsRequest(
		client: http2.ClientHttp2Session,
		jwt: string,
		deviceToken: string,
		body: string,
	): Promise<{status: number; reason?: string}> {
		return new Promise((resolve, reject) => {
			const req = client.request({
				':method': 'POST',
				':path': `/3/device/${deviceToken}`,
				authorization: `bearer ${jwt}`,
				'apns-topic': this.apnsBundleId,
				'apns-push-type': 'alert',
				'apns-priority': '10',
				'apns-expiration': String(Math.floor(Date.now() / 1000) + 86400),
			});

			const timeout = setTimeout(() => {
				req.close();
				reject(new Error('APNs request timeout'));
			}, 10000);

			let responseData = '';
			let status = 0;

			req.on('response', (headers) => {
				status = Number(headers[':status']);
			});
			req.on('data', (chunk) => {
				responseData += chunk;
			});
			req.on('end', () => {
				clearTimeout(timeout);
				if (status === 200) {
					resolve({status: 200});
				} else {
					try {
						const parsed = JSON.parse(responseData);
						resolve({status, reason: parsed.reason});
					} catch {
						resolve({status, reason: responseData || 'unknown'});
					}
				}
			});
			req.on('error', (err) => {
				clearTimeout(timeout);
				reject(err);
			});

			req.end(body);
		});
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
		// No persistent connections to clean up
	}
}

export const MobilePushService = new MobilePushServiceImpl();
