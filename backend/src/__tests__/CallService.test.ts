import {describe, it, expect, vi} from 'vitest';

vi.mock('~/Config', () => ({Config: {}}));
vi.mock('~/Logger', () => ({Logger: {info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn()}}));
vi.mock('~/channel/ChannelModel', () => ({
	mapChannelToResponse: vi.fn().mockResolvedValue({}),
	mapMessageToResponse: vi.fn().mockResolvedValue({}),
}));
vi.mock('~/channel/services/message/ReadStateHelpers', () => ({
	incrementDmMentionCounts: vi.fn().mockResolvedValue(undefined),
}));

import {createChannelID, createUserID} from '~/BrandedTypes';
import type {ChannelID, UserID} from '~/BrandedTypes';
import {CallAlreadyExistsError} from '~/errors/CallAlreadyExistsError';
import type {CallData} from '~/infrastructure/IGatewayService';
import {CallService} from '~/channel/services/CallService';

const DM_TYPE = 1;
const CHANNEL_ID = createChannelID(100n);
const USER_A = createUserID(1n);
const USER_B = createUserID(2n);

function makeDmChannel(channelId: ChannelID, recipientIds: UserID[]) {
	return {
		id: channelId,
		guildId: null,
		type: DM_TYPE,
		name: null,
		topic: null,
		iconHash: null,
		parentId: null,
		position: 0,
		ownerId: null,
		recipientIds: new Set(recipientIds),
		isNsfw: false,
		rateLimitPerUser: 0,
		bitrate: null,
		userLimit: null,
		rtcRegion: null,
		lastMessageId: null,
		lastPinTimestamp: null,
		permissionOverwrites: new Map(),
		nicknames: new Map(),
		isSoftDeleted: false,
		indexedAt: null,
		version: 1,
	};
}

function makeCallData(channelId: ChannelID): CallData {
	return {
		channel_id: channelId.toString(),
		message_id: '999',
		region: 'us-east',
		ringing: [],
		recipients: [USER_A.toString(), USER_B.toString()],
		voice_states: [],
	};
}

function createMocks() {
	const channel = makeDmChannel(CHANNEL_ID, [USER_A, USER_B]);

	const channelRepository = {
		findUnique: vi.fn().mockResolvedValue(channel),
		getMessage: vi.fn().mockResolvedValue(null),
		upsertMessage: vi.fn().mockResolvedValue(null),
		deleteMessage: vi.fn().mockResolvedValue(null),
	};

	const userRepository = {
		findUnique: vi.fn().mockResolvedValue(null),
		findSettings: vi.fn().mockResolvedValue(null),
		getRelationship: vi.fn().mockResolvedValue(null),
		listUsers: vi.fn().mockResolvedValue([]),
		isDmChannelOpen: vi.fn().mockResolvedValue(true),
		openDmForUser: vi.fn().mockResolvedValue(undefined),
		getUserGuildIds: vi.fn().mockResolvedValue([]),
		listRelationships: vi.fn().mockResolvedValue([]),
	};

	const gatewayService = {
		getCall: vi.fn().mockResolvedValue(null),
		createCall: vi.fn().mockResolvedValue(makeCallData(CHANNEL_ID)),
		ringCallRecipients: vi.fn().mockResolvedValue(true),
		stopRingingCallRecipients: vi.fn().mockResolvedValue(true),
		dispatchPresence: vi.fn().mockResolvedValue(undefined),
	};

	const snowflakeService = {generate: vi.fn().mockReturnValue(999n)};
	const readStateService = {incrementUnreadCount: vi.fn().mockResolvedValue(undefined)};

	const callService = new CallService(
		channelRepository as any,
		userRepository as any,
		{} as any,
		gatewayService as any,
		{} as any,
		{} as any,
		snowflakeService as any,
		readStateService as any,
	);

	return {callService, gatewayService};
}

describe('CallService.ringCallRecipients', () => {
	it('creates a new call when no call exists', async () => {
		const {callService, gatewayService} = createMocks();
		gatewayService.getCall.mockResolvedValue(null);

		await callService.ringCallRecipients({
			userId: USER_A,
			channelId: CHANNEL_ID,
			requestCache: {users: new Map()} as any,
		});

		expect(gatewayService.createCall).toHaveBeenCalled();
	});

	it('rings existing call without creating when call already exists', async () => {
		const {callService, gatewayService} = createMocks();
		gatewayService.getCall.mockResolvedValue(makeCallData(CHANNEL_ID));

		await callService.ringCallRecipients({
			userId: USER_A,
			channelId: CHANNEL_ID,
			requestCache: {users: new Map()} as any,
		});

		expect(gatewayService.createCall).not.toHaveBeenCalled();
		expect(gatewayService.ringCallRecipients).toHaveBeenCalledWith(
			CHANNEL_ID,
			expect.any(Array),
		);
	});

	it('falls back to ringing on race condition (call appears between two getCall checks)', async () => {
		const {callService, gatewayService} = createMocks();

		// Race simulation:
		// 1st getCall (in ringCallRecipients) → null — "no call, let's create"
		// 2nd getCall (in createOrGetCall)    → call exists — throws CallAlreadyExistsError
		gatewayService.getCall
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce(makeCallData(CHANNEL_ID));

		// Must NOT throw — must gracefully fall through to ringCallRecipients
		await callService.ringCallRecipients({
			userId: USER_A,
			channelId: CHANNEL_ID,
			requestCache: {users: new Map()} as any,
		});

		expect(gatewayService.createCall).not.toHaveBeenCalled();
		expect(gatewayService.ringCallRecipients).toHaveBeenCalledWith(
			CHANNEL_ID,
			expect.any(Array),
		);
	});

	it('propagates non-CallAlreadyExistsError errors', async () => {
		const {callService, gatewayService} = createMocks();
		gatewayService.getCall.mockResolvedValue(null);
		gatewayService.createCall.mockRejectedValue(new Error('gateway down'));

		await expect(
			callService.ringCallRecipients({
				userId: USER_A,
				channelId: CHANNEL_ID,
				requestCache: {users: new Map()} as any,
			}),
		).rejects.toThrow('gateway down');
	});
});
