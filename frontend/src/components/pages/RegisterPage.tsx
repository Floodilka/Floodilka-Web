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

import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {AuthBottomLink} from '~/components/auth/AuthBottomLink';
import sharedStyles from '~/components/auth/AuthPageStyles.module.css';
import {AuthRegisterFormCore} from '~/components/auth/AuthRegisterFormCore';
import {useDocumentTitle} from '~/hooks/useDocumentTitle';
import {useLocation} from '~/lib/router';

const RegisterPageContent = observer(function RegisterPageContent() {
	const location = useLocation();
	const params = new URLSearchParams(location.search);
	const rawRedirect = params.get('redirect_to');
	const redirectTo = rawRedirect || '/';

	return (
		<>
			<h1 className={sharedStyles.title}>
				<Trans>Create an account</Trans>
			</h1>

			<div className={sharedStyles.container}>
				<AuthRegisterFormCore
					fields={{
						showEmail: true,
						showPassword: true,
						showUsernameValidation: true,
					}}
					submitLabel={<Trans>Create account</Trans>}
					redirectPath={redirectTo}
				/>

				<AuthBottomLink
					variant="login"
					to={`/login${rawRedirect ? `?redirect_to=${encodeURIComponent(rawRedirect)}` : ''}`}
				/>
			</div>
		</>
	);
});

const RegisterPage = observer(function RegisterPage() {
	const {t} = useLingui();
	useDocumentTitle(t`Register`);

	return <RegisterPageContent />;
});

export default RegisterPage;
