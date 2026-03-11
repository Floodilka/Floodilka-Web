import {config} from './config.js';
import {connect, disconnect, getMongo, getCassandra} from './connections.js';
import {loadIdMap, saveIdMap, getMapSize} from './id-map.js';
import {migrateUsers} from './phases/01-users.js';
import {migrateGuilds} from './phases/02-guilds.js';
import {migrateChannels} from './phases/03-channels.js';
import {migrateRoles} from './phases/04-roles.js';
import {migrateMembers} from './phases/05-members.js';
import {migrateMessages} from './phases/06-messages.js';
import {migrateDmChannels} from './phases/07-dm-channels.js';
import {migrateDmMessages} from './phases/08-dm-messages.js';
import {migrateRelationships} from './phases/09-relationships.js';
import {migrateInvites} from './phases/10-invites.js';
import {migrateCalls} from './phases/11-calls.js';
import {migrateReports} from './phases/12-reports.js';
import {migrateReadStates} from './phases/13-read-states.js';
import {migrateIcons} from './phases/14-icons.js';
import {migrateChannelState} from './phases/15-channel-state.js';

type Phase = {
	num: number;
	name: string;
	fn: (mongo: ReturnType<typeof getMongo>, cass: ReturnType<typeof getCassandra>) => Promise<void>;
};

const phases: Phase[] = [
	{num: 1, name: 'Users', fn: migrateUsers},
	{num: 2, name: 'Guilds', fn: migrateGuilds},
	{num: 3, name: 'Roles', fn: migrateRoles},
	{num: 4, name: 'Channels', fn: migrateChannels},
	{num: 5, name: 'Members', fn: migrateMembers},
	{num: 6, name: 'Messages', fn: migrateMessages},
	{num: 7, name: 'DM Channels', fn: migrateDmChannels},
	{num: 8, name: 'DM Messages', fn: migrateDmMessages},
	{num: 9, name: 'Relationships', fn: migrateRelationships},
	{num: 10, name: 'Invites', fn: migrateInvites},
	{num: 11, name: 'Calls', fn: migrateCalls},
	{num: 12, name: 'Reports', fn: migrateReports},
	{num: 13, name: 'Read States', fn: migrateReadStates},
	{num: 14, name: 'Icons', fn: migrateIcons},
	{num: 15, name: 'Channel State', fn: (_mongo, cass) => migrateChannelState(cass)},
];

async function main() {
	console.log('=== Floodilka MongoDB → Cassandra Migration ===');
	console.log(`  DRY_RUN: ${config.dryRun}`);
	console.log(`  START_PHASE: ${config.startPhase}`);
	console.log(`  SKIP_PHASES: ${[...config.skipPhases].join(', ') || 'none'}`);
	console.log();

	await connect();
	loadIdMap();

	const mongo = getMongo();
	const cass = getCassandra();
	const startTime = Date.now();

	for (const phase of phases) {
		if (phase.num < config.startPhase) {
			console.log(`\nSkipping phase ${phase.num} (${phase.name}) — before START_PHASE`);
			continue;
		}
		if (config.skipPhases.has(phase.num)) {
			console.log(`\nSkipping phase ${phase.num} (${phase.name}) — in SKIP_PHASES`);
			continue;
		}

		try {
			await phase.fn(mongo, cass);
		} catch (err) {
			console.error(`\nFATAL: Phase ${phase.num} (${phase.name}) failed:`, err);
			saveIdMap();
			await disconnect();
			process.exit(1);
		}

		// Save ID map after each phase for recovery
		saveIdMap();
	}

	const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
	console.log(`\n=== Migration complete in ${elapsed}s ===`);
	console.log(`  Total ID mappings: ${getMapSize()}`);

	await disconnect();
}

main().catch((err) => {
	console.error('Unhandled error:', err);
	process.exit(1);
});
