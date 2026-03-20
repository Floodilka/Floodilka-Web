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

import type {AuthenticationResponseJSON} from '@simplewebauthn/server';
import type {HonoApp} from '~/App';
import {
	EmailRevertRequest,
	ForgotPasswordRequest,
	LoginRequest,
	LogoutAuthSessionsRequest,
	RegisterRequest,
	ResendRegistrationRequest,
	ResetPasswordRequest,
	UsernameSuggestionsRequest,
	VerifyEmailRequest,
	VerifyRegistrationRequest,
	VerifyResetCodeRequest,
} from '~/auth/AuthModel';
import {requireSudoMode} from '~/auth/services/SudoVerificationService';
import {InputValidationError} from '~/Errors';
import {DefaultUserOnly, LoginRequired, LoginRequiredAllowSuspicious} from '~/middleware/AuthMiddleware';
import {CaptchaMiddleware} from '~/middleware/CaptchaMiddleware';
import {RateLimitMiddleware} from '~/middleware/RateLimitMiddleware';
import {SudoModeMiddleware} from '~/middleware/SudoModeMiddleware';
import {RateLimitConfigs} from '~/RateLimitConfig';
import {createStringType, SudoVerificationSchema, z} from '~/Schema';
import {generateUsernameSuggestions} from '~/utils/UsernameSuggestionUtils';
import {Validator} from '~/Validator';

