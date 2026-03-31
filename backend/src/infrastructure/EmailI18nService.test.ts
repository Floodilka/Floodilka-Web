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

import {beforeEach, describe, expect, it} from 'vitest';
import {EmailI18nService} from './EmailI18nService';
import type {EmailTemplateKey, EmailTemplateVariables} from './email_i18n';

describe('EmailI18nService', () => {
	let service: EmailI18nService;

	beforeEach(() => {
		service = new EmailI18nService();
	});

	describe('Template Rendering', () => {
		describe('passwordReset', () => {
			const variables = {
				username: 'testuser',
				resetUrl: 'https://floodilka.com/reset/abc123',
			};

			it('should render in en-US', () => {
				const result = service.getTemplate('passwordReset', 'en-US', variables);
				expect(result.subject).toBe('Reset your Floodilka password');
				expect(result.body).toContain('Hello testuser');
				expect(result.body).toContain('https://floodilka.com/reset/abc123');
				expect(result.body).toContain('This link will expire in 1 hour');
			});

			it('should render in es-ES', () => {
				const result = service.getTemplate('passwordReset', 'es-ES', variables);
				expect(result.subject).toContain('Restablece');
				expect(result.body).toContain('testuser');
				expect(result.body).toContain('https://floodilka.com/reset/abc123');
			});

			it('should render in ja', () => {
				const result = service.getTemplate('passwordReset', 'ja', variables);
				expect(result.subject).toContain('パスワード');
				expect(result.body).toContain('testuser');
				expect(result.body).toContain('https://floodilka.com/reset/abc123');
			});
		});

		describe('emailVerification', () => {
			const variables = {
				username: 'newuser',
				verifyUrl: 'https://floodilka.com/verify/xyz789',
			};

			it('should render in en-US', () => {
				const result = service.getTemplate('emailVerification', 'en-US', variables);
				expect(result.subject).toBe('Verify your Floodilka email address');
				expect(result.body).toContain('Hello newuser');
				expect(result.body).toContain('https://floodilka.com/verify/xyz789');
				expect(result.body).toContain('This link will expire in 24 hours');
			});

			it('should render in es-ES', () => {
				const result = service.getTemplate('emailVerification', 'es-ES', variables);
				expect(result.subject).toContain('Verifica');
				expect(result.body).toContain('newuser');
				expect(result.body).toContain('https://floodilka.com/verify/xyz789');
			});

			it('should render in ja', () => {
				const result = service.getTemplate('emailVerification', 'ja', variables);
				expect(result.subject).toContain('メール');
				expect(result.body).toContain('newuser');
				expect(result.body).toContain('https://floodilka.com/verify/xyz789');
			});
		});

		describe('accountDisabledSuspicious', () => {
			it('should render in en-US with reason', () => {
				const variables = {
					username: 'suspicioususer',
					reason: 'Multiple failed login attempts detected',
					forgotUrl: 'https://floodilka.com/forgot',
				};

				const result = service.getTemplate('accountDisabledSuspicious', 'en-US', variables);
				expect(result.subject).toBe('Your Floodilka account has been temporarily disabled');
				expect(result.body).toContain('Hello suspicioususer');
				expect(result.body).toContain('Multiple failed login attempts detected');
				expect(result.body).toContain('https://floodilka.com/forgot');
			});

			it('should render in en-US without reason', () => {
				const variables = {
					username: 'suspicioususer',
					reason: null,
					forgotUrl: 'https://floodilka.com/forgot',
				};

				const result = service.getTemplate('accountDisabledSuspicious', 'en-US', variables);
				expect(result.body).toContain('Hello suspicioususer');
				expect(result.body).not.toContain('Reason:');
				expect(result.body).toContain('https://floodilka.com/forgot');
			});

			it('should render in es-ES', () => {
				const variables = {
					username: 'suspicioususer',
					reason: 'Activity detected',
					forgotUrl: 'https://floodilka.com/forgot',
				};

				const result = service.getTemplate('accountDisabledSuspicious', 'es-ES', variables);
				expect(result.body).toContain('suspicioususer');
			});
		});

		describe('accountTempBanned', () => {
			const bannedUntil = new Date('2025-12-10T15:00:00Z');

			it('should render in en-US with plural hours', () => {
				const variables = {
					username: 'banneduser',
					reason: 'Spam behavior',
					durationHours: 24,
					bannedUntil,
					termsUrl: 'https://floodilka.com/terms',
					guidelinesUrl: 'https://floodilka.com/guidelines',
				};

				const result = service.getTemplate('accountTempBanned', 'en-US', variables);
				expect(result.subject).toBe('Your Floodilka account has been temporarily suspended');
				expect(result.body).toContain('Hello banneduser');
				expect(result.body).toContain('24 hours');
				expect(result.body).toContain('Spam behavior');
			});

			it('should render in en-US with singular hour', () => {
				const variables = {
					username: 'banneduser',
					reason: null,
					durationHours: 1,
					bannedUntil,
					termsUrl: 'https://floodilka.com/terms',
					guidelinesUrl: 'https://floodilka.com/guidelines',
				};

				const result = service.getTemplate('accountTempBanned', 'en-US', variables);
				expect(result.body).toContain('1 hour');
				expect(result.body).not.toContain('1 hours');
			});

			it('should render in es-ES', () => {
				const variables = {
					username: 'banneduser',
					reason: 'Spam behavior',
					durationHours: 48,
					bannedUntil,
					termsUrl: 'https://floodilka.com/terms',
					guidelinesUrl: 'https://floodilka.com/guidelines',
				};

				const result = service.getTemplate('accountTempBanned', 'es-ES', variables);
				expect(result.body).toContain('banneduser');
			});
		});

		describe('accountScheduledDeletion', () => {
			const deletionDate = new Date('2025-12-25T10:00:00Z');

			it('should render in en-US', () => {
				const variables = {
					username: 'deleteduser',
					reason: 'Repeated violations',
					deletionDate,
					termsUrl: 'https://floodilka.com/terms',
					guidelinesUrl: 'https://floodilka.com/guidelines',
				};

				const result = service.getTemplate('accountScheduledDeletion', 'en-US', variables);
				expect(result.subject).toBe('Your Floodilka account is scheduled for deletion');
				expect(result.body).toContain('Hello deleteduser');
				expect(result.body).toContain('Repeated violations');
				expect(result.body).toContain('appeals@floodilka.com');
			});

			it('should render in es-ES', () => {
				const variables = {
					username: 'deleteduser',
					reason: 'Violations',
					deletionDate,
					termsUrl: 'https://floodilka.com/terms',
					guidelinesUrl: 'https://floodilka.com/guidelines',
				};

				const result = service.getTemplate('accountScheduledDeletion', 'es-ES', variables);
				expect(result.body).toContain('deleteduser');
			});
		});

		describe('selfDeletionScheduled', () => {
			const deletionDate = new Date('2025-12-15T12:00:00Z');

			it('should render in en-US', () => {
				const variables = {
					username: 'leavinguser',
					deletionDate,
				};

				const result = service.getTemplate('selfDeletionScheduled', 'en-US', variables);
				expect(result.subject).toBe('Your Floodilka account deletion has been scheduled');
				expect(result.body).toContain('Hello leavinguser');
				expect(result.body).toContain('sad to see you go');
				expect(result.body).toContain('cancel this deletion');
			});

			it('should render in es-ES', () => {
				const variables = {
					username: 'leavinguser',
					deletionDate,
				};

				const result = service.getTemplate('selfDeletionScheduled', 'es-ES', variables);
				expect(result.body).toContain('leavinguser');
			});
		});

		describe('inactivityWarning', () => {
			const deletionDate = new Date('2025-12-20T10:00:00Z');
			const lastActiveDate = new Date('2023-01-15T08:30:00Z');

			it('should render in en-US', () => {
				const variables = {
					username: 'inactiveuser',
					deletionDate,
					lastActiveDate,
					loginUrl: 'https://floodilka.com/login',
				};

				const result = service.getTemplate('inactivityWarning', 'en-US', variables);
				expect(result.subject).toBe('Your Floodilka account will be deleted due to inactivity');
				expect(result.body).toContain('Hello inactiveuser');
				expect(result.body).toContain('over 2 years');
				expect(result.body).toContain('https://floodilka.com/login');
			});

			it('should render in es-ES', () => {
				const variables = {
					username: 'inactiveuser',
					deletionDate,
					lastActiveDate,
					loginUrl: 'https://floodilka.com/login',
				};

				const result = service.getTemplate('inactivityWarning', 'es-ES', variables);
				expect(result.body).toContain('inactiveuser');
			});
		});

		describe('harvestCompleted', () => {
			const expiresAt = new Date('2025-12-10T10:00:00Z');

			it('should render in en-US', () => {
				const variables = {
					username: 'datauser',
					downloadUrl: 'https://floodilka.com/download/abc123',
					totalMessages: 12345,
					fileSizeMB: 456,
					expiresAt,
				};

				const result = service.getTemplate('harvestCompleted', 'en-US', variables);
				expect(result.subject).toBe('Your Floodilka Data Export is Ready');
				expect(result.body).toContain('Hello datauser');
				expect(result.body).toContain('12,345');
				expect(result.body).toContain('456 MB');
				expect(result.body).toContain('https://floodilka.com/download/abc123');
			});

			it('should render in es-ES', () => {
				const variables = {
					username: 'datauser',
					downloadUrl: 'https://floodilka.com/download/abc123',
					totalMessages: 54321,
					fileSizeMB: 789,
					expiresAt,
				};

				const result = service.getTemplate('harvestCompleted', 'es-ES', variables);
				expect(result.body).toContain('datauser');
				expect(result.body).toContain('https://floodilka.com/download/abc123');
			});
		});

		describe('unbanNotification', () => {
			it('should render in en-US', () => {
				const variables = {
					username: 'unbanneduser',
					reason: 'Appeal approved',
				};

				const result = service.getTemplate('unbanNotification', 'en-US', variables);
				expect(result.subject).toBe('Your Floodilka account suspension has been lifted');
				expect(result.body).toContain('Hello unbanneduser');
				expect(result.body).toContain('Good news');
				expect(result.body).toContain('Appeal approved');
			});

			it('should render in es-ES', () => {
				const variables = {
					username: 'unbanneduser',
					reason: 'Appeal approved',
				};

				const result = service.getTemplate('unbanNotification', 'es-ES', variables);
				expect(result.body).toContain('unbanneduser');
			});
		});

		describe('scheduledDeletionNotification', () => {
			const deletionDate = new Date('2025-12-30T10:00:00Z');

			it('should render in en-US', () => {
				const variables = {
					username: 'scheduser',
					deletionDate,
					reason: 'Terms violation',
				};

				const result = service.getTemplate('scheduledDeletionNotification', 'en-US', variables);
				expect(result.subject).toBe('Your Floodilka account is scheduled for deletion');
				expect(result.body).toContain('Hello scheduser');
				expect(result.body).toContain('Terms violation');
				expect(result.body).toContain('appeals@floodilka.com');
			});

			it('should render in es-ES', () => {
				const variables = {
					username: 'scheduser',
					deletionDate,
					reason: 'Terms violation',
				};

				const result = service.getTemplate('scheduledDeletionNotification', 'es-ES', variables);
				expect(result.body).toContain('scheduser');
			});
		});

		describe('giftChargebackNotification', () => {
			it('should render in en-US', () => {
				const variables = {
					username: 'giftuser',
				};

				const result = service.getTemplate('giftChargebackNotification', 'en-US', variables);
				expect(result.subject).toBe('Your Floodilka Premium gift has been revoked');
				expect(result.body).toContain('Hello giftuser');
				expect(result.body).toContain('chargeback');
				expect(result.body).toContain('revoked');
			});

			it('should render in es-ES', () => {
				const variables = {
					username: 'giftuser',
				};

				const result = service.getTemplate('giftChargebackNotification', 'es-ES', variables);
				expect(result.body).toContain('giftuser');
			});
		});

		describe('reportResolved', () => {
			it('should render in en-US', () => {
				const variables = {
					username: 'reporter',
					reportId: 'RPT-12345',
					publicComment: 'We have taken action on the reported content.',
				};

				const result = service.getTemplate('reportResolved', 'en-US', variables);
				expect(result.subject).toBe('Your Floodilka report has been reviewed');
				expect(result.body).toContain('Hello reporter');
				expect(result.body).toContain('RPT-12345');
				expect(result.body).toContain('We have taken action on the reported content.');
			});

			it('should render in es-ES', () => {
				const variables = {
					username: 'reporter',
					reportId: 'RPT-54321',
					publicComment: 'Action taken.',
				};

				const result = service.getTemplate('reportResolved', 'es-ES', variables);
				expect(result.body).toContain('reporter');
				expect(result.body).toContain('RPT-54321');
			});
		});

	});

	describe('Locale handling', () => {
		it('should fall back to en-US for unsupported locale', () => {
			const variables = {
				username: 'testuser',
				resetUrl: 'https://floodilka.com/reset',
			};

			const result = service.getTemplate('passwordReset', 'unsupported-locale', variables);
			expect(result.subject).toBe('Reset your Floodilka password');
		});

		it('should fall back to en-US for null locale', () => {
			const variables = {
				username: 'testuser',
				resetUrl: 'https://floodilka.com/reset',
			};

			const result = service.getTemplate('passwordReset', null, variables);
			expect(result.subject).toBe('Reset your Floodilka password');
		});

		it('should handle all supported locales without error', () => {
			const supportedLocales = [
				'en-US',
				'en-GB',
				'ar',
				'bg',
				'cs',
				'da',
				'de',
				'el',
				'es-ES',
				'es-419',
				'fi',
				'fr',
				'he',
				'hi',
				'hr',
				'hu',
				'id',
				'it',
				'ja',
				'ko',
				'lt',
				'nl',
				'no',
				'pl',
				'pt-BR',
				'ro',
				'ru',
				'sv-SE',
				'th',
				'tr',
				'uk',
				'vi',
				'zh-CN',
				'zh-TW',
			];

			const variables = {
				username: 'testuser',
				resetUrl: 'https://floodilka.com/reset',
			};

			supportedLocales.forEach((locale) => {
				expect(() => {
					const result = service.getTemplate('passwordReset', locale, variables);
					expect(result.subject).toBeTruthy();
					expect(result.body).toBeTruthy();
				}).not.toThrow();
			});
		});
	});

	describe('Date and number formatting', () => {
		it('should format date according to locale', () => {
			const date = new Date('2025-12-03T15:30:00Z');

			const enUSResult = service.formatDate(date, 'en-US');
			const esESResult = service.formatDate(date, 'es-ES');

			expect(enUSResult).toBeTruthy();
			expect(esESResult).toBeTruthy();
			expect(enUSResult).not.toBe(esESResult);
		});

		it('should format numbers according to locale', () => {
			const number = 123456.78;

			const enUSResult = service.formatNumber(number, 'en-US');
			const deResult = service.formatNumber(number, 'de');

			expect(enUSResult).toContain('123');
			expect(deResult).toContain('123');
			expect(enUSResult).not.toBe(deResult);
		});
	});

	describe('All templates coverage', () => {
		const allTemplates: Array<EmailTemplateKey> = [
			'passwordReset',
			'passwordResetCode',
			'emailVerification',
			'emailChangeOriginal',
			'emailChangeNew',
			'emailChangeRevert',
			'accountDisabledSuspicious',
			'accountTempBanned',
			'accountScheduledDeletion',
			'selfDeletionScheduled',
			'inactivityWarning',
			'harvestCompleted',
			'unbanNotification',
			'scheduledDeletionNotification',
			'giftChargebackNotification',
			'reportResolved',
			'registrationCode',
		];

		it('should have tests for all 17 templates', () => {
			expect(allTemplates).toHaveLength(17);
		});

		it('should render all templates in en-US without errors', () => {
			const testVariables: EmailTemplateVariables = {
				passwordReset: {username: 'user', resetUrl: 'url'},
				passwordResetCode: {username: 'user', code: '123456'},
				emailVerification: {username: 'user', verifyUrl: 'url'},
				emailChangeOriginal: {username: 'user', code: '123456', expiresAt: new Date()},
				emailChangeNew: {username: 'user', code: '123456', expiresAt: new Date()},
				emailChangeRevert: {username: 'user', newEmail: 'new@example.com', revertUrl: 'url'},
				accountDisabledSuspicious: {username: 'user', reason: 'reason', forgotUrl: 'url'},
				accountTempBanned: {
					username: 'user',
					reason: 'reason',
					durationHours: 24,
					bannedUntil: new Date(),
					termsUrl: 'url',
					guidelinesUrl: 'url',
				},
				accountScheduledDeletion: {
					username: 'user',
					reason: 'reason',
					deletionDate: new Date(),
					termsUrl: 'url',
					guidelinesUrl: 'url',
				},
				selfDeletionScheduled: {username: 'user', deletionDate: new Date()},
				inactivityWarning: {
					username: 'user',
					deletionDate: new Date(),
					lastActiveDate: new Date(),
					loginUrl: 'url',
				},
				harvestCompleted: {
					username: 'user',
					downloadUrl: 'url',
					totalMessages: 100,
					fileSizeMB: 50,
					expiresAt: new Date(),
				},
				unbanNotification: {username: 'user', reason: 'reason'},
				scheduledDeletionNotification: {
					username: 'user',
					deletionDate: new Date(),
					reason: 'reason',
				},
				giftChargebackNotification: {username: 'user'},
				reportResolved: {username: 'user', reportId: 'id', publicComment: 'comment'},
				dsaReportVerification: {code: '123456', expiresAt: new Date()},
				registrationCode: {username: 'user', code: '123456'},
			};

			allTemplates.forEach((template) => {
				const variables = testVariables[template];
				expect(() => {
					const result = service.getTemplate(template, 'en-US', variables);
					expect(result.subject).toBeTruthy();
					expect(result.body).toBeTruthy();
					expect(result.body.length).toBeGreaterThan(0);
				}).not.toThrow();
			});
		});
	});
});
