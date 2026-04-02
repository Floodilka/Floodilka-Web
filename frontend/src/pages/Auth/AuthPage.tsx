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

import {observer} from 'mobx-react-lite';
import {useEffect} from 'react';
import AuthModal from '~/components/auth/AuthModal';
import {useSEO} from '~/hooks/useSEO';
import AuthenticationStore from '~/stores/AuthenticationStore';
import * as RouterUtils from '~/utils/RouterUtils';

interface AuthPageProps {
	initialMode?: 'login' | 'register';
}

const AuthPage = observer(function AuthPage({initialMode = 'login'}: AuthPageProps) {
	useSEO({
		title: initialMode === 'login' ? 'Войти — Флудилка' : 'Регистрация — Флудилка',
		description: initialMode === 'login'
			? 'Войдите в свой аккаунт Флудилки — бесплатного голосового чата для геймеров.'
			: 'Создайте аккаунт в Флудилке — бесплатном голосовом мессенджере для геймеров. Альтернатива Discord в России.',
		canonicalPath: initialMode === 'login' ? '/login' : '/register',
		noindex: true,
	});

	useEffect(() => {
		if (AuthenticationStore.isAuthenticated) {
			const qp = new URLSearchParams(window.location.search);
			const redirectTo = qp.get('redirect_to');
			const safeRedirect = redirectTo && !redirectTo.startsWith('/login') && !redirectTo.startsWith('/register') ? redirectTo : '/channels/@me';
			RouterUtils.replaceWith(safeRedirect);
		}
	}, []);

	if (AuthenticationStore.isAuthenticated) {
		return null;
	}

	return <AuthModal initialMode={initialMode} />;
});

export default AuthPage;
