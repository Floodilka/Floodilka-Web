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

import {type FormEvent, useEffect, useRef, useState} from 'react';
import * as AuthenticationActionCreators from '~/actions/AuthenticationActionCreators';
import * as ToastActionCreators from '~/actions/ToastActionCreators';
import type {LoginSuccessPayload} from '~/viewmodels/auth/AuthFlow';

interface VerifyEmailCodeProps {
	email: string;
	username: string;
	ticket: string;
	onVerified: (payload: LoginSuccessPayload) => void;
}

export default function VerifyEmailCode({email, ticket, onVerified}: VerifyEmailCodeProps) {
	const [code, setCode] = useState(['', '', '', '', '', '']);
	const [loading, setLoading] = useState(false);
	const [codeError, setCodeError] = useState(false);
	const [resending, setResending] = useState(false);
	const [countdown, setCountdown] = useState(60);
	const [canResend, setCanResend] = useState(false);
	const codeRefs = useRef<Array<HTMLInputElement | null>>([]);

	useEffect(() => {
		codeRefs.current[0]?.focus();
	}, []);

	useEffect(() => {
		if (countdown > 0) {
			const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
			return () => clearTimeout(timer);
		}
		setCanResend(true);
	}, [countdown]);

	const submitCode = async (codeString: string) => {
		if (loading) return;
		setCodeError(false);
		setLoading(true);
		try {
			const response = await AuthenticationActionCreators.verifyRegistrationCode(ticket, codeString);
			onVerified({
				token: response.token,
				userId: response.user_id,
			});
		} catch (err) {
			const error = err as {body?: {message?: string}; message?: string};
			const errorMessage = error.body?.message || error.message || 'Неверный или истекший код';
			setCodeError(true);
			ToastActionCreators.error(errorMessage);
		} finally {
			setLoading(false);
		}
	};

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault();
		const codeString = code.join('');
		if (codeString.length !== 6) {
			setCodeError(true);
			ToastActionCreators.error('Введите 6-значный код');
			return;
		}
		submitCode(codeString);
	};

	const handleResend = async () => {
		if (!canResend || resending) return;
		setResending(true);
		try {
			await AuthenticationActionCreators.resendRegistrationCode(ticket);
			ToastActionCreators.success('Код отправлен повторно');
			setCountdown(60);
			setCanResend(false);
		} catch {
			ToastActionCreators.error('Не удалось отправить код. Попробуйте позже.');
		} finally {
			setResending(false);
		}
	};

	const handleChange = (index: number, value: string) => {
		if (value && !/^\d$/.test(value)) return;
		const next = [...code];
		next[index] = value;
		setCode(next);
		setCodeError(false);

		if (value && index < 5) {
			codeRefs.current[index + 1]?.focus();
		}

		const codeString = next.join('');
		if (codeString.length === 6) {
			submitCode(codeString);
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
			submitCode(pasted);
		}
	};

	const isCodeComplete = code.every((digit) => digit !== '');

	return (
		<>
			<div className="verify-code-header">
				<div className="verify-code-icon">
					<img src="/icons/logo_nobg.png" alt="Floodilka" />
				</div>
				<h1>Проверь свою почту</h1>
				<p className="verify-code-description">
					Введи 6-значный код из письма по адресу <strong>{email}</strong>
				</p>
			</div>

			<form className="auth-form" onSubmit={handleSubmit}>
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
					{loading ? 'Проверяем...' : 'Подтвердить'}
				</button>
			</form>

			<div className="verify-code-resend">
				{canResend ? (
					<button type="button" onClick={handleResend} disabled={resending} className="verify-code-resend-btn">
						{resending ? 'Отправка...' : 'Отправить код повторно'}
					</button>
				) : (
					<span className="verify-code-timer">Отправить повторно через {countdown} сек</span>
				)}
			</div>
		</>
	);
}
