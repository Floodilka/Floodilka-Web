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
import {ArrowCounterClockwiseIcon, KeyboardIcon, PencilSimpleIcon, TrashIcon, WarningIcon} from '@phosphor-icons/react';
import clsx from 'clsx';
import React from 'react';
import {Button} from '~/components/uikit/Button/Button';
import {Popout} from '~/components/uikit/Popout/Popout';
import {findConflicts, type KeybindConflict} from '~/lib/KeybindConflict';
import type {KeybindAction, KeyCombo} from '~/stores/KeybindStore';
import {formatKeyCombo} from '~/utils/KeybindUtils';
import styles from './KeybindRecorder.module.css';

interface KeybindRecorderProps {
	action: KeybindAction;
	index?: number;
	value: KeyCombo;
	defaultValue?: KeyCombo | null;
	disabled?: boolean;
	onChange: (combo: KeyCombo) => void;
	onClear?: () => void;
	onReset?: () => void;
	className?: string;
}

const combosEqual = (a: KeyCombo | null | undefined, b: KeyCombo | null | undefined): boolean => {
	if (!a && !b) return true;
	if (!a || !b) return false;
	return (
		a.key === b.key &&
		a.code === b.code &&
		(a.mouseButton ?? null) === (b.mouseButton ?? null) &&
		!!a.ctrlOrMeta === !!b.ctrlOrMeta &&
		!!a.ctrl === !!b.ctrl &&
		!!a.alt === !!b.alt &&
		!!a.shift === !!b.shift &&
		!!a.meta === !!b.meta
	);
};

const isModifierKey = (key: string | undefined | null): boolean => {
	if (!key) return false;
	return key === 'Shift' || key === 'Control' || key === 'Alt' || key === 'Meta';
};

const normalizeKeyForCombo = (key: string): string => {
	if (key === 'Spacebar') return ' ';
	return key;
};

const keyboardEventToCombo = (event: KeyboardEvent): KeyCombo => ({
	key: normalizeKeyForCombo(event.key),
	code: event.code,
	ctrlOrMeta: event.metaKey || event.ctrlKey,
	ctrl: event.ctrlKey,
	alt: event.altKey,
	shift: event.shiftKey,
});

interface KeybindEditorPopoutProps {
	action: KeybindAction;
	index: number;
	value: KeyCombo;
	defaultValue: KeyCombo | null;
	onSave: (combo: KeyCombo) => void;
	onClear?: () => void;
	onReset?: () => void;
	onClose: () => void;
}