export const AuthController = (app: HonoApp) => {
	app.post(
		'/auth/register',
		CaptchaMiddleware,
		RateLimitMiddleware(RateLimitConfigs.AUTH_REGISTER),
		Validator('json', RegisterRequest),
		async (ctx) => {
			const data = ctx.req.valid('json');
			const request = ctx.req.raw;
			const result = await ctx.get('authService').register({
				data,
				request,
			});
			return ctx.json(result);
		},
	);

	app.post(
		'/auth/register/verify',
		RateLimitMiddleware(RateLimitConfigs.AUTH_VERIFY_EMAIL),
		Validator('json', VerifyRegistrationRequest),
		async (ctx) => {
			const {ticket, code} = ctx.req.valid('json');
			const request = ctx.req.raw;
			const requestCache = ctx.get('requestCache');
			const result = await ctx.get('authService').verifyRegistrationCode({
				ticket,
				code,
				request,
				requestCache,
			});
			return ctx.json(result);
		},
	);

	app.post(
		'/auth/register/resend',
		RateLimitMiddleware(RateLimitConfigs.AUTH_RESEND_VERIFICATION),
		Validator('json', ResendRegistrationRequest),
		async (ctx) => {
			const {ticket} = ctx.req.valid('json');
			await ctx.get('authService').resendRegistrationCode({ticket});
			return ctx.body(null, 204);
		},
	);

	app.post(
		'/auth/login',
		CaptchaMiddleware,
		RateLimitMiddleware(RateLimitConfigs.AUTH_LOGIN),
		Validator('json', LoginRequest),
		async (ctx) => {
			const data = ctx.req.valid('json');
			const request = ctx.req.raw;
			const result = await ctx.get('authService').login({
				data,
				request,
			});
			return ctx.json(result);
		},
	);

	app.post(
		'/auth/login/mfa/totp',
		RateLimitMiddleware(RateLimitConfigs.AUTH_LOGIN_MFA),
		Validator(
			'json',
			z.object({
				code: createStringType(),
				ticket: createStringType(),
			}),
		),
		async (ctx) => {
			const {code, ticket} = ctx.req.valid('json');
			const request = ctx.req.raw;
			const result = await ctx.get('authService').loginMfaTotp({
				code,
				ticket,
				request,
			});
			return ctx.json(result);
		},
	);

	app.post(
		'/auth/login/mfa/sms/send',
		RateLimitMiddleware(RateLimitConfigs.AUTH_LOGIN_MFA),
		Validator('json', z.object({ticket: createStringType()})),
		async (ctx) => {
			const {ticket} = ctx.req.valid('json');
			await ctx.get('authService').sendSmsMfaCodeForTicket(ticket);
			return ctx.body(null, 204);
		},
	);

	app.post(
		'/auth/login/mfa/sms',
		RateLimitMiddleware(RateLimitConfigs.AUTH_LOGIN_MFA),
		Validator(
			'json',
			z.object({
				code: createStringType(),
				ticket: createStringType(),
			}),
		),
		async (ctx) => {
			const {code, ticket} = ctx.req.valid('json');
			const request = ctx.req.raw;
			const result = await ctx.get('authService').loginMfaSms({
				code,
				ticket,
				request,
			});
			return ctx.json(result);
		},
	);

	app.post('/auth/logout', RateLimitMiddleware(RateLimitConfigs.AUTH_LOGOUT), async (ctx) => {
		const token = ctx.req.header('Authorization') ?? ctx.get('authToken');
		if (token) {
			await ctx.get('authService').revokeToken(token);
		}
		return ctx.body(null, 204);
	});

	app.post(
		'/auth/verify',
		RateLimitMiddleware(RateLimitConfigs.AUTH_VERIFY_EMAIL),
		Validator('json', VerifyEmailRequest),
		async (ctx) => {
			const data = ctx.req.valid('json');
			const success = await ctx.get('authService').verifyEmail(data);
			if (!success) {
				throw InputValidationError.create('token', 'Недействительный или просроченный токен подтверждения');
			}
			return ctx.body(null, 204);
		},
	);

	app.post(
		'/auth/verify/resend',
		RateLimitMiddleware(RateLimitConfigs.AUTH_RESEND_VERIFICATION),
		LoginRequiredAllowSuspicious,
		DefaultUserOnly,
		async (ctx) => {
			const user = ctx.get('user');
			await ctx.get('authService').resendVerificationEmail(user);
			return ctx.body(null, 204);
		},
	);

	app.post(
		'/auth/forgot',
		CaptchaMiddleware,
		RateLimitMiddleware(RateLimitConfigs.AUTH_FORGOT_PASSWORD),
		Validator('json', ForgotPasswordRequest),
		async (ctx) => {
			const data = ctx.req.valid('json');
			const request = ctx.req.raw;
			await ctx.get('authService').forgotPassword({
				data,
				request,
			});
			return ctx.body(null, 204);
		},
	);

	app.post(
		'/auth/forgot/verify',
		RateLimitMiddleware(RateLimitConfigs.AUTH_VERIFY_RESET_CODE),
		Validator('json', VerifyResetCodeRequest),
		async (ctx) => {
			const data = ctx.req.valid('json');
			const result = await ctx.get('authService').verifyResetCode({data});
			return ctx.json(result);
		},
	);

	app.post(
		'/auth/reset',
		RateLimitMiddleware(RateLimitConfigs.AUTH_RESET_PASSWORD),
		Validator('json', ResetPasswordRequest),
		async (ctx) => {
			const data = ctx.req.valid('json');
			const request = ctx.req.raw;
			const result = await ctx.get('authService').resetPassword({
				data,
				request,
			});
			return ctx.json(result);
		},
	);

	app.post(
		'/auth/email-revert',
		RateLimitMiddleware(RateLimitConfigs.AUTH_EMAIL_REVERT),
		Validator('json', EmailRevertRequest),
		async (ctx) => {
			const data = ctx.req.valid('json');
			const request = ctx.req.raw;
			const result = await ctx.get('authService').revertEmailChange({
				data,
				request,
			});
			return ctx.json(result);
		},
	);

	app.get(
		'/auth/sessions',
		RateLimitMiddleware(RateLimitConfigs.AUTH_SESSIONS_GET),
		LoginRequiredAllowSuspicious,
		DefaultUserOnly,
		async (ctx) => {
			const userId = ctx.get('user').id;
			return ctx.json(await ctx.get('authService').getAuthSessions(userId));
		},
	);

	app.post(
		'/auth/sessions/logout',
		RateLimitMiddleware(RateLimitConfigs.AUTH_SESSIONS_LOGOUT),
		LoginRequiredAllowSuspicious,
		DefaultUserOnly,
		SudoModeMiddleware,
		Validator('json', LogoutAuthSessionsRequest.merge(SudoVerificationSchema)),
		async (ctx) => {
			const user = ctx.get('user');
			const body = ctx.req.valid('json');
			await requireSudoMode(ctx, user, body, ctx.get('authService'), ctx.get('authMfaService'));
			await ctx.get('authService').logoutAuthSessions({
				user,
				sessionIdHashes: body.session_id_hashes,
			});
			return ctx.body(null, 204);
		},
	);

	app.post(
		'/auth/webauthn/authentication-options',
		RateLimitMiddleware(RateLimitConfigs.AUTH_WEBAUTHN_OPTIONS),
		async (ctx) => {
			const options = await ctx.get('authService').generateWebAuthnAuthenticationOptionsDiscoverable();
			return ctx.json(options);
		},
	);

	app.post(
		'/auth/webauthn/authenticate',
		RateLimitMiddleware(RateLimitConfigs.AUTH_WEBAUTHN_AUTHENTICATE),
		Validator(
			'json',
			z.object({
				response: z.custom<AuthenticationResponseJSON>(),
				challenge: createStringType(),
			}),
		),
		async (ctx) => {
			const {response, challenge} = ctx.req.valid('json');
			const user = await ctx.get('authService').verifyWebAuthnAuthenticationDiscoverable(response, challenge);
			const request = ctx.req.raw;
			const [token] = await ctx.get('authService').createAuthSession({user, request});
			return ctx.json({token, user_id: user.id.toString()});
		},
	);

	app.post(
		'/auth/login/mfa/webauthn/authentication-options',
		RateLimitMiddleware(RateLimitConfigs.AUTH_LOGIN_MFA),
		Validator('json', z.object({ticket: createStringType()})),
		async (ctx) => {
			const {ticket} = ctx.req.valid('json');
			const options = await ctx.get('authService').generateWebAuthnAuthenticationOptionsForMfa(ticket);
			return ctx.json(options);
		},
	);

	app.post(
		'/auth/login/mfa/webauthn',
		RateLimitMiddleware(RateLimitConfigs.AUTH_LOGIN_MFA),
		Validator(
			'json',
			z.object({
				response: z.custom<AuthenticationResponseJSON>(),
				challenge: createStringType(),
				ticket: createStringType(),
			}),
		),
		async (ctx) => {
			const {response, challenge, ticket} = ctx.req.valid('json');
			const request = ctx.req.raw;
			const result = await ctx.get('authService').loginMfaWebAuthn({
				response,
				challenge,
				ticket,
				request,
			});
			return ctx.json(result);
		},
	);

	app.post(
		'/auth/username-suggestions',
		RateLimitMiddleware(RateLimitConfigs.AUTH_REGISTER),
		Validator('json', UsernameSuggestionsRequest),
		async (ctx) => {
			const {global_name} = ctx.req.valid('json');
			const suggestions = generateUsernameSuggestions(global_name);
			return ctx.json({suggestions});
		},
	);

	app.post('/auth/handoff/initiate', RateLimitMiddleware(RateLimitConfigs.AUTH_HANDOFF_INITIATE), async (ctx) => {
		const userAgent = ctx.req.header('User-Agent');
		const result = await ctx.get('desktopHandoffService').initiateHandoff(userAgent);
		return ctx.json({
			code: result.code,
			expires_at: result.expiresAt.toISOString(),
		});
	});

	app.post(
		'/auth/handoff/complete',
		RateLimitMiddleware(RateLimitConfigs.AUTH_HANDOFF_COMPLETE),
		Validator(
			'json',
			z.object({
				code: createStringType(),
				token: createStringType(),
				user_id: createStringType(),
			}),
		),
		async (ctx) => {
			const {code, token, user_id} = ctx.req.valid('json');
			const {token: handoffToken, userId} = await ctx.get('authService').createAdditionalAuthSessionFromToken({
				token,
				expectedUserId: user_id,
				request: ctx.req.raw,
			});

			await ctx.get('desktopHandoffService').completeHandoff(code, handoffToken, userId);
			return ctx.body(null, 204);
		},
	);

	app.get(
		'/auth/handoff/:code/status',
		RateLimitMiddleware(RateLimitConfigs.AUTH_HANDOFF_STATUS),
		Validator('param', z.object({code: createStringType()})),
		async (ctx) => {
			const {code} = ctx.req.valid('param');
			const result = await ctx.get('desktopHandoffService').getHandoffStatus(code);
			return ctx.json({
				status: result.status,
				token: result.token,
				user_id: result.userId,
			});
		},
	);

	app.delete(
		'/auth/handoff/:code',
		RateLimitMiddleware(RateLimitConfigs.AUTH_HANDOFF_CANCEL),
		Validator('param', z.object({code: createStringType()})),
		async (ctx) => {
			const {code} = ctx.req.valid('param');
			await ctx.get('desktopHandoffService').cancelHandoff(code);
			return ctx.body(null, 204);
		},
	);

	const PushTokenRequest = z.object({
		token: createStringType(),
		platform: z.enum(['ios', 'android']).optional(),
	});

	app.post(
		'/auth/push-token',
		LoginRequired,
		RateLimitMiddleware(RateLimitConfigs.AUTH_PUSH_TOKEN_REGISTER),
		Validator('json', PushTokenRequest),
		async (ctx) => {
			const {token, platform: bodyPlatform} = ctx.req.valid('json');
			const platform = bodyPlatform ?? ctx.req.header('X-Floodilka-Platform') ?? 'ios';

			if (platform !== 'ios' && platform !== 'android') {
				return ctx.json({error: 'Invalid platform'}, 400);
			}

			const userId = ctx.get('user').id;
			await ctx.get('userRepository').upsertMobilePushToken(userId, token, platform);
			return ctx.json({success: true});
		},
	);

	app.delete(
		'/auth/push-token',
		LoginRequired,
		RateLimitMiddleware(RateLimitConfigs.AUTH_PUSH_TOKEN_UNREGISTER),
		Validator('json', z.object({token: createStringType()})),
		async (ctx) => {
			const {token} = ctx.req.valid('json');
			const userId = ctx.get('user').id;
			await ctx.get('userRepository').deleteMobilePushTokenByValue(userId, token);
			return ctx.json({success: true});
		},
	);
};
