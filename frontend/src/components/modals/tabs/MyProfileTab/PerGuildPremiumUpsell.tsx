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
import {PremiumUpsell} from '~/components/uikit/PremiumUpsell/PremiumUpsell';

export const PerGuildPremiumUpsell = observer(() => {
	return (
		<PremiumUpsell>
			<Trans>
				Customizing your avatar, banner, and bio for individual communities requires Premium. Community nickname is free
				for everyone.
			</Trans>
		</PremiumUpsell>
	);
});
