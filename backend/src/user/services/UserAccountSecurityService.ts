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

import {uint8ArrayToBase64} from 'uint8array-extras';
import type {AuthService} from '~/auth/AuthService';
import type {SudoVerificationResult} from '~/auth/services/SudoVerificationService';
import {userHasMfa} from '~/auth/services/SudoVerificationService';
import type {PartialRowUpdate, UserRow} from '~/database/CassandraTypes';
import {InputValidationError} from '~/Errors';
import {SudoModeRequiredError} from '~/errors/SudoModeRequiredError';
import type {IRateLimitService} from '~/infrastructure/IRateLimitService';
import type {AuthSession, User} from '~/Models';
import type {UserUpdateRequest} from '~/user/UserModel';
import type {IUserAccountRepository} from '../repositories/IUserAccountRepository';

interface UserFieldUpdates extends PartialRowUpdate<UserRow> {
	invalidateAuthSessions?: boolean;
}

interface UserAccountSecurityServiceDeps {
	userAccountRepository: IUserAccountRepository;
	authService: AuthService;
	rateLimitService: IRateLimitService;
}

export class UserAccountSecurityService {
	constructor(private readonly deps: UserAccountSecurityServiceDeps) {}

	async processSecurityUpdates(params: {
		user: User;
		data: UserUpdateRequest;
		sudoContext?: SudoVerificationResult;
	}): Promise<UserFieldUpdates> {
		const {user, data, sudoContext} = params;
		const updates: UserFieldUpdates = {
			password_hash: user.passwordHash,
			username: user.username,
			global_name: user.isBot ? null : user.globalName,
			email: user.email,
			invalidateAuthSessions: false,
		};

		const isUnclaimedAccount = user.isUnclaimedAccount();
		const identityVerifiedViaSudo = sudoContext?.method === 'mfa' || sudoContext?.method === 'sudo_token';
		const identityVerifiedViaPassword = sudoContext?.method === 'password';
		const hasMfa = userHasMfa(user);

		const rawEmail = data.email?.trim();
		const normalizedEmail = rawEmail?.toLowerCase();

		const hasPasswordRequiredChanges =
			(data.username !== undefined && data.username !== user.username) ||
			(data.email !== undefined && normalizedEmail !== user.email?.toLowerCase()) ||
			data.new_password !== undefined;

		const requiresVerification = hasPasswordRequiredChanges && !isUnclaimedAccount;
		if (requiresVerification && !identityVerifiedViaSudo && !identityVerifiedViaPassword) {
			throw new SudoModeRequiredError(hasMfa);
		}

		if (isUnclaimedAccount && data.new_password) {
			updates.password_hash = await this.hashNewPassword(data.new_password);
			updates.password_last_changed_at = new Date();
			updates.invalidateAuthSessions = false;
		} else if (data.new_password) {
			if (!identityVerifiedViaSudo && !identityVerifiedViaPassword) {
				throw new SudoModeRequiredError(hasMfa);
			}
			updates.password_hash = await this.hashNewPassword(data.new_password);
			updates.password_last_changed_at = new Date();
			updates.invalidateAuthSessions = true;
		}

		if (data.username) {
			updates.username = await this.updateUsername({
				user,
				username: data.username,
			});
		}

		if (user.isBot) {
			updates.global_name = null;
		} else if (data.global_name !== undefined) {
			updates.global_name = data.global_name;
		}

		if (rawEmail) {
			if (normalizedEmail !== user.email?.toLowerCase()) {
				const existing = await this.deps.userAccountRepository.findByEmail(normalizedEmail!);
				if (existing && existing.id !== user.id) {
					throw InputValidationError.create('email', 'Этот email уже используется');
				}
			}

			updates.email = rawEmail;
		}

		return updates;
	}

	async invalidateAndRecreateSessions({
		user,
		oldAuthSession,
		request,
	}: {
		user: User;
		oldAuthSession: AuthSession;
		request: Request;
	}): Promise<void> {
		await this.deps.authService.terminateAllUserSessions(user.id);

		const [newToken, newAuthSession] = await this.deps.authService.createAuthSession({user, request});
		const oldAuthSessionIdHash = uint8ArrayToBase64(oldAuthSession.sessionIdHash, {urlSafe: true});

		await this.deps.authService.dispatchAuthSessionChange({
			userId: user.id,
			oldAuthSessionIdHash,
			newAuthSessionIdHash: uint8ArrayToBase64(newAuthSession.sessionIdHash, {urlSafe: true}),
			newToken,
		});
	}

	private async hashNewPassword(newPassword: string): Promise<string> {
		return await this.deps.authService.hashPassword(newPassword);
	}

	private async updateUsername({
		user,
		username,
	}: {
		user: User;
		username: string;
	}): Promise<string> {
		if (user.username.toLowerCase() === username.toLowerCase()) {
			return username;
		}

		const rateLimit = await this.deps.rateLimitService.checkLimit({
			identifier: `username_change:${user.id}`,
			maxAttempts: 5,
			windowMs: 60 * 60 * 1000,
		});

		if (!rateLimit.allowed) {
			const minutes = Math.ceil((rateLimit.retryAfter || 0) / 60);
			throw InputValidationError.create(
				'username',
				`Вы слишком часто меняли имя пользователя. Попробуйте снова через ${minutes} мин.`,
			);
		}

		const existing = await this.deps.userAccountRepository.findByUsername(username);
		if (existing && existing.id !== user.id) {
			throw InputValidationError.create('username', 'Имя пользователя уже занято');
		}

		return username;
	}
}
