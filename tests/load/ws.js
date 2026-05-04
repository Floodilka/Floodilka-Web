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

import ws from 'k6/ws';
import { check } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';
import crypto from 'k6/crypto';

const GATEWAY = __ENV.GATEWAY_URL || 'wss://gateway.stage.floodilka.com/?v=10&encoding=json';
const MAX_VUS = parseInt(__ENV.MAX_VUS || '2000', 10);
const HOLD = __ENV.HOLD || '5m';
const SESSION_SECONDS = parseInt(__ENV.SESSION_SECONDS || '120', 10);
const BYPASS_SECRET = __ENV.LOAD_TEST_SECRET || '';

function bypassHeader() {
	if (!BYPASS_SECRET) return {};
	const ts = Math.floor(Date.now() / 1000).toString();
	const sig = crypto.hmac('sha256', BYPASS_SECRET, ts, 'hex');
	return { 'X-Load-Test-Token': `${ts}.${sig}` };
}

const connected = new Counter('ws_connected');
const handshakeTime = new Trend('ws_handshake_time', true);
const connectErrors = new Rate('ws_connect_errors');

export const options = {
	scenarios: {
		connections: {
			executor: 'ramping-vus',
			startVUs: 50,
			stages: [
				{ duration: '2m', target: Math.floor(MAX_VUS * 0.2) },
				{ duration: '3m', target: Math.floor(MAX_VUS * 0.6) },
				{ duration: HOLD, target: MAX_VUS },
				{ duration: '1m', target: 0 },
			],
			gracefulRampDown: '30s',
		},
	},
	thresholds: {
		ws_connect_errors: ['rate<0.05'],
		ws_handshake_time: ['p(95)<2000'],
	},
};

export default function () {
	const start = Date.now();
	const params = { tags: { name: 'gateway_ws' }, headers: bypassHeader() };
	const res = ws.connect(GATEWAY, params, (socket) => {
		socket.on('open', () => {
			handshakeTime.add(Date.now() - start);
			connected.add(1);
		});

		socket.on('message', () => {});

		socket.on('error', () => {
			connectErrors.add(1);
		});

		socket.setTimeout(() => socket.close(), SESSION_SECONDS * 1000);
	});

	const ok = check(res, { 'ws status 101': (r) => r && r.status === 101 });
	connectErrors.add(!ok);
}

export function handleSummary(data) {
	const m = data.metrics;
	const lines = [
		'',
		'=== WS Load Test Summary ===',
		`Gateway:         ${GATEWAY}`,
		`Max VUs:         ${MAX_VUS}`,
		`Connected:       ${m.ws_connected?.values?.count ?? 0}`,
		`Handshake p95:   ${(m.ws_handshake_time?.values?.['p(95)'] ?? 0).toFixed(0)} ms`,
		`Connect errors:  ${((m.ws_connect_errors?.values?.rate ?? 0) * 100).toFixed(2)} %`,
		'',
	];
	return {
		stdout: lines.join('\n'),
		'ws-summary.json': JSON.stringify(data, null, 2),
	};
}
