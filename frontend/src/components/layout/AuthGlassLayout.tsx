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

import {I18nProvider} from '@lingui/react';
import {observer} from 'mobx-react-lite';
import {type ReactNode, useEffect, useState} from 'react';
import {useSetLayoutVariant} from '~/contexts/LayoutVariantContext';
import i18n, {initI18n} from '~/i18n';

export const AuthGlassLayout = observer(function AuthGlassLayout({children}: {children?: ReactNode}) {
	const [isI18nInitialized, setIsI18nInitialized] = useState(false);
	const setLayoutVariant = useSetLayoutVariant();

	useEffect(() => {
		setLayoutVariant('auth');
		return () => {
			setLayoutVariant('app');
		};
	}, [setLayoutVariant]);

	useEffect(() => {
		initI18n().then(() => {
			setIsI18nInitialized(true);
		});
	}, []);

	useEffect(() => {
		document.documentElement.classList.add('auth-page');
		return () => {
			document.documentElement.classList.remove('auth-page');
		};
	}, []);

	if (!isI18nInitialized) {
		return null;
	}

	return (
		<I18nProvider i18n={i18n}>
			<div className="auth-glass-page">{children}</div>
		</I18nProvider>
	);
});
