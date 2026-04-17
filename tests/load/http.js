import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';
import crypto from 'k6/crypto';

const BASE = __ENV.TARGET_URL || 'https://stage.floodilka.com';
const MAX_VUS = parseInt(__ENV.MAX_VUS || '1000', 10);
const DURATION = __ENV.DURATION || '5m';
const BYPASS_SECRET = __ENV.LOAD_TEST_SECRET || '';

function bypassHeader() {
	if (!BYPASS_SECRET) return {};
	const ts = Math.floor(Date.now() / 1000).toString();
	const sig = crypto.hmac('sha256', BYPASS_SECRET, ts, 'hex');
	return { 'X-Load-Test-Token': `${ts}.${sig}` };
}

const healthLatency = new Trend('health_latency', true);
const botLatency = new Trend('bot_latency', true);
const errorRate = new Rate('errors');

export const options = {
	scenarios: {
		ramp: {
			executor: 'ramping-vus',
			startVUs: 10,
			stages: [
				{ duration: '1m', target: Math.floor(MAX_VUS * 0.1) },
				{ duration: '2m', target: Math.floor(MAX_VUS * 0.5) },
				{ duration: DURATION, target: MAX_VUS },
				{ duration: '1m', target: 0 },
			],
			gracefulRampDown: '30s',
		},
	},
	thresholds: {
		http_req_duration: ['p(95)<800'],
		errors: ['rate<0.02'],
	},
	summaryTrendStats: ['min', 'avg', 'med', 'max', 'p(50)', 'p(90)', 'p(95)', 'p(99)'],
};

export default function () {
	const baseHeaders = { 'User-Agent': 'floodilka-loadtest/1.0', ...bypassHeader() };

	const health = http.get(`${BASE}/api/_health`, {
		tags: { name: 'health' },
		headers: baseHeaders,
	});
	healthLatency.add(health.timings.duration);
	const healthOK = check(health, { 'health 200': (r) => r.status === 200 });
	errorRate.add(!healthOK);

	const bot = http.get(`${BASE}/api/gateway/bot`, {
		tags: { name: 'gateway_bot' },
		headers: baseHeaders,
	});
	botLatency.add(bot.timings.duration);
	const botOK = check(bot, {
		'bot 200/401': (r) => r.status === 200 || r.status === 401,
	});
	errorRate.add(!botOK);

	sleep(Math.random() * 2 + 1);
}

export function handleSummary(data) {
	return {
		stdout: textSummary(data),
		'summary.json': JSON.stringify(data, null, 2),
	};
}

function textSummary(data) {
	const m = data.metrics;
	const lines = [
		'',
		'=== Load Test Summary ===',
		`Target:        ${BASE}`,
		`Max VUs:       ${MAX_VUS}`,
		`Requests:      ${m.http_reqs?.values?.count ?? 0}`,
		`Req rate:      ${(m.http_reqs?.values?.rate ?? 0).toFixed(1)} /s`,
		`Failed:        ${((m.http_req_failed?.values?.rate ?? 0) * 100).toFixed(2)} %`,
		`Duration p50:  ${(m.http_req_duration?.values?.['p(50)'] ?? 0).toFixed(0)} ms`,
		`Duration p95:  ${(m.http_req_duration?.values?.['p(95)'] ?? 0).toFixed(0)} ms`,
		`Duration p99:  ${(m.http_req_duration?.values?.['p(99)'] ?? 0).toFixed(0)} ms`,
		'',
	];
	return lines.join('\n');
}
