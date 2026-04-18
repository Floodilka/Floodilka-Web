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
import {DownloadSimpleIcon, InfoIcon, PlusIcon} from '@phosphor-icons/react';
import clsx from 'clsx';
import {observer} from 'mobx-react-lite';
import React from 'react';
import * as ModalActionCreators from '~/actions/ModalActionCreators';
import {modal} from '~/actions/ModalActionCreators';
import * as ToastActionCreators from '~/actions/ToastActionCreators';
import {Switch} from '~/components/form/Switch';
import {KeybindRecorder} from '~/components/keybinds/KeybindRecorder';
import {ConfirmModal} from '~/components/modals/ConfirmModal';
import {InputMonitoringCTAModal} from '~/components/modals/InputMonitoringCTAModal';
import {Button} from '~/components/uikit/Button/Button';
import {IS_DEV} from '~/lib/env';
import {findActionConflict} from '~/lib/KeybindConflict';
import KeybindManager from '~/lib/KeybindManager';
import {
	applyKeybindPreset,
	KeybindPresetParseError,
	parseKeybindPreset,
	serializeKeybindPreset,
	stringifyKeybindPreset,
} from '~/lib/KeybindPresets';
import KeybindStore, {
	type ActiveKeybind,
	getDefaultKeybind,
	type KeybindConfig,
	type KeyCombo,
	MAX_COMBOS_PER_ACTION,
} from '~/stores/KeybindStore';
import NativePermissionStore from '~/stores/NativePermissionStore';
import {checkNativePermission} from '~/utils/NativePermissions';
import {isNativeMacOS} from '~/utils/NativeUtils';
import {InputMonitoringSection} from './components/InputMonitoringSection';
import styles from './KeybindsTab.module.css';

const KeybindRow = observer(({entry, isNativeDesktop}: {entry: ActiveKeybind; isNativeDesktop: boolean}) => {
	const {t, i18n} = useLingui();
	const handleToggleGlobal = (value: boolean) => {
		KeybindStore.toggleGlobal(entry.action, value);
		if (value && isNativeMacOS()) {
			void (async () => {
				const status = await checkNativePermission('input-monitoring');
				if (status !== 'granted') {
					ModalActionCreators.push(modal(() => React.createElement(InputMonitoringCTAModal)));
				}
			})();
		}
	};
	const defaultCombo = getDefaultKeybind(entry.action, i18n);
	const downloadUrl = `${window.location.origin}/download`;

	const combos = entry.combos.length > 0 ? entry.combos : [entry.defaultCombo];
	const canAdd = combos.length < MAX_COMBOS_PER_ACTION;
	const primaryGlobal = combos[0]?.global ?? false;
	const hasBoundCombo = combos.some((c) => (c.enabled ?? true) && (c.key || c.code || c.mouseButton));
	const conflictCombo = combos.find((c, i) => (c.enabled ?? true) && findActionConflict(c, entry.action, i));

	const handleChange = (index: number, combo: KeyCombo): void => {
		const existing = combos[index];
		KeybindStore.setKeybindAt(entry.action, index, {...combo, global: existing?.global ?? primaryGlobal});
	};

	const handleClear = (index: number): void => {
		if (combos.length > 1) {
			KeybindStore.removeKeybindAt(entry.action, index);
			return;
		}
		KeybindStore.setKeybindAt(entry.action, index, {
			key: '',
			code: '',
			global: primaryGlobal,
			enabled: false,
		});
	};

	const handleReset = (): void => {
		if (!defaultCombo) return;
		KeybindStore.setKeybinds(entry.action, [{...defaultCombo, global: primaryGlobal}]);
	};

	const handleAdd = (): void => {
		KeybindStore.addKeybind(entry.action, {key: '', code: '', global: primaryGlobal, enabled: false});
	};

	return (
		<div className={`${styles.rowWrapper} ${entry.allowGlobal ? styles.hasFooterWrapper : ''}`}>
			<div className={styles.row}>
				<div className={styles.rowText}>
					<div className={styles.labelRow}>
						<div className={styles.label}>{entry.label}</div>
						{conflictCombo ? (
							<span className={clsx(styles.badge, styles.badgeWarning)}>
								<Trans>Conflict</Trans>
							</span>
						) : !hasBoundCombo ? (
							<span className={clsx(styles.badge, styles.badgeMuted)}>
								<Trans>Not bound</Trans>
							</span>
						) : null}
					</div>
					{entry.description ? <div className={styles.rowDescription}>{entry.description}</div> : null}
				</div>
				<div className={styles.rowControls}>
					<div className={styles.primaryControls}>
						{combos.map((combo, index) => (
							<KeybindRecorder
								key={index}
								action={entry.action}
								index={index}
								value={combo}
								defaultValue={index === 0 ? defaultCombo : null}
								onChange={(next) => handleChange(index, next)}
								onClear={() => handleClear(index)}
								onReset={index === 0 ? handleReset : undefined}
							/>
						))}
						{canAdd ? (
							<Button
								variant="secondary"
								small
								type="button"
								onClick={handleAdd}
								leftIcon={<PlusIcon size={16} weight="bold" />}
								title={t`Add alternative shortcut`}
							>
								<Trans>Add</Trans>
							</Button>
						) : null}
					</div>
				</div>
			</div>

			{entry.allowGlobal ? (
				<div
					className={clsx(styles.globalFooter, isNativeDesktop ? styles.globalFooterDesktop : styles.globalFooterBrand)}
				>
					<div className={styles.globalFooterText}>
						<span className={styles.globalLabel}>
							<Trans>Global shortcut</Trans>
						</span>
						<span className={styles.globalDescription}>
							<Trans>Run this shortcut even when Флудилка is not focused.</Trans>
						</span>
					</div>
					{isNativeDesktop ? (
						<div className={styles.globalFooterControls}>
							<Switch
								value={primaryGlobal}
								onChange={handleToggleGlobal}
								ariaLabel={t`Use this shortcut system-wide`}
							/>
						</div>
					) : (
						<div className={styles.globalFooterControls}>
							<Button
								variant="inverted"
								small
								leftIcon={<DownloadSimpleIcon size={16} weight="fill" />}
								onClick={() => window.open(downloadUrl, '_blank', 'noopener')}
								title={t`Global shortcuts are available in the desktop app`}
							>
								<Trans>Get desktop app</Trans>
							</Button>
						</div>
					)}
				</div>
			) : null}
		</div>
	);
});

