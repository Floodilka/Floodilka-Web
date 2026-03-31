/*
 * Copyright (C) 2026 Fluxer Contributors
 *
 * This file is part of Fluxer.
 *
 * Fluxer is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Fluxer is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Fluxer. If not, see <https://www.gnu.org/licenses/>.
 */

import '~/instrument';

import {serve} from '@hono/node-server';
import * as Sentry from '@sentry/node';
import {Hono} from 'hono';
import {logger} from 'hono/logger';
import {Redis} from 'ioredis';
import {registerAdminControllers} from '~/admin/controllers';
import {AuthController} from '~/auth/AuthController';
import {Config} from '~/Config';
import {ChannelController} from '~/channel/ChannelController';
import type {StreamPreviewService} from '~/channel/services/StreamPreviewService';
import {DownloadController} from '~/download/DownloadController';
import {AppErrorHandler, AppNotFoundHandler} from '~/Errors';
import {InvalidApiOriginError} from '~/errors/InvalidApiOriginError';
import {FavoriteMemeController} from '~/favorite_meme/FavoriteMemeController';
import {GatewayController} from '~/gateway/GatewayController';
import {GeoIPController} from '~/geoip/GeoIPController';
import {GuildController} from '~/guild/GuildController';
import {initializeMetricsService} from '~/infrastructure/MetricsService';
import {StorageService} from '~/infrastructure/StorageService';
import {InstanceController} from '~/instance/InstanceController';
import {InviteController} from '~/invite/InviteController';
import {Logger} from '~/Logger';
import {AuditLogMiddleware} from '~/middleware/AuditLogMiddleware';
import {IpBanMiddleware, ipBanCache} from '~/middleware/IpBanMiddleware';
import {MetricsMiddleware} from '~/middleware/MetricsMiddleware';
import {RequestCacheMiddleware} from '~/middleware/RequestCacheMiddleware';
import {RequireXForwardedForMiddleware} from '~/middleware/RequireXForwardedForMiddleware';
import {ensureVoiceResourcesInitialized, shutdownGatewayService, shutdownReportService} from '~/middleware/ServiceMiddleware';
import {UserMiddleware} from '~/middleware/UserMiddleware';
import {initializeOAuth} from '~/oauth/init';
import {OAuth2ApplicationsController} from '~/oauth/OAuth2ApplicationsController';
import {OAuth2Controller} from '~/oauth/OAuth2Controller';
import {registerPackControllers} from '~/pack/controllers';
import {ReadStateController} from '~/read_state/ReadStateController';
import {ReportController} from '~/report/ReportController';
import {RpcController} from '~/rpc/RpcController';
import {SearchController} from '~/search/controllers/SearchController';
import {PaymentController} from '~/payments/PaymentController';
import {KlipyController} from '~/klipy/KlipyController';
import {TestHarnessController} from '~/test/TestHarnessController';
import {UserController} from '~/user/UserController';
import {VoiceDataInitializer} from '~/voice/VoiceDataInitializer';
import {WebhookController} from '~/webhook/WebhookController';
import type {AdminService} from './admin/AdminService';
import type {AdminArchiveService} from './admin/services/AdminArchiveService';
import type {AuthService} from './auth/AuthService';
import type {AuthMfaService} from './auth/services/AuthMfaService';
import type {DesktopHandoffService} from './auth/services/DesktopHandoffService';
import type {UserID} from './BrandedTypes';
import type {IChannelRepository} from './channel/IChannelRepository';
import type {ChannelService} from './channel/services/ChannelService';
import type {ScheduledMessageService} from './channel/services/ScheduledMessageService';
import type {FavoriteMemeService} from './favorite_meme/FavoriteMemeService';
import type {FeatureFlagService} from './feature_flag/FeatureFlagService';
import type {GuildService} from './guild/services/GuildService';
import type {EmbedService} from './infrastructure/EmbedService';
import type {EntityAssetService} from './infrastructure/EntityAssetService';
import type {ICacheService} from './infrastructure/ICacheService';
import type {IEmailService} from './infrastructure/IEmailService';
import type {IGatewayService} from './infrastructure/IGatewayService';
import type {IMediaService} from './infrastructure/IMediaService';
import type {IRateLimitService} from './infrastructure/IRateLimitService';
import type {IStorageService} from './infrastructure/IStorageService';
import type {IKlipyService} from './infrastructure/IKlipyService';
import type {LiveKitWebhookService} from './infrastructure/LiveKitWebhookService';
import {RedisAccountDeletionQueueService} from './infrastructure/RedisAccountDeletionQueueService';
import type {RedisActivityTracker} from './infrastructure/RedisActivityTracker';
import type {SnowflakeService} from './infrastructure/SnowflakeService';
import type {UserCacheService} from './infrastructure/UserCacheService';
import type {InviteService} from './invite/InviteService';
import type {AuthSession, User} from './Models';
import type {RequestCache} from './middleware/RequestCacheMiddleware';
import {ServiceMiddleware} from './middleware/ServiceMiddleware';
import type {ApplicationService} from './oauth/ApplicationService';
import type {BotAuthService} from './oauth/BotAuthService';
import type {OAuth2Service} from './oauth/OAuth2Service';
import type {IApplicationRepository} from './oauth/repositories/IApplicationRepository';
import type {IOAuth2TokenRepository} from './oauth/repositories/IOAuth2TokenRepository';
import type {PackRepository} from './pack/PackRepository';
import type {PackService} from './pack/PackService';
import type {ReadStateService} from './read_state/ReadStateService';
import type {ReportService} from './report/ReportService';
import type {RpcService} from './rpc/RpcService';
import type {PaymentService} from './payments/PaymentService';
import type {IUserRepository} from './user/IUserRepository';
import type {EmailChangeService} from './user/services/EmailChangeService';
import {UserRepository} from './user/UserRepository';
import type {UserService} from './user/UserService';
import type {WebhookService} from './webhook/WebhookService';
import type {IWorkerService} from './worker/IWorkerService';

