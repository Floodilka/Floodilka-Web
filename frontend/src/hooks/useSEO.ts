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

import {useEffect} from 'react';
import {trackPageView} from '~/utils/yandexMetrika';

interface SEOConfig {
	title: string;
	description: string;
	keywords?: string;
	canonicalPath?: string;
	ogType?: string;
	ogImage?: string;
	noindex?: boolean;
}

const SITE_URL = 'https://floodilka.com';
const DEFAULT_OG_IMAGE = `${SITE_URL}/icons/og-image-default.png`;

const setMetaTag = (attribute: string, key: string, content: string) => {
	let element = document.querySelector(`meta[${attribute}="${key}"]`) as HTMLMetaElement | null;
	if (!element) {
		element = document.createElement('meta');
		element.setAttribute(attribute, key);
		document.head.appendChild(element);
	}
	element.setAttribute('content', content);
};

const setCanonical = (url: string) => {
	let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
	if (!link) {
		link = document.createElement('link');
		link.setAttribute('rel', 'canonical');
		document.head.appendChild(link);
	}
	link.setAttribute('href', url);
};

export const useSEO = (config: SEOConfig) => {
	useEffect(() => {
		const {title, description, keywords, canonicalPath, ogType, ogImage, noindex} = config;

		// Title
		document.title = title;

		// Standard meta
		setMetaTag('name', 'description', description);
		if (keywords) {
			setMetaTag('name', 'keywords', keywords);
		}

		// Robots
		if (noindex) {
			setMetaTag('name', 'robots', 'noindex, nofollow');
		} else {
			const existing = document.querySelector('meta[name="robots"]');
			if (existing) {
				existing.remove();
			}
		}

		// Canonical
		const canonicalUrl = canonicalPath ? `${SITE_URL}${canonicalPath}` : SITE_URL;
		setCanonical(canonicalUrl);

		// Open Graph
		setMetaTag('property', 'og:title', title);
		setMetaTag('property', 'og:description', description);
		setMetaTag('property', 'og:url', canonicalUrl);
		setMetaTag('property', 'og:type', ogType ?? 'website');
		setMetaTag('property', 'og:image', ogImage ?? DEFAULT_OG_IMAGE);

		// Twitter Card
		setMetaTag('name', 'twitter:title', title);
		setMetaTag('name', 'twitter:description', description);
		setMetaTag('name', 'twitter:image', ogImage ?? DEFAULT_OG_IMAGE);

		// Analytics
		trackPageView(canonicalUrl, title);
	}, [config.title, config.description, config.keywords, config.canonicalPath, config.ogType, config.ogImage, config.noindex]);
};
