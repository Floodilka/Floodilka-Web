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

import type {TrackReferenceOrPlaceholder} from '@livekit/components-react';
import {isTrackReference, ParticipantContext, TrackRefContext} from '@livekit/components-react';
import type React from 'react';

interface VoiceGridLayoutProps {
	tracks: Array<TrackReferenceOrPlaceholder>;
	children: React.ReactElement;
	horizontal?: boolean;
}

export function VoiceGridLayout({tracks, children, horizontal}: VoiceGridLayoutProps) {
	return (
		<div className={horizontal ? 'voice-grid voice-grid--horizontal' : 'voice-grid'}>
			{tracks.map((trackRef, index) => {
				const key = isTrackReference(trackRef)
					? `${trackRef.participant.identity}-${trackRef.source}`
					: `placeholder-${trackRef.participant.identity}-${index}`;

				return (
					<TrackRefContext.Provider key={key} value={trackRef}>
						<ParticipantContext.Provider value={trackRef.participant}>{children}</ParticipantContext.Provider>
					</TrackRefContext.Provider>
				);
			})}
		</div>
	);
}
