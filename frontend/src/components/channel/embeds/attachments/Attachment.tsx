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

import {observer} from 'mobx-react-lite';
import type {FC} from 'react';
import {MessageAttachmentFlags} from '~/Constants';
import {AttachmentFile} from '~/components/channel/embeds/attachments/AttachmentFile';
import EmbedAudio from '~/components/channel/embeds/media/EmbedAudio';
import {EmbedGif} from '~/components/channel/embeds/media/EmbedGifv';
import {EmbedImage} from '~/components/channel/embeds/media/EmbedImage';
import EmbedVideo from '~/components/channel/embeds/media/EmbedVideo';
import {MessageUploadProgress} from '~/components/channel/MessageUploadProgress';
import {SpoilerOverlay} from '~/components/common/SpoilerOverlay';
import FocusRing from '~/components/uikit/FocusRing/FocusRing';
import type {MessageAttachment, MessageRecord} from '~/records/MessageRecord';
import UserSettingsStore from '~/stores/UserSettingsStore';
import messageStyles from '~/styles/Message.module.css';
import {createCalculator} from '~/utils/DimensionUtils';
import {getAttachmentMediaDimensions} from '~/utils/MediaDimensionConfig';
import {buildMediaProxyURL} from '~/utils/MediaProxyUtils';
import {useSpoilerState} from '~/utils/SpoilerUtils';
import styles from './Attachment.module.css';

interface AttachmentProps {
	attachment: MessageAttachment;
	isPreview?: boolean;
	message?: MessageRecord;
	renderInMosaic?: boolean;
	mediaAttachments?: ReadonlyArray<MessageAttachment>;
}

interface AttachmentMediaProps {
	attachment: MessageAttachment;
	mediaAttachments?: ReadonlyArray<MessageAttachment>;
}

const isImageType = (contentType?: string): boolean => contentType?.startsWith('image/') ?? false;
const isVideoType = (contentType?: string): boolean => contentType?.startsWith('video/') ?? false;
const isAudioType = (contentType?: string): boolean => contentType?.startsWith('audio/') ?? false;
const isGifType = (contentType?: string): boolean => contentType === 'image/gif';

const isAnimated = (flags: number): boolean => (flags & MessageAttachmentFlags.IS_ANIMATED) !== 0;

const isUploading = (flags: number): boolean => (flags & 0x1000) !== 0;

const hasValidDimensions = (attachment: MessageAttachment): boolean =>
	typeof attachment.width === 'number' && typeof attachment.height === 'number';

const AnimatedAttachment: FC<AttachmentMediaProps & {message?: MessageRecord; isPreview?: boolean}> = observer(
	({attachment, message, isPreview}) => {
		const embedUrl = attachment.url ?? '';
		const proxyUrl = attachment.proxy_url ?? embedUrl;
		const animatedProxyURL = buildMediaProxyURL(proxyUrl, {
			animated: true,
		});
		const nsfw = attachment.nsfw || (attachment.flags & MessageAttachmentFlags.CONTAINS_EXPLICIT_MEDIA) !== 0;

		return (
			<FocusRing within ringClassName={messageStyles.mediaFocusRing}>
				<EmbedGif
					embedURL={embedUrl}
					proxyURL={animatedProxyURL}
					naturalWidth={attachment.width!}
					naturalHeight={attachment.height!}
					placeholder={attachment.placeholder}
					nsfw={nsfw}
					channelId={message?.channelId}
					messageId={message?.id}
					attachmentId={attachment.id}
					message={message}
					contentHash={attachment.content_hash}
					isPreview={isPreview}
				/>
			</FocusRing>
		);
	},
);

const VideoAttachment: FC<AttachmentMediaProps & {message?: MessageRecord; isPreview?: boolean}> = observer(
	({attachment, message, mediaAttachments = [], isPreview}) => {
		const embedUrl = attachment.url ?? '';
		const proxyUrl = attachment.proxy_url ?? embedUrl;
		const nsfw = attachment.nsfw || (attachment.flags & MessageAttachmentFlags.CONTAINS_EXPLICIT_MEDIA) !== 0;
		const attachmentDimensions = getAttachmentMediaDimensions(message);
		const mediaCalculator = createCalculator({
			maxWidth: attachmentDimensions.maxWidth,
			maxHeight: attachmentDimensions.maxHeight,
			responsive: true,
		});

		const {dimensions} = mediaCalculator.calculate(
			{
				width: attachment.width!,
				height: attachment.height!,
			},
			{forceScale: true},
		);

		return (
			<FocusRing within ringClassName={messageStyles.mediaFocusRing}>
				<div className={styles.attachmentWrapper}>
					<EmbedVideo
						src={proxyUrl}
						width={dimensions.width}
						height={dimensions.height}
						placeholder={attachment.placeholder}
						title={attachment.title}
						duration={attachment.duration}
						nsfw={nsfw}
						channelId={message?.channelId}
						messageId={message?.id}
						attachmentId={attachment.id}
						embedUrl={embedUrl}
						message={message}
						contentHash={attachment.content_hash}
						mediaAttachments={mediaAttachments}
						isPreview={isPreview}
					/>
				</div>
			</FocusRing>
		);
	},
);