export interface HonoEnv {
	Variables: {
		user: User;
		adminService: AdminService;
		adminArchiveService: AdminArchiveService;
		adminUserId: UserID;
		adminUserAcls: Set<string>;
		authTokenType?: 'session' | 'bearer' | 'bot';
		authViaCookie?: boolean;
		authToken?: string;
		authUserId?: string;
		oauthBearerToken?: string;
		oauthBearerScopes?: Set<string>;
		oauthBearerUserId?: UserID;
		auditLogReason: string | null;
		authMfaService: AuthMfaService;
		authService: AuthService;
		authSession: AuthSession;
		desktopHandoffService: DesktopHandoffService;
		cacheService: ICacheService;
		channelService: ChannelService;
		channelRepository: IChannelRepository;
		streamPreviewService: StreamPreviewService;
		emailService: IEmailService;
		emailChangeService: EmailChangeService;
		embedService: EmbedService;
		entityAssetService: EntityAssetService;
		favoriteMemeService: FavoriteMemeService;
		gatewayService: IGatewayService;
		guildService: GuildService;
		packService: PackService;
		packRepository: PackRepository;
		inviteService: InviteService;
		liveKitWebhookService?: LiveKitWebhookService;
		mediaService: IMediaService;
		rateLimitService: IRateLimitService;
		readStateService: ReadStateService;
		redisActivityTracker: RedisActivityTracker;
		reportService: ReportService;
		requestCache: RequestCache;
		rpcService: RpcService;
		snowflakeService: SnowflakeService;
		storageService: IStorageService;
		klipyService: IKlipyService;
		userCacheService: UserCacheService;
		userRepository: IUserRepository;
		userService: UserService;
		webhookService: WebhookService;
		workerService: IWorkerService;
		scheduledMessageService: ScheduledMessageService;
		paymentService: PaymentService;
		applicationService: ApplicationService;
		oauth2Service: OAuth2Service;
		applicationRepository: IApplicationRepository;
		oauth2TokenRepository: IOAuth2TokenRepository;
		botAuthService: BotAuthService;
		sudoModeValid: boolean;
		sudoModeToken: string | null;
		featureFlagService: FeatureFlagService;
	};
}

export type HonoApp = typeof app;

const routes = new Hono<HonoEnv>({strict: true});

routes.use(
	logger((message: string, ...rest: Array<string>) => {
		Logger.info(rest.length > 0 ? `${message} ${rest.join(' ')}` : message);
	}),
);

if (Config.nodeEnv === 'production') {
	routes.use('*', async (ctx, next) => {
		const origin = ctx.req.header('origin');
		if (origin) {
			const host = ctx.req.header('host');
			if (
				ctx.req.method !== 'GET' &&
				(host === 'floodilka.com' || host === 'stage.floodilka.com') &&
				origin !== `https://${host}`
			) {
				throw new InvalidApiOriginError();
			}
		}
		await next();
	});
}

