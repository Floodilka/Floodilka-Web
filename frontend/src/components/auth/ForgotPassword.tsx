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

import {type FormEvent, useEffect, useRef, useState} from 'react';
import * as AuthenticationActionCreators from '~/actions/AuthenticationActionCreators';
import * as ToastActionCreators from '~/actions/ToastActionCreators';

interface ForgotPasswordProps {
	onBack: () => void;
	onStepChange: (step: number) => void;
}

export default function ForgotPassword({onBack, onStepChange}: ForgotPasswordProps) {
	const [step, setStep] = useState(1);
	const [email, setEmail] = useState('');
	const [code, setCode] = useState(['', '', '', '', '', '']);
	const [resetToken, setResetToken] = useState('');
	const [password, setPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [loading, setLoading] = useState(false);
	const [emailError, setEmailError] = useState(false);
	const [codeError, setCodeError] = useState(false);
	const [passwordError, setPasswordError] = useState(false);
	const [confirmPasswordError, setConfirmPasswordError] = useState(false);
	const codeRefs = useRef<Array<HTMLInputElement | null>>([]);

	useEffect(() => {
		onStepChange(step);
	}, [step, onStepChange]);

	useEffect(() => {
		if (step === 2 && codeRefs.current[0]) {
			codeRefs.current[0].focus();
		}
	}, [step]);

	const handleSendCode = async (e: FormEvent) => {
		e.preventDefault();
		setEmailError(false);

		if (!email || !email.includes('@')) {
			setEmailError(true);
			ToastActionCreators.error('Введите корректный email адрес');
			return;
		}

		setLoading(true);

		try {
			await AuthenticationActionCreators.forgotPassword(email);
			setStep(2);
			ToastActionCreators.success('Код отправлен на вашу почту');
		} finally {
			setLoading(false);
		}
	};

	const handleVerifyCode = async (e: FormEvent) => {
		e.preventDefault();
		if (loading) return;
		setCodeError(false);

		const codeString = code.join('');

		if (!codeString || codeString.length !== 6) {
			setCodeError(true);
			ToastActionCreators.error('Введите 6-значный код');
			return;
		}

		setLoading(true);
		try {
			const result = await AuthenticationActionCreators.verifyResetCode(email, codeString);
			if (!result?.resetToken) {
				throw new Error('Не удалось подтвердить код');
			}
			setResetToken(result.resetToken);
			setStep(3);
			ToastActionCreators.success('Код подтвержден. Придумайте новый пароль.');
		} catch (err) {
			const error = err as {body?: {message?: string}; message?: string};
			const errorMessage = error.body?.message || error.message || 'Неверный или истекший код';
			setCodeError(true);
			ToastActionCreators.error(errorMessage);
		} finally {
			setLoading(false);
		}
	};

	const handleSetPassword = async (e: FormEvent) => {
		e.preventDefault();
		setPasswordError(false);
		setConfirmPasswordError(false);

		if (!password || password.length < 6) {
			setPasswordError(true);
			ToastActionCreators.error('Пароль должен быть минимум 6 символов');
			return;
		}

		if (password !== confirmPassword) {
			setConfirmPasswordError(true);
			ToastActionCreators.error('Пароли не совпадают');
			return;
		}

		if (!resetToken) {
			ToastActionCreators.error('Код не подтвержден');
			return;
		}

		setLoading(true);
		try {
			await AuthenticationActionCreators.resetPassword(resetToken, password);
			setStep(4);
			ToastActionCreators.success('Пароль успешно обновлен');
		} catch (err) {
			const error = err as {body?: {message?: string}; message?: string};
			const errorMessage = error.body?.message || error.message || 'Ошибка при сбросе пароля';
			setPasswordError(true);
			setConfirmPasswordError(true);
			ToastActionCreators.error(errorMessage);
		} finally {
			setLoading(false);
		}
	};

	// Step 4: success
	if (step === 4) {
		return (
			<div className="forgot-password-success-content">
				<p className="forgot-password-success-text">
					Пароль для <strong>{email}</strong> успешно обновлен. Можешь войти с новым паролем.
				</p>
				<button type="button" className="auth-switch-btn" onClick={onBack}>
					Вернуться к входу
				</button>
			</div>
		);
	}

	// Step 1: email
	if (step === 1) {
		return (
			<form className="auth-form" onSubmit={handleSendCode}>
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

				<button
					type="submit"
					className={`auth-submit-btn ${email && email.includes('@') ? 'active' : ''}`}
					disabled={loading || !email || !email.includes('@')}
				>
					{loading ? 'Отправка...' : 'Отправить код'}
				</button>
			</form>
		);
	}

	// Step 2: 6-digit code
	if (step === 2) {
		const isCodeComplete = code.every((digit) => digit !== '');

		const handleChange = (index: number, value: string) => {
			if (value && !/^\d$/.test(value)) return;
			const next = [...code];
			next[index] = value;
			setCode(next);
			setCodeError(false);

			if (value && index < 5) {
				codeRefs.current[index + 1]?.focus();
			}
		};

		const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
			if (e.key === 'Backspace' && !code[index] && index > 0) {
				codeRefs.current[index - 1]?.focus();
			}
			if (e.key === 'ArrowRight' && index < 5) {
				codeRefs.current[index + 1]?.focus();
			}
			if (e.key === 'ArrowLeft' && index > 0) {
				codeRefs.current[index - 1]?.focus();
			}
		};

		const handlePaste = (e: React.ClipboardEvent) => {
			e.preventDefault();
			const pasted = e.clipboardData.getData('text').trim();
			if (/^\d{6}$/.test(pasted)) {
				const digits = pasted.split('');
				setCode(digits);
				codeRefs.current[5]?.focus();
			}
		};

		return (
			<form className="auth-form" onSubmit={handleVerifyCode}>
				<div className="verify-code-header">
					<div className="verify-code-icon">
						<img src="/icons/logo_nobg.png" alt="Floodilka" />
					</div>
					<h1>Проверь свою почту</h1>
					<p className="verify-code-description">
						Введи 6-значный код из письма по адресу <strong>{email}</strong>
					</p>
				</div>

				<div className="verify-code-input-container">
					<div className="verify-code-inputs-group">
						{code.slice(0, 3).map((digit, index) => (
							<input
								key={index}
								ref={(el) => {
									codeRefs.current[index] = el;
								}}
								type="text"
								inputMode="numeric"
								maxLength={1}
								value={digit}
								onChange={(e) => handleChange(index, e.target.value)}
								onKeyDown={(e) => handleKeyDown(index, e)}
								onPaste={index === 0 ? handlePaste : undefined}
								disabled={loading}
								className={`verify-code-input ${codeError ? 'input-error' : ''}`}
							/>
						))}
					</div>
					<span className="verify-code-separator">&mdash;</span>
					<div className="verify-code-inputs-group">
						{code.slice(3, 6).map((digit, index) => (
							<input
								key={index + 3}
								ref={(el) => {
									codeRefs.current[index + 3] = el;
								}}
								type="text"
								inputMode="numeric"
								maxLength={1}
								value={digit}
								onChange={(e) => handleChange(index + 3, e.target.value)}
								onKeyDown={(e) => handleKeyDown(index + 3, e)}
								disabled={loading}
								className={`verify-code-input ${codeError ? 'input-error' : ''}`}
							/>
						))}
					</div>
				</div>

				<button
					type="submit"
					className={`auth-submit-btn ${isCodeComplete ? 'active' : ''}`}
					disabled={loading || !isCodeComplete}
				>
					{loading ? 'Проверяем...' : 'Продолжить'}
				</button>
			</form>
		);
	}

	// Step 3: new password
	return (
		<form className="auth-form" onSubmit={handleSetPassword}>
			<div className="form-group">
				<label>Новый пароль</label>
				<input
					type="password"
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
			</div>

			<div className="form-group">
				<label>Повторите пароль</label>
				<input
					type="password"
					placeholder="Повторите пароль"
					value={confirmPassword}
					onChange={(e) => {
						setConfirmPassword(e.target.value);
						setConfirmPasswordError(false);
					}}
					required
					minLength={6}
					disabled={loading}
					className={confirmPasswordError ? 'input-error' : ''}
				/>
			</div>

			<button
				type="submit"
				className={`auth-submit-btn ${
					password && confirmPassword && password === confirmPassword && password.length >= 6 ? 'active' : ''
				}`}
				disabled={loading || !password || !confirmPassword || password !== confirmPassword || password.length < 6}
			>
				{loading ? 'Сохранение...' : 'Сохранить пароль'}
			</button>
		</form>
	);
}
