// Permission bit flags (matching the new system)
const CREATE_INSTANT_INVITE = 1n << 0n;
const KICK_MEMBERS = 1n << 1n;
const BAN_MEMBERS = 1n << 2n;
const MANAGE_CHANNELS = 1n << 4n;
const MANAGE_GUILD = 1n << 5n;
const ADD_REACTIONS = 1n << 6n;
const VIEW_CHANNEL = 1n << 10n;
const MANAGE_MESSAGES = 1n << 13n;
const READ_MESSAGE_HISTORY = 1n << 16n;
const USE_EXTERNAL_EMOJIS = 1n << 18n;
const MOVE_MEMBERS = 1n << 24n;
const USE_VAD = 1n << 25n;
const CHANGE_NICKNAME = 1n << 26n;
const MANAGE_ROLES = 1n << 28n;
const USE_EXTERNAL_STICKERS = 1n << 37n;
const CREATE_EXPRESSIONS = 1n << 43n;

// Permissions that were in old default but shouldn't be for regular users
const DANGEROUS_FOR_EVERYONE = MANAGE_MESSAGES | MOVE_MEMBERS;

// Permissions that new backend expects for basic user functionality
// but were missing in old default
const MISSING_BASICS =
	CREATE_INSTANT_INVITE |
	ADD_REACTIONS |
	READ_MESSAGE_HISTORY |
	USE_EXTERNAL_EMOJIS |
	USE_VAD |
	CHANGE_NICKNAME |
	USE_EXTERNAL_STICKERS |
	CREATE_EXPRESSIONS;

// Old format: object with boolean fields
interface OldPermissions {
	manageServer?: boolean;
	manageChannels?: boolean;
	manageRoles?: boolean;
	manageMembers?: boolean;
	kickMembers?: boolean;
	banMembers?: boolean;
	[key: string]: boolean | undefined;
}

export function convertPermissions(perms: string | OldPermissions | undefined | null): bigint {
	if (!perms) return 0n;

	let result: bigint;

	if (typeof perms === 'string') {
		// New format: string bitmask like "19983872"
		result = BigInt(perms);
	} else {
		// Old format: object with boolean fields
		result = 0n;
		if (perms.manageServer) result |= MANAGE_GUILD;
		if (perms.manageChannels) result |= MANAGE_CHANNELS;
		if (perms.manageRoles) result |= MANAGE_ROLES;
		if (perms.manageMembers) result |= KICK_MEMBERS;
		if (perms.kickMembers) result |= KICK_MEMBERS;
		if (perms.banMembers) result |= BAN_MEMBERS;
	}

	// Old system didn't have full permission granularity.
	// For non-admin roles with VIEW_CHANNEL:
	// 1. Add missing basic permissions (reactions, nicknames, etc.)
	// 2. Remove dangerous ones that @everyone shouldn't have (MANAGE_MESSAGES, MOVE_MEMBERS)
	if (result & VIEW_CHANNEL) {
		result |= MISSING_BASICS;
		result &= ~DANGEROUS_FOR_EVERYONE;
	}

	return result;
}
