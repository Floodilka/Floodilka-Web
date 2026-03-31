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
import {DateOfBirthField} from '~/components/auth/DateOfBirthField';
import {Routes} from '~/Routes';

interface RegisterProps {
	onSwitchToLogin: () => void;
	onVerificationRequired: (data: {email: string; username: string; ticket: string}) => void;
}

export default function Register({onSwitchToLogin, onVerificationRequired}: RegisterProps) {
	const [username, setUsername] = useState('');
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [loading, setLoading] = useState(false);
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);
	const [emailError, setEmailError] = useState(false);
	const [dobError, setDobError] = useState(false);

	// DOB state
	const [dobMonth, setDobMonth] = useState('');
	const [dobDay, setDobDay] = useState('');
	const [dobYear, setDobYear] = useState('');

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setEmailError(false);
		setDobError(false);

		const usernameRegex = /^[a-zA-Z0-9.]+$/;
		if (!usernameRegex.test(username)) {
			ToastActionCreators.error('Имя пользователя может содержать только английские буквы, цифры и точку');
			setLoading(false);
			return;
		}

		if (/\.{2,}/.test(username)) {
			ToastActionCreators.error('Имя пользователя не может содержать две или более точек подряд');
			setLoading(false);
			return;
		}

		if (username.length < 3) {
			ToastActionCreators.error('Имя пользователя должно содержать минимум 3 символа');
			setLoading(false);
			return;
		}

		if (!email) {
			ToastActionCreators.error('Введите email');
			setEmailError(true);
			setLoading(false);
			return;
		}

		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email)) {
			ToastActionCreators.error('Введите корректный email');
			setEmailError(true);
			setLoading(false);
			return;
		}

		if (password !== confirmPassword) {
			ToastActionCreators.error('Пароли не совпадают');
			setLoading(false);
			return;
		}

		if (password.length < 8) {
			ToastActionCreators.error('Пароль должен быть минимум 8 символов');
			setLoading(false);
			return;
		}

		if (!dobMonth || !dobDay || !dobYear) {
			ToastActionCreators.error('Укажите дату рождения');
			setLoading(false);
			return;
		}

		const dateOfBirth = `${dobYear}-${dobMonth.padStart(2, '0')}-${dobDay.padStart(2, '0')}`;

		try {
			const response = await AuthenticationActionCreators.register({
				username,
				email,
				password,
				date_of_birth: dateOfBirth,
				consent: true,
			});

			onVerificationRequired({email, username, ticket: response.ticket});
		} catch (err) {
			const error = err as {body?: {message?: string; errors?: Array<{path: string; message: string}>}; message?: string};
			let errorMessage = 'Ошибка при регистрации';
			if (error.body?.errors?.length) {
				errorMessage = [...new Set(error.body.errors.map((e) => e.message))].join(', ');
				const errorPaths = new Set(error.body.errors.map((e) => e.path));
				if (errorPaths.has('date_of_birth')) {
					setDobError(true);
				}
				if (errorPaths.has('email')) {
					setEmailError(true);
				}
			} else if (error.body?.message && error.body.message !== 'Input Validation Error') {
				errorMessage = error.body.message;
			}
			ToastActionCreators.error(errorMessage);
		} finally {
			setLoading(false);
		}
	};

	const isDobComplete = dobMonth !== '' && dobDay !== '' && dobYear !== '';
	const isEmailValid = email.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
	const isFormValid = username.length >= 3 && isEmailValid && password.length >= 8 && password === confirmPassword && isDobComplete;

	return (
		<>
			<form className="auth-form" onSubmit={handleSubmit}>
				<div className="form-group">
					<label>Никнейм</label>
					<input
						type="text"
						placeholder="Придумай никнейм"
						value={username}
						onChange={(e) => {
							const value = e.target.value;
							if (value === '' || /^[a-zA-Z0-9.]*$/.test(value)) {
								setUsername(value.toLowerCase());
							}
						}}
						required
						minLength={3}
						maxLength={20}
						disabled={loading}
						autoFocus
					/>
				</div>

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
							onChange={(e) => setPassword(e.target.value)}
							required
							minLength={8}
							disabled={loading}
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

				<div className="form-group">
					<label>Повторите пароль</label>
					<div className="password-input-wrapper">
						<input
							type={showConfirmPassword ? 'text' : 'password'}
							placeholder="Повторить пароль"
							value={confirmPassword}
							onChange={(e) => setConfirmPassword(e.target.value)}
							required
							minLength={8}
							disabled={loading}
						/>
						<button
							type="button"
							className="password-toggle-btn"
							onClick={() => setShowConfirmPassword(!showConfirmPassword)}
							tabIndex={-1}
						>
							<img
								src={showConfirmPassword ? '/icons/eye.png' : '/icons/eye_closed.png'}
								alt={showConfirmPassword ? 'Скрыть пароль' : 'Показать пароль'}
								className="password-toggle-icon"
							/>
						</button>
					</div>
				</div>

				<div className="dob-container">
					<DateOfBirthField
						selectedMonth={dobMonth}
						selectedDay={dobDay}
						selectedYear={dobYear}
						onMonthChange={(v) => { setDobMonth(v); setDobError(false); }}
						onDayChange={(v) => { setDobDay(v); setDobError(false); }}
						onYearChange={(v) => { setDobYear(v); setDobError(false); }}
						error={dobError}
					/>
				</div>

				<button
					type="submit"
					className={`auth-submit-btn ${isFormValid ? 'active' : ''}`}
					disabled={loading || !isFormValid}
				>
					{loading ? 'Регистрация...' : 'Создать аккаунт'}
				</button>
			</form>

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