const KeybindEditorPopout: React.FC<KeybindEditorPopoutProps> = ({
	action,
	index,
	value,
	defaultValue,
	onSave,
	onClear,
	onReset,
	onClose,
}) => {
	const {t, i18n} = useLingui();
	const [recording, setRecording] = React.useState(false);
	const [previewCombo, setPreviewCombo] = React.useState<KeyCombo | null>(null);

	const currentCombo = previewCombo ?? value;
	const displayValue = formatKeyCombo(currentCombo) || '';
	const defaultDisplayValue = defaultValue ? formatKeyCombo(defaultValue) : null;
	const currentHasValue = !!(currentCombo?.key || currentCombo?.code || currentCombo?.mouseButton);
	const currentIsModified = defaultValue ? !combosEqual(currentCombo, defaultValue) : false;
	const conflicts = React.useMemo<Array<KeybindConflict>>(
		() => (currentHasValue ? findConflicts(currentCombo, action, index) : []),
		[currentCombo, action, index, currentHasValue],
	);

	const cancelRecording = React.useCallback(() => {
		setRecording(false);
		setPreviewCombo(null);
	}, []);

	const finishRecording = React.useCallback((combo: KeyCombo) => {
		setRecording(false);
		setPreviewCombo(combo);
	}, []);

	const startRecording = React.useCallback(() => {
		setPreviewCombo(null);
		setRecording(true);
	}, []);

	React.useEffect(() => {
		if (!recording) return;

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				event.preventDefault();
				event.stopPropagation();
				cancelRecording();
				return;
			}

			event.preventDefault();
			event.stopPropagation();

			const combo = keyboardEventToCombo(event);
			setPreviewCombo(combo);

			if (isModifierKey(event.key)) return;
			if (!combo.key && !combo.code) return;

			const savedCombo = {
				...combo,
				global: value.global,
				enabled: true,
			};
			onSave(savedCombo);
			finishRecording(savedCombo);
		};

		const handleMouseDown = (event: MouseEvent) => {
			const canonical = event.button + 1;
			if (canonical < 4) return;

			event.preventDefault();
			event.stopPropagation();

			const savedCombo: KeyCombo = {
				key: '',
				mouseButton: canonical,
				ctrlOrMeta: event.metaKey || event.ctrlKey,
				ctrl: event.ctrlKey,
				alt: event.altKey,
				shift: event.shiftKey,
				global: value.global,
				enabled: true,
			};
			setPreviewCombo(savedCombo);
			onSave(savedCombo);
			finishRecording(savedCombo);
		};

		window.addEventListener('keydown', handleKeyDown, true);
		window.addEventListener('mousedown', handleMouseDown, true);
		return () => {
			window.removeEventListener('keydown', handleKeyDown, true);
			window.removeEventListener('mousedown', handleMouseDown, true);
		};
	}, [recording, onSave, cancelRecording, finishRecording, value.global]);

	const handleClear = () => {
		setPreviewCombo(null);
		onClear?.();
	};

	const handleReset = () => {
		setPreviewCombo(null);
		onReset?.();
	};

	return (
		<div className={styles.popout}>
			<div className={styles.popoutHeader}>
				<span className={styles.popoutTitle}>
					<Trans>Edit Shortcut</Trans>
				</span>
				<span className={styles.popoutHint}>
					<Trans>Click to record a new shortcut, or press Escape to cancel.</Trans>
				</span>
			</div>

			<div
				className={clsx(styles.recorderBox, recording && styles.recorderBoxRecording)}
				onClick={startRecording}
				onKeyDown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						startRecording();
					}
				}}
				tabIndex={0}
				role="button"
				aria-label={t`Record shortcut`}
			>
				<KeyboardIcon size={20} weight="bold" className={styles.recorderIcon} />
				<span className={styles.recorderText}>
					{recording ? <Trans>Press keys...</Trans> : currentHasValue ? displayValue : <Trans>Click to record</Trans>}
				</span>
			</div>

			{defaultDisplayValue && (
				<div className={styles.defaultRow}>
					<span className={styles.defaultLabel}>
						<Trans>Default:</Trans>
					</span>
					<span className={styles.defaultValue}>{defaultDisplayValue}</span>
				</div>
			)}

			{conflicts.length > 0 && !recording && (
				<div className={styles.conflictRow}>
					<WarningIcon size={16} weight="fill" className={styles.conflictIcon} />
					<div className={styles.conflictMessages}>
						{conflicts.map((conflict, i) => {
							const conflictLabel =
								conflict.kind === 'action' ? conflict.label : i18n._(conflict.label);
							return (
								<span key={i} className={styles.conflictMessage}>
									{conflict.kind === 'action' ? (
										<Trans>Already used by "{conflictLabel}"</Trans>
									) : (
										<Trans>System uses this for "{conflictLabel}"</Trans>
									)}
								</span>
							);
						})}
					</div>
				</div>
			)}

			<div className={styles.popoutActions}>
				<div className={styles.popoutActionsLeft}>
					{onClear && currentHasValue && (
						<Button variant="secondary" small type="button" onClick={handleClear} leftIcon={<TrashIcon size={16} />}>
							<Trans>Clear</Trans>
						</Button>
					)}
					{onReset && currentIsModified && (
						<Button
							variant="secondary"
							small
							type="button"
							onClick={handleReset}
							leftIcon={<ArrowCounterClockwiseIcon size={16} />}
						>
							<Trans>Reset</Trans>
						</Button>
					)}
				</div>
				<Button variant="secondary" small type="button" onClick={onClose}>
					<Trans>Done</Trans>
				</Button>
			</div>
		</div>
	);
};

export const KeybindRecorder: React.FC<KeybindRecorderProps> = ({
	action,
	index = 0,
	value,
	defaultValue = null,
	disabled = false,
	onChange,
	onClear,
	onReset,
	className,
}) => {
	const {t} = useLingui();
	const triggerRef = React.useRef<HTMLButtonElement | null>(null);

	const isEmpty = !value?.key && !value?.code && !value?.mouseButton;
	const hasValue = !isEmpty;
	const displayValue = formatKeyCombo(value) || '';

	return (
		<Popout
			position="bottom"
			offsetMainAxis={8}
			offsetCrossAxis={0}
			returnFocusRef={triggerRef}
			render={({onClose}) => (
				<KeybindEditorPopout
					action={action}
					index={index}
					value={value}
					defaultValue={defaultValue}
					onSave={(combo) => {
						onChange({...combo, global: value.global});
					}}
					onClear={onClear}
					onReset={onReset}
					onClose={onClose}
				/>
			)}
		>
			<button
				ref={triggerRef}
				type="button"
				className={clsx(styles.recorder, hasValue && styles.hasValue, disabled && styles.disabled, className)}
				disabled={disabled}
				aria-label={t`Edit keyboard shortcut for ${action}`}
			>
				<div className={styles.layout}>
					<div className={styles.editIconLeft} aria-hidden>
						<PencilSimpleIcon size={14} weight="bold" />
					</div>
					<div className={styles.inputWrapper}>
						<span className={styles.input}>{hasValue ? displayValue : t`No keybind set`}</span>
					</div>
				</div>
			</button>
		</Popout>
	);
};
