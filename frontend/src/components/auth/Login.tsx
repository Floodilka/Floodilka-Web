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

import {type FormEvent, useState} from 'react';
import * as AuthenticationActionCreators from '~/actions/AuthenticationActionCreators';
import * as ToastActionCreators from '~/actions/ToastActionCreators';
import {Routes} from '~/Routes';
import type {LoginSuccessPayload, MfaChallenge} from '~/viewmodels/auth/AuthFlow';

interface LoginProps {
	onSwitchToRegister: () => void;
	onForgotPassword: () => void;
	onMfaRequired: (challenge: MfaChallenge) => void;
	onLoginSuccess: (payload: LoginSuccessPayload) => void;
}

export default function Login({onSwitchToRegister, onForgotPassword, onMfaRequired, onLoginSuccess}: LoginProps) {
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [loading, setLoading] = useState(false);
	const [showPassword, setShowPassword] = useState(false);
	const [emailError, setEmailError] = useState(false);
	const [passwordError, setPasswordError] = useState(false);

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault();
		setEmailError(false);
		setPasswordError(false);
		setLoading(true);

		try {
			const response = await AuthenticationActionCreators.login({email, password});

			if (response.mfa) {
				onMfaRequired({
					ticket: response.ticket,
					sms: response.sms,
					totp: response.totp,
					webauthn: response.webauthn,
				});
				return;
			}

			onLoginSuccess({
				token: response.token,
				userId: response.user_id,
			});
		} catch (err) {
			const error = err as {body?: {message?: string; errors?: Array<{path: string; message: string}>}; message?: string};
			let errorMessage = 'Неверно введен адрес почты или пароль';
			if (error.body?.errors?.length) {
				errorMessage = [...new Set(error.body.errors.map((e) => e.message))].join(', ');
			} else if (error.body?.message && error.body.message !== 'Input Validation Error') {
				errorMessage = error.body.message;
			}
			setEmailError(true);
			setPasswordError(true);
			ToastActionCreators.error(errorMessage);
		} finally {
			setLoading(false);
		}
	};

	const isFormValid = email.length > 0 && password.length >= 6;

	return (
		<>
			<form className="auth-form" onSubmit={handleSubmit}>
				<div className="form-group">
					<label>Email</label>
					<input
						type="email"
						placeholder="Адрес электронной почты"
						value={email}
						onChange={(e) => {
							setEmail(e.target.value);
							setEmailError(false);
						}}
						required
						disabled={loading}
						className={emailError ? 'input-error' : ''}
					/>
				</div>

				<div className="form-group">
					<label>Пароль</label>
					<div className="password-input-wrapper">
						<input
							type={showPassword ? 'text' : 'password'}
							placeholder="Пароль"
							value={password}
							onChange={(e) => {
								setPassword(e.target.value);
								setPasswordError(false);
							}}
							required
							minLength={6}
							disabled={loading}
							className={passwordError ? 'input-error' : ''}
						/>
						<button
							type="button"
							className="password-toggle-btn"
							onClick={() => setShowPassword(!showPassword)}
							tabIndex={-1}
						>
							<img
								src={showPassword ? '/icons/eye.png' : '/icons/eye_closed.png'}
								alt={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
								className="password-toggle-icon"
							/>
						</button>
					</div>
				</div>

				<div className="forgot-password">
					<button type="button" className="forgot-password-link" onClick={onForgotPassword}>
						Не помню пароль
					</button>
				</div>

				<button
					type="submit"
					className={`auth-submit-btn ${isFormValid ? 'active' : ''}`}
					disabled={loading || !isFormValid}
				>
					{loading ? 'Вход...' : 'Войти'}
				</button>
			</form>

			<div className="auth-switch">
				<button type="button" onClick={onSwitchToRegister} className="auth-switch-btn">
					Создать аккаунт
				</button>
			</div>

			<div className="auth-terms">
				Продолжая, ты принимаешь{' '}
				<a href={Routes.privacy()} target="_blank" rel="noopener noreferrer">
					политику конфиденциальности
				</a>{' '}
				и{' '}
				<a href={Routes.terms()} target="_blank" rel="noopener noreferrer">
					правила сервиса
				</a>
			</div>
		</>
	);
}
