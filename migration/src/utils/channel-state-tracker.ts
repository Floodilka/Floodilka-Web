/*
 * Copyright (C) 2020-2026 Fluxer Contributors
 * Copyright (C) 2026 Floodilka Contributors
 *
 * This file is part of Floodilka, a fork of Fluxer
 * (https://github.com/fluxerapp/fluxer).
 * Modified by Floodilka Contributors starting March 2026.
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

import {bucketFromSnowflake} from './snowflake.js';

interface ChannelInfo {
	buckets: Set<number>;
	lastMessageId: bigint;
	lastMessageBucket: number;
	createdBucket: number;
}

const channels = new Map<bigint, ChannelInfo>();

export function trackMessage(channelId: bigint, messageId: bigint, bucket: number) {
	let info = channels.get(channelId);
	if (!info) {
		info = {
			buckets: new Set([bucket]),
			lastMessageId: messageId,
			lastMessageBucket: bucket,
			createdBucket: bucket,
		};
		channels.set(channelId, info);
	} else {
		info.buckets.add(bucket);
		if (messageId > info.lastMessageId) {
			info.lastMessageId = messageId;
			info.lastMessageBucket = bucket;
		}
		if (bucket < info.createdBucket) {
			info.createdBucket = bucket;
		}
	}
}

export function getTrackedChannels() {
	return channels;
}
