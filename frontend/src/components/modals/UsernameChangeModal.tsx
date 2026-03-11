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

import {Trans, useLingui} from '@lingui/react/macro';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import React from 'react';
import {Controller, useForm} from 'react-hook-form';
import * as ModalActionCreators from '~/actions/ModalActionCreators';
import * as ToastActionCreators from '~/actions/ToastActionCreators';
import * as UserActionCreators from '~/actions/UserActionCreators';
import {Form} from '~/components/form/Form';
import {Input} from '~/components/form/Input';
import {UsernameValidationRules} from '~/components/form/UsernameValidationRules';
import confirmStyles from '~/components/modals/ConfirmModal.module.css';
import * as Modal from '~/components/modals/Modal';
import {Button} from '~/components/uikit/Button/Button';
import {useFormSubmit} from '~/hooks/useFormSubmit';
import UserStore from '~/stores/UserStore';
import styles from './UsernameChangeModal.module.css';

interface FormInputs {
	username: string;
}

export const UsernameChangeModal = observer(() => {
	const {t} = useLingui();
	const user = UserStore.getCurrentUser()!;
	const usernameRef = React.useRef<HTMLInputElement>(null);

	const form = useForm<FormInputs>({
		defaultValues: {
			username: user.username,
		},
	});

	const onSubmit = React.useCallback(
		async (data: FormInputs) => {
			const usernameValue = data.username.trim();
			await UserActionCreators.update({username: usernameValue});
			ModalActionCreators.pop();
			ToastActionCreators.createToast({type: 'success', children: t`Username updated`});
		},
		[t],
	);

	const {handleSubmit, isSubmitting} = useFormSubmit({
		form,
		onSubmit,
		defaultErrorField: 'username',
	});

	return (
		<Modal.Root size="small" centered initialFocusRef={usernameRef}>
			<Form form={form} onSubmit={handleSubmit} aria-label={t`Change username form`}>
				<Modal.Header title={t`Change your username`} />
				<Modal.Content className={confirmStyles.content}>
					<p className={clsx(styles.description, confirmStyles.descriptionText)}>
						<Trans>
							Usernames can only contain lowercase letters (a-z), numbers (0-9), and dots (.). Consecutive
							dots are not allowed.
						</Trans>
					</p>
					<div className={styles.usernameContainer}>
						<span className={styles.usernameLabel}>{t`Username`}</span>
						<Controller
							name="username"
							control={form.control}
							render={({field}) => (
								<Input
									{...field}
									ref={usernameRef}
									autoComplete="username"
									aria-label={t`Username`}
									placeholder={t`marty.mcfly`}
									required={true}
									type="text"
								/>
							)}
						/>
						{form.formState.errors.username && (
							<span className={styles.errorMessage}>{form.formState.errors.username.message}</span>
						)}
						<div className={styles.validationBox}>
							<UsernameValidationRules username={form.watch('username')} />
						</div>
					</div>
				</Modal.Content>
				<Modal.Footer>
					<Button onClick={ModalActionCreators.pop} variant="secondary">
						<Trans>Cancel</Trans>
					</Button>
					<Button type="submit" submitting={isSubmitting}>
						<Trans>Continue</Trans>
					</Button>
				</Modal.Footer>
			</Form>
		</Modal.Root>
	);
});