const KeybindsTab: React.FC = observer(() => {
	const {t} = useLingui();
	const keybinds = KeybindStore.getAll();
	const categories: Array<{id: KeybindConfig['category']; title: string}> = [
		{id: 'navigation', title: t`Navigation`},
		{id: 'voice', title: t`Voice`},
		{id: 'messaging', title: t`Messaging`},
		{id: 'popouts', title: t`Popouts`},
		{id: 'calls', title: t`Calls`},
		{id: 'system', title: t`System`},
	];

	const [devDesktopOverride, setDevDesktopOverride] = React.useState(false);
	const isNativeDesktop = IS_DEV
		? NativePermissionStore.isDesktop || devDesktopOverride
		: NativePermissionStore.isDesktop;

	React.useEffect(() => {
		KeybindManager.suspend();
		return () => {
			KeybindManager.resume();
		};
	}, []);

	const handleResetToDefaults = () => {
		ModalActionCreators.push(
			modal(() => (
				<ConfirmModal
					title={t`Reset Keyboard Shortcuts`}
					description={t`Are you sure you want to reset all keyboard shortcuts to their default values?`}
					primaryText={t`Reset`}
					primaryVariant="danger-primary"
					onPrimary={() => {
						KeybindStore.resetToDefaults();
					}}
				/>
			)),
		);
	};

	const handleExport = () => {
		const preset = serializeKeybindPreset();
		const json = stringifyKeybindPreset(preset);
		const blob = new Blob([json], {type: 'application/json'});
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'floodilka-keybinds.json';
		document.body.appendChild(a);
		a.click();
		a.remove();
		URL.revokeObjectURL(url);
	};

	const fileInputRef = React.useRef<HTMLInputElement | null>(null);

	const handleImportClick = () => {
		fileInputRef.current?.click();
	};

	const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		event.target.value = '';
		if (!file) return;
		let preset: ReturnType<typeof parseKeybindPreset>;
		try {
			const text = await file.text();
			preset = parseKeybindPreset(text);
		} catch (error) {
			const message = error instanceof KeybindPresetParseError ? error.message : t`Could not read preset file`;
			ToastActionCreators.createToast({type: 'error', children: message});
			return;
		}

		ModalActionCreators.push(
			modal(() => (
				<ConfirmModal
					title={t`Import Keybind Preset`}
					description={t`This will replace all current keyboard shortcuts. Continue?`}
					primaryText={t`Import`}
					primaryVariant="danger-primary"
					onPrimary={() => {
						applyKeybindPreset(preset);
						ToastActionCreators.createToast({type: 'success', children: t`Preset imported`});
					}}
				/>
			)),
		);
	};

	const filteredKeybinds = keybinds.filter((k) => k.action !== 'push_to_talk');

	return (
		<div className={styles.container}>
			<div className={styles.callout}>
				<div className={styles.calloutTitle}>
					<InfoIcon size={18} weight="fill" className={styles.calloutIcon} />
					<Trans>Shortcuts are paused while editing</Trans>
				</div>
			</div>

			<div className={styles.headerRow}>
				<div className={styles.header}>
					<h2 className={styles.title}>
						<Trans>Keyboard Shortcuts</Trans>
					</h2>
					<p className={styles.description}>
						<Trans>Customize keyboard shortcuts for navigation and actions.</Trans>
					</p>
				</div>
				<div className={styles.headerActions}>
					<Button variant="secondary" small={true} type="button" onClick={handleExport}>
						<Trans>Export</Trans>
					</Button>
					<Button variant="secondary" small={true} type="button" onClick={handleImportClick}>
						<Trans>Import</Trans>
					</Button>
					<Button variant="secondary" small={true} type="button" onClick={handleResetToDefaults}>
						<Trans>Reset to defaults</Trans>
					</Button>
					<input
						ref={fileInputRef}
						type="file"
						accept="application/json,.json"
						onChange={handleImportFile}
						style={{display: 'none'}}
					/>
				</div>
			</div>

			{IS_DEV ? (
				<div className={styles.devToggleRow}>
					<div className={styles.devToggle}>
						<Switch value={devDesktopOverride} onChange={setDevDesktopOverride} ariaLabel={t`Mock desktop mode`} />
						<span className={styles.devToggleLabel}>
							<Trans>Mock desktop</Trans>
						</span>
					</div>
				</div>
			) : null}

			<InputMonitoringSection />

			{categories
				.map((category) => ({
					...category,
					entries: filteredKeybinds.filter((k) => k.category === category.id),
				}))
				.filter((c) => c.entries.length > 0)
				.map((category) => (
					<div className={styles.section} key={category.id}>
						<div className={styles.sectionTitle}>{category.title}</div>
						{category.entries.map((entry) => (
							<KeybindRow key={entry.action} entry={entry} isNativeDesktop={isNativeDesktop} />
						))}
					</div>
				))}
		</div>
	);
});

export default KeybindsTab;
