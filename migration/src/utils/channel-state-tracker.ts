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
