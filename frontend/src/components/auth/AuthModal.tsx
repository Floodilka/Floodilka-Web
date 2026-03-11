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

import {useCallback, useEffect, useState} from 'react';
import * as AuthenticationActionCreators from '~/actions/AuthenticationActionCreators';
import ForgotPassword from '~/components/auth/ForgotPassword';
import Login from '~/components/auth/Login';
import MfaScreen from '~/components/auth/MfaScreen';
import Register from '~/components/auth/Register';
import VerifyEmailCode from '~/components/auth/VerifyEmailCode';
import {Routes} from '~/Routes';
import type {LoginSuccessPayload, MfaChallenge} from '~/viewmodels/auth/AuthFlow';
import {isDesktop} from '~/utils/NativeUtils';
import * as RouterUtils from '~/utils/RouterUtils';
import './AuthModal.css';

type AuthMode = 'login' | 'register' | 'verify' | 'forgot-password' | 'mfa';

interface AuthModalProps {
	initialMode?: 'login' | 'register';
}

export default function AuthModal({initialMode = 'login'}: AuthModalProps) {
	const isElectron = isDesktop();
	const [mode, setMode] = useState<AuthMode>(initialMode);
	const [verificationData, setVerificationData] = useState<{email: string; username: string; ticket: string} | null>(null);
	const [forgotStep, setForgotStep] = useState(1);
	const [mfaChallenge, setMfaChallenge] = useState<MfaChallenge | null>(null);

	const navigateToAuthRoute = useCallback((path: string) => {
		const search = window.location.search;
		RouterUtils.replaceWith(`${path}${search}`);
	}, []);

	const navigateToApp = useCallback(() => {
		const search = window.location.search;
		const qp = new URLSearchParams(search);
		const redirectTo = qp.get('redirect_to');
		const safeRedirect = redirectTo && !redirectTo.startsWith('/login') && !redirectTo.startsWith('/register') ? redirectTo : '/channels/@me';
		RouterUtils.replaceWith(safeRedirect);
	}, []);

	const handleLoginSuccess = useCallback(
		async (payload: LoginSuccessPayload) => {
			await AuthenticationActionCreators.completeLogin({
				token: payload.token,
				userId: payload.userId,
			});
			navigateToApp();
		},
		[navigateToApp],
	);

	const handleMfaRequired = useCallback((challenge: MfaChallenge) => {
		setMfaChallenge(challenge);
		setMode('mfa');
	}, []);

	const handleMfaSuccess = useCallback(
		async (payload: LoginSuccessPayload) => {
			await AuthenticationActionCreators.completeLogin({
				token: payload.token,
				userId: payload.userId,
			});
			navigateToApp();
		},
		[navigateToApp],
	);

	const handleMfaCancel = useCallback(() => {
		setMfaChallenge(null);
		setMode('login');
	}, []);

	const handleVerifyBackClick = useCallback(() => {
		setMode('register');
	}, []);

	const handleForgotStart = useCallback(() => {
		setForgotStep(1);
		setMode('forgot-password');
	}, []);

	useEffect(() => {
		if (mode !== 'forgot-password') {
			setForgotStep(1);
		}
	}, [mode]);

	const contentClassName = [
		'auth-modal-content',
		mode === 'register' ? 'register-step-1' : '',
		mode === 'verify' ? 'verify-email' : '',
		mode === 'forgot-password' ? 'forgot-password' : '',
	]
		.filter(Boolean)
		.join(' ');

	const content = (
		<div className={contentClassName}>
			{/* Back button for verify mode */}
			{mode === 'verify' && (
				<button type="button" className="auth-floating-back-btn" onClick={handleVerifyBackClick} aria-label="Назад">
					<img src="/icons/back.png" alt="" aria-hidden="true" />
				</button>
			)}

			{/* Header for login and register */}
			{mode !== 'verify' && mode !== 'forgot-password' && mode !== 'mfa' && (
				<>
					{!(isElectron && (mode === 'login' || mode === 'register')) && (
						<button type="button" className="auth-floating-back-btn" onClick={() => {
							if (window.history.length > 1) {
								window.history.back();
							} else {
								RouterUtils.replaceWith('/');
							}
						}} aria-label="Назад">
							<img src="/icons/back.png" alt="" aria-hidden="true" />
						</button>
					)}
					<div className="auth-header">
						<div className="auth-header-icon">
							<img src="/icons/logo_nobg.png" alt="Floodilka" />
						</div>
						<h1>{mode === 'login' ? 'Вход в аккаунт' : 'Регистрация'}</h1>
						{mode === 'register' && (
							<p>
								Уже есть аккаунт?{' '}
								<button type="button" onClick={() => navigateToAuthRoute(Routes.LOGIN)}>
									Войти
								</button>
							</p>
						)}
					</div>
				</>
			)}

			{/* Header for forgot password */}
			{mode === 'forgot-password' && (
				<>
					<button
						type="button"
						className="auth-floating-back-btn"
						onClick={() => {
							setForgotStep(1);
							setMode('login');
						}}
						aria-label="Назад"
					>
						<img src="/icons/back.png" alt="" aria-hidden="true" />
					</button>
					{forgotStep !== 2 && (
						<div className="auth-header">
							<div className="auth-header-icon">
								<img src="/icons/logo_nobg.png" alt="Floodilka" />
							</div>
							<h1>Восстановление пароля</h1>
							<p>{forgotStep === 1 ? 'Отправим код на почту' : 'Придумай новый пароль'}</p>
						</div>
					)}
				</>
			)}

			{/* MFA back button */}
			{mode === 'mfa' && (
				<button type="button" className="auth-floating-back-btn" onClick={handleMfaCancel} aria-label="Назад">
					<img src="/icons/back.png" alt="" aria-hidden="true" />
				</button>
			)}

			{/* Form container */}
			<div className="auth-form-container">
				{mode === 'login' && (
					<Login
						onSwitchToRegister={() => navigateToAuthRoute(Routes.REGISTER)}
						onForgotPassword={handleForgotStart}
						onMfaRequired={handleMfaRequired}
						onLoginSuccess={handleLoginSuccess}
					/>
				)}
				{mode === 'register' && (
					<Register
						onSwitchToLogin={() => navigateToAuthRoute(Routes.LOGIN)}
						onVerificationRequired={(data) => {
							setVerificationData(data);
							setMode('verify');
						}}
					/>
				)}
				{mode === 'forgot-password' && (
					<ForgotPassword
						onBack={() => {
							setForgotStep(1);
							setMode('login');
						}}
						onStepChange={setForgotStep}
					/>
				)}
				{mode === 'verify' && verificationData && (
					<VerifyEmailCode
						email={verificationData.email}
						username={verificationData.username}
						ticket={verificationData.ticket}
						onVerified={handleLoginSuccess}
					/>
				)}
				{mode === 'mfa' && mfaChallenge && (
					<div className="auth-mfa-container">
						<MfaScreen
							challenge={mfaChallenge}
							onSuccess={handleMfaSuccess}
							onCancel={handleMfaCancel}
						/>
					</div>
				)}
			</div>
		</div>
	);

	return <div className="auth-standalone">{content}</div>;
}
