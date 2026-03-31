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

import {useLingui} from '@lingui/react/macro';
import clsx from 'clsx';
import type {FC} from 'react';
import {getFormattedShortDate} from '~/utils/DateUtils';
import styles from './ExpiryFootnote.module.css';

export interface ExpiryFootnoteProps {
	expiresAt: Date | null;
	isExpired: boolean;
	label?: string;
	className?: string;
	inline?: boolean;
}

export const ExpiryFootnote: FC<ExpiryFootnoteProps> = ({expiresAt, isExpired, label, className, inline = false}) => {
	const {t} = useLingui();
	let resolved = label;
	if (!resolved) {
		if (expiresAt) {
			const date = getFormattedShortDate(expiresAt);
			resolved = isExpired ? t`Expired on ${date}` : t`Expires on ${date}`;
		} else {
			return null;
		}
	}

	return (
		<span className={clsx(inline ? styles.inlineFootnote : styles.footnote, className)}>
			{resolved}
		</span>
	);
};
