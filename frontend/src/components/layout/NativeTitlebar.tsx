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

import {CopySimple, Minus, Square, X} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import React from 'react';
import {getElectronAPI, type NativePlatform} from '~/utils/NativeUtils';
import styles from './NativeTitlebar.module.css';

interface NativeTitlebarProps {
	platform: NativePlatform;
}

export const NativeTitlebar: React.FC<NativeTitlebarProps> = ({platform}) => {
	const [isMaximized, setIsMaximized] = React.useState(false);

	React.useEffect(() => {
		const electronApi = getElectronAPI();
		if (!electronApi) return;

		const unsubscribe = electronApi.onWindowMaximizeChange((maximized: boolean) => {
			setIsMaximized(maximized);
		});

		return () => {
			unsubscribe();
		};
	}, []);

	const handleMinimize = () => {
		const electronApi = getElectronAPI();
		electronApi?.windowMinimize();
	};

	const handleToggleMaximize = () => {
		const electronApi = getElectronAPI();
		if (!electronApi) return;

		electronApi.windowMaximize();
	};

	const handleClose = () => {
		const electronApi = getElectronAPI();
		electronApi?.windowClose();
	};

	const handleDoubleClick = () => {
		handleToggleMaximize();
	};

	return (
		<div className={styles.controls}>
			<button type="button" className={styles.controlButton} onClick={handleMinimize} aria-label="Minimize window">
				<Minus weight="bold" />
			</button>
			<button
				type="button"
				className={styles.controlButton}
				onClick={handleToggleMaximize}
				aria-label={isMaximized ? 'Restore window' : 'Maximize window'}
			>
				{isMaximized ? <CopySimple weight="bold" /> : <Square weight="bold" />}
			</button>
			<button
				type="button"
				className={clsx(styles.controlButton, styles.closeButton)}
				onClick={handleClose}
				aria-label="Close window"
			>
				<X weight="bold" />
			</button>
		</div>
	);
};
