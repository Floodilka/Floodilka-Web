#!/usr/bin/env node

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

const fs = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2);
const outputIdx = args.indexOf('--output');
const outputArg = outputIdx >= 0 && args[outputIdx + 1] ? args[outputIdx + 1] : 'dev/livekit.yaml';

const voiceEnabled = (process.env.VOICE_ENABLED || '').trim().toLowerCase() === 'true';
if (!voiceEnabled) {
	process.exit(0);
}

const apiKey = (process.env.LIVEKIT_API_KEY || '').trim();
const apiSecret = (process.env.LIVEKIT_API_SECRET || '').trim();
const webhookUrl = (process.env.LIVEKIT_WEBHOOK_URL || '').trim();
if (!apiKey || !apiSecret || !webhookUrl) {
	process.exit(0);
}

const redisUrl = (process.env.REDIS_URL || '').trim();
const redisAddr = redisUrl.replace(/^redis:\/\//, '') || 'redis:6379';

const yaml = `port: 7880

redis:
  address: "${redisAddr}"
  db: 0

keys:
  "${apiKey}": "${apiSecret}"

rtc:
  tcp_port: 7881

webhook:
  api_key: "${apiKey}"
  urls:
    - "${webhookUrl}"

room:
  auto_create: true
  max_participants: 100
  empty_timeout: 300

development: true

`;
const outputPath = path.resolve(outputArg);
fs.mkdirSync(path.dirname(outputPath), {recursive: true});
fs.writeFileSync(outputPath, yaml, {encoding: 'utf-8', mode: 0o600});