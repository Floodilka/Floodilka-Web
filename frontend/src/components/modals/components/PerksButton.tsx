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

import {Trans} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import styles from './PerksButton.module.css';

export const PerksButton: React.FC<{
	onClick: () => void;
	onKeyDown: (event: React.KeyboardEvent<HTMLSpanElement>) => void;
}> = observer(({onClick, onKeyDown}) => (
	<span role="link" tabIndex={0} onClick={onClick} onKeyDown={onKeyDown} className={styles.link}>
		<Trans>Premium perks</Trans>
	</span>
));
