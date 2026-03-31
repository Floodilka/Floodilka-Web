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

import type {MessageEmbedResponse} from '~/channel/EmbedTypes';
import {BaseResolver} from '~/unfurler/resolvers/BaseResolver';
import {buildEmbedMediaPayload} from '~/unfurler/resolvers/media/MediaMetadataHelpers';

export class ImageResolver extends BaseResolver {
	match(_url: URL, mimeType: string, _content: Uint8Array): boolean {
		return mimeType.startsWith('image/');
	}

	async resolve(url: URL, content: Uint8Array, isNSFWAllowed: boolean = false): Promise<Array<MessageEmbedResponse>> {
		const metadata = await this.mediaService.getMetadata({
			type: 'base64',
			base64: Buffer.from(content).toString('base64'),
			isNSFWAllowed,
		});
		const embed: MessageEmbedResponse = {
			type: 'image',
			url: url.href,
			thumbnail: buildEmbedMediaPayload(url.href, metadata),
		};
		return [embed];
	}
}