routes.use(IpBanMiddleware);
routes.use(MetricsMiddleware);
routes.use(AuditLogMiddleware);
routes.use(RequireXForwardedForMiddleware());
routes.use(RequestCacheMiddleware);
routes.use(ServiceMiddleware);
routes.use(UserMiddleware);

routes.use('*', async (ctx, next) => {
	const user = ctx.get('user');
	const clientIp = ctx.req.header('X-Forwarded-For')?.split(',')[0]?.trim();

	Sentry.setUser({
		id: user?.id.toString(),
		username: user?.username,
		email: user?.email ?? undefined,
		ip_address: clientIp,
	});

	return next();
});

routes.onError(AppErrorHandler);
routes.notFound(AppNotFoundHandler);

routes.get('/_health', async (ctx) => ctx.text('OK'));

GatewayController(routes);
GeoIPController(routes);

registerAdminControllers(routes);
AuthController(routes);
ChannelController(routes);
InstanceController(routes);
DownloadController(routes);
FavoriteMemeController(routes);
InviteController(routes);
registerPackControllers(routes);
ReadStateController(routes);
ReportController(routes);
RpcController(routes);
GuildController(routes);
SearchController(routes);
KlipyController(routes);
if (Config.dev.testModeEnabled) {
	TestHarnessController(routes);
}
UserController(routes);
WebhookController(routes);
OAuth2Controller(routes);
OAuth2ApplicationsController(routes);

if (!Config.instance.selfHosted) {
	PaymentController(routes);
}

const app = new Hono<HonoEnv>({strict: true});
app.route('/v1', routes);
app.route('/', routes);

app.onError(AppErrorHandler);
app.notFound(AppNotFoundHandler);

const ipBanSubscriber = new Redis(Config.redis.url);
ipBanCache.setRefreshSubscriber(ipBanSubscriber);
await ipBanCache.initialize();

initializeMetricsService(Config.metrics.host ?? null);

// Initialize mobile push notification service (FCM + APNs)
{
	const {MobilePushService} = await import('~/infrastructure/MobilePushService');
	MobilePushService.initialize();
}

await initializeOAuth();

try {
	const redis = new Redis(Config.redis.url);
	const userRepository = new UserRepository();
	const redisDeletionQueue = new RedisAccountDeletionQueueService(redis, userRepository);

	if (await redisDeletionQueue.needsRebuild()) {
		Logger.warn('Redis deletion queue needs rebuild, rebuilding...');
		await redisDeletionQueue.rebuildState();
	} else {
		Logger.info('Redis deletion queue state is healthy');
	}

	await redis.quit();
} catch (error) {
	Logger.error({error}, 'Failed to verify Redis deletion queue state');
	throw error;
}

if (Config.nodeEnv === 'development') {
	const storageService = new StorageService();
	await storageService.createBucket(Config.s3.buckets.cdn, true);
	await storageService.createBucket(Config.s3.buckets.uploads);
	await storageService.createBucket(Config.s3.buckets.reports);
	await storageService.createBucket(Config.s3.buckets.harvests);
	await storageService.createBucket(Config.s3.buckets.downloads, true);
	await storageService.purgeBucket(Config.s3.buckets.uploads);
}

Logger.info(
	{
		search_enabled: Config.search.enabled,
		meilisearch_url: Config.search.url,
		meilisearch_api_key_set: !!Config.search.apiKey,
	},
	'Search configuration loaded',
);

if (Config.search.enabled) {
	try {
		const {initializeMeilisearch} = await import('~/Meilisearch');
		await initializeMeilisearch();
		Logger.info('Search initialized');
	} catch (error) {
		Logger.warn({error}, 'Search initialization failed; continuing startup without search');
	}
}

if (Config.voice.enabled && Config.voice.autoCreateDummyData) {
	const voiceDataInitializer = new VoiceDataInitializer();
	await voiceDataInitializer.initialize();
	await ensureVoiceResourcesInitialized();
}


const server = serve({
	fetch: app.fetch,
	hostname: '0.0.0.0',
	port: Config.port,
});

let isShuttingDown = false;

const shutdown = async () => {
	if (isShuttingDown) return;
	isShuttingDown = true;

	Logger.info('Shutting down gracefully...');

	server.close(() => {
		Logger.info('HTTP server closed');
	});
	server.closeIdleConnections();

	shutdownGatewayService();
	shutdownReportService();
	ipBanCache.shutdown();

	setTimeout(() => {
		Logger.warn('Forced shutdown after timeout');
		process.exit(1);
	}, 25000).unref();
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

Logger.info({port: Config.port}, `Fluxer API listening on http://0.0.0.0:${Config.port}`);
