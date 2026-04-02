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

import {NotFoundPage} from '~/components/pages/NotFoundPage';
import {createRootRoute, createRoute} from '~/lib/router';
import {DownloadPage} from '~/pages/Download/DownloadPage';
import {DownloadRedirect} from '~/pages/Download/DownloadRedirect';
import {LandingPage} from '~/pages/Landing/LandingPage';
import FAQPage from '~/pages/Legal/FAQPage';
import GuidelinesPage from '~/pages/Legal/GuidelinesPage';
import PrivacyPage from '~/pages/Legal/PrivacyPage';
import SupportPage from '~/pages/Legal/SupportPage';
import TermsPage from '~/pages/Legal/TermsPage';
import {RootComponent} from '~/router/components/RootComponent';

export const rootRoute = createRootRoute({
	layout: ({children}) => <RootComponent>{children}</RootComponent>,
});

export const notFoundRoute = createRoute({
	id: '__notFound',
	path: '/__notfound',
	component: () => <NotFoundPage />,
});

export const homeRoute = createRoute({
	getParentRoute: () => rootRoute,
	id: 'home',
	path: '/',
	component: () => <LandingPage />,
});

export const privacyRoute = createRoute({
	getParentRoute: () => rootRoute,
	id: 'privacy',
	path: '/privacy',
	component: () => <PrivacyPage />,
});

export const termsRoute = createRoute({
	getParentRoute: () => rootRoute,
	id: 'terms',
	path: '/terms',
	component: () => <TermsPage />,
});

export const supportRoute = createRoute({
	getParentRoute: () => rootRoute,
	id: 'support',
	path: '/support',
	component: () => <SupportPage />,
});

export const downloadRoute = createRoute({
	getParentRoute: () => rootRoute,
	id: 'download',
	path: '/download',
	component: () => <DownloadPage />,
});

export const downloadAppRoute = createRoute({
	getParentRoute: () => rootRoute,
	id: 'downloadApp',
	path: '/download/app',
	component: () => <DownloadRedirect />,
});

export const faqRoute = createRoute({
	getParentRoute: () => rootRoute,
	id: 'faq',
	path: '/faq',
	component: () => <FAQPage />,
});

export const guidelinesRoute = createRoute({
	getParentRoute: () => rootRoute,
	id: 'guidelines',
	path: '/guidelines',
	component: () => <GuidelinesPage />,
});