const AudioAttachment: FC<AttachmentMediaProps & {message?: MessageRecord; isPreview?: boolean}> = observer(
	({attachment, message, isPreview}) => (
		<FocusRing within ringClassName={messageStyles.mediaFocusRing}>
			<div className={styles.attachmentWrapper}>
				<EmbedAudio
					src={attachment.proxy_url ?? attachment.url ?? ''}
					title={attachment.title || attachment.filename}
					duration={attachment.duration}
					embedUrl={attachment.url ?? ''}
					channelId={message?.channelId}
					messageId={message?.id}
					attachmentId={attachment.id}
					message={message}
					contentHash={attachment.content_hash}
					isPreview={isPreview}
				/>
			</div>
		</FocusRing>
	),
);

const AttachmentMedia: FC<AttachmentMediaProps & {message?: MessageRecord; isPreview?: boolean}> = observer(
	({attachment, message, mediaAttachments = [], isPreview}) => {
		const nsfw = attachment.nsfw || (attachment.flags & MessageAttachmentFlags.CONTAINS_EXPLICIT_MEDIA) !== 0;
		if (isAnimated(attachment.flags) || isGifType(attachment.content_type)) {
			return <AnimatedAttachment attachment={attachment} message={message} isPreview={isPreview} />;
		}

		const attachmentDimensions = getAttachmentMediaDimensions(message);
		const mediaCalculator = createCalculator({
			maxWidth: attachmentDimensions.maxWidth,
			maxHeight: attachmentDimensions.maxHeight,
			responsive: true,
		});

		const {dimensions} = mediaCalculator.calculate(
			{
				width: attachment.width!,
				height: attachment.height!,
			},
			{forceScale: true},
		);

		const targetWidth = Math.round(dimensions.width * 2);
		const targetHeight = Math.round(dimensions.height * 2);
		const proxySrc = attachment.proxy_url ?? attachment.url ?? '';
		const optimizedSrc = buildMediaProxyURL(proxySrc, {
			format: 'webp',
			width: targetWidth,
			height: targetHeight,
		});

		return (
			<FocusRing within ringClassName={messageStyles.mediaFocusRing}>
				<div className={styles.attachmentWrapper}>
					<EmbedImage
						src={optimizedSrc}
						originalSrc={attachment.url ?? ''}
						naturalWidth={attachment.width!}
						naturalHeight={attachment.height!}
						width={dimensions.width}
						height={dimensions.height}
						placeholder={attachment.placeholder}
						constrain={true}
						alt={attachment.title || attachment.description}
						nsfw={nsfw}
						channelId={message?.channelId}
						messageId={message?.id}
						attachmentId={attachment.id}
						message={message}
						contentHash={attachment.content_hash}
						mediaAttachments={mediaAttachments}
						isPreview={isPreview}
					/>
				</div>
			</FocusRing>
		);
	},
);

export const Attachment: FC<AttachmentProps> = observer(({attachment, isPreview, message, renderInMosaic}) => {
	const isSpoiler = (attachment.flags & MessageAttachmentFlags.IS_SPOILER) !== 0;
	const {hidden: spoilerHidden, reveal: revealSpoiler} = useSpoilerState(isSpoiler, message?.channelId);

	const wrapSpoiler = (node: React.ReactElement) =>
		isSpoiler ? (
			<SpoilerOverlay hidden={spoilerHidden} onReveal={revealSpoiler}>
				{node}
			</SpoilerOverlay>
		) : (
			node
		);

	if (isUploading(attachment.flags) && message) {
		return wrapSpoiler(<MessageUploadProgress attachment={attachment} message={message} />);
	}

	const att = attachment;
	const enrichedAttachment = {
		...att,
		url: att.url ?? null,
		proxy_url: att.proxy_url ?? att.url ?? null,
	};

	if (!att.url) {
		return wrapSpoiler(<AttachmentFile attachment={enrichedAttachment} isPreview={isPreview} message={message} />);
	}

	const inlineAttachmentMedia = UserSettingsStore.getInlineAttachmentMedia();

	if (
		renderInMosaic &&
		hasValidDimensions(att) &&
		(isImageType(att.content_type) || isVideoType(att.content_type) || isAudioType(att.content_type))
	) {
		return null;
	}

	if (!inlineAttachmentMedia && (isImageType(att.content_type) || isVideoType(att.content_type))) {
		return wrapSpoiler(
			<FocusRing within ringClassName={messageStyles.mediaFocusRing}>
				<AttachmentFile attachment={enrichedAttachment} isPreview={isPreview} message={message} />
			</FocusRing>,
		);
	}

	if (isAudioType(att.content_type)) {
		return wrapSpoiler(<AudioAttachment attachment={enrichedAttachment} message={message} isPreview={isPreview} />);
	}

	if (!hasValidDimensions(att)) {
		return wrapSpoiler(
			<FocusRing within ringClassName={messageStyles.mediaFocusRing}>
				<AttachmentFile attachment={enrichedAttachment} isPreview={isPreview} message={message} />
			</FocusRing>,
		);
	}

	if (isImageType(att.content_type)) {
		return wrapSpoiler(
			<AttachmentMedia attachment={enrichedAttachment} message={message} isPreview={isPreview} />,
		);
	}

	if (isVideoType(att.content_type)) {
		return wrapSpoiler(
			<VideoAttachment attachment={enrichedAttachment} message={message} isPreview={isPreview} />,
		);
	}

	return wrapSpoiler(
		<FocusRing within ringClassName={messageStyles.mediaFocusRing}>
			<AttachmentFile attachment={att} isPreview={isPreview} message={message} />
		</FocusRing>,
	);
});
