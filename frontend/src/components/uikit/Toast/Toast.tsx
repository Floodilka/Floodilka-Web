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

import {motion} from 'framer-motion';
import {observer} from 'mobx-react-lite';
import {useCallback, useEffect} from 'react';
import type {ToastPropsExtended} from '~/components/uikit/Toast';
import styles from './Toast.module.css';

const MINIMUM_TIMEOUT = 1500;

const typeClassMap: Record<string, string> = {
	error: styles.toastError,
	success: styles.toastSuccess,
	info: styles.toastInfo,
};

export const Toast = observer(
	({id, type, children, timeout = 3000, onClick, onTimeout, onClose, closeToast}: ToastPropsExtended) => {
		useEffect(() => {
			const finalTimeout = Math.max(timeout, MINIMUM_TIMEOUT);
			const timer = setTimeout(() => {
				if (onTimeout) onTimeout();
				else closeToast(id);
			}, finalTimeout);
			return () => clearTimeout(timer);
		}, [timeout, onTimeout, closeToast, id]);

		useEffect(() => {
			return () => {
				if (onClose) onClose();
			};
		}, [onClose]);

		const handleClick = useCallback(
			(event: React.MouseEvent) => {
				if (onClick) onClick(event);
				else closeToast(id);
			},
			[onClick, closeToast, id],
		);

		const handleClose = useCallback(
			(event: React.MouseEvent) => {
				event.stopPropagation();
				closeToast(id);
			},
			[closeToast, id],
		);

		return (
			<motion.div
				onClick={handleClick}
				className={`${styles.toast} ${typeClassMap[type ?? 'error'] ?? styles.toastError}`}
				initial={{opacity: 0, y: -100}}
				animate={{opacity: 1, y: 0}}
				exit={{opacity: 0, y: -100}}
				transition={{
					duration: 0.3,
					ease: 'easeOut',
				}}
			>
				<span className={styles.message}>{children}</span>
				<button
					type="button"
					className={styles.closeBtn}
					onClick={handleClose}
					aria-label="Закрыть"
				>
					&times;
				</button>
			</motion.div>
		);
	},
);
