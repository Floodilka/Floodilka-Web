import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, resolve} from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, '../..');
const DOCS = resolve(__dirname, '..');
const CONTENT = resolve(DOCS, 'src/content/docs');

const AUTOGEN_HEADER = (sourceFile) =>
	`{/* Автогенерировано из ${sourceFile}. Не редактируйте вручную — меняйте источник или скрипт docs/scripts/generate-from-source.mjs. */}`;
const AUTOGEN_HEADER_EN = (sourceFile) =>
	`{/* Auto-generated from ${sourceFile}. Do not edit by hand — change the source or docs/scripts/generate-from-source.mjs. */}`;

function humanize(name) {
	return name
		.toLowerCase()
		.replace(/_/g, ' ')
		.replace(/\b\w/g, (c) => c.toUpperCase());
}

function parsePermissions() {
	const src = readFileSync(resolve(REPO, 'backend/src/constants/Channel.ts'), 'utf8');
	const block = src.match(/export const Permissions = \{([\s\S]*?)\} as const;/);
	if (!block) throw new Error('Permissions block not found');
	const perms = [];
	for (const line of block[1].split('\n')) {
		const m = line.match(/^\s*([A-Z_]+):\s*1n << (\d+)n/);
		if (!m) continue;
		const name = m[1];
		const bit = Number(m[2]);
		perms.push({name, bit, value: (1n << BigInt(bit)).toString()});
	}
	return perms;
}

function parseErrorCodes() {
	const src = readFileSync(resolve(REPO, 'backend/src/constants/API.ts'), 'utf8');
	const block = src.match(/export const APIErrorCodes = \{([\s\S]*?)\} as const;/);
	if (!block) throw new Error('APIErrorCodes block not found');
	const codes = [];
	for (const line of block[1].split('\n')) {
		const m = line.match(/^\s*([A-Z_]+):\s*'[A-Z_]+'/);
		if (!m) continue;
		codes.push(m[1]);
	}
	return codes;
}

// Opcodes that bots never send or receive (first-party client only)
const NON_BOT_OPCODES = new Set(['call_connect', 'lazy_request', 'voice_server_ping']);

function parseGatewayConstants() {
	const src = readFileSync(resolve(REPO, 'gateway/src/utils/constants.erl'), 'utf8');
	const opcodes = [];
	for (const m of src.matchAll(/gateway_opcode\((\d+)\) -> (\w+);/g)) {
		const name = m[2];
		if (NON_BOT_OPCODES.has(name)) continue;
		opcodes.push({num: Number(m[1]), name});
	}
	const closeCodes = [];
	for (const m of src.matchAll(/close_code_to_num\((\w+)\) -> (\d+)\./g)) {
		closeCodes.push({num: Number(m[2]), name: m[1]});
	}
	return {opcodes, closeCodes};
}

// ─── Descriptions (bilingual) ────────────────────────────────────────────────

const PERMISSION_DESC = {
	CREATE_INSTANT_INVITE: {
		ru: 'Создание приглашений в гильдию.',
		en: 'Create invites to the guild.',
	},
	KICK_MEMBERS: {ru: 'Кик участников.', en: 'Kick members.'},
	BAN_MEMBERS: {ru: 'Бан участников.', en: 'Ban members.'},
	ADMINISTRATOR: {
		ru: 'Полные права. Обходит любые проверки прав и permission overwrites.',
		en: 'All permissions. Bypasses every permission check and overwrite.',
	},
	MANAGE_CHANNELS: {
		ru: 'Создание, редактирование, удаление каналов.',
		en: 'Create, edit, and delete channels.',
	},
	MANAGE_GUILD: {
		ru: 'Изменение настроек гильдии: имя, регион, фичи.',
		en: 'Edit guild settings: name, region, features.',
	},
	ADD_REACTIONS: {
		ru: 'Добавление новых реакций к сообщениям.',
		en: 'Add new reactions to messages.',
	},
	VIEW_AUDIT_LOG: {ru: 'Чтение журнала аудита.', en: 'Read the audit log.'},
	PRIORITY_SPEAKER: {
		ru: 'Приоритетное вещание в голосовом канале.',
		en: 'Priority speaker in voice.',
	},
	STREAM: {ru: 'Запуск стрима видео/экрана.', en: 'Start a video or screen-share stream.'},
	VIEW_CHANNEL: {
		ru: 'Чтение канала и подключение к голосовому.',
		en: 'View the channel or connect to voice.',
	},
	SEND_MESSAGES: {ru: 'Отправка сообщений в канале.', en: 'Send messages in the channel.'},
	SEND_TTS_MESSAGES: {ru: 'Отправка text-to-speech сообщений.', en: 'Send text-to-speech messages.'},
	MANAGE_MESSAGES: {
		ru: 'Удаление чужих сообщений, пин/анпин, управление публикациями.',
		en: "Delete others' messages, pin/unpin, and manage published messages.",
	},
	EMBED_LINKS: {ru: 'Автоматическое разворачивание ссылок в эмбеды.', en: 'Auto-embed links.'},
	ATTACH_FILES: {ru: 'Прикрепление файлов к сообщениям.', en: 'Attach files to messages.'},
	READ_MESSAGE_HISTORY: {
		ru: 'Чтение истории сообщений канала.',
		en: 'Read channel message history.',
	},
	MENTION_EVERYONE: {
		ru: 'Использование @everyone, @here и @роль, если роль упоминаема.',
		en: 'Use @everyone, @here, and @role mentions (when the role is mentionable).',
	},
	USE_EXTERNAL_EMOJIS: {
		ru: 'Использование кастомных эмоджи с других серверов.',
		en: 'Use custom emojis from other servers.',
	},
	CONNECT: {
		ru: 'Подключение к голосовому каналу.',
		en: 'Connect to a voice channel.',
	},
	SPEAK: {ru: 'Говорение в голосе.', en: 'Speak in voice.'},
	MUTE_MEMBERS: {
		ru: 'Выключение микрофона другим участникам.',
		en: 'Mute other members in voice.',
	},
	DEAFEN_MEMBERS: {
		ru: 'Выключение звука для других участников.',
		en: 'Deafen other members in voice.',
	},
	MOVE_MEMBERS: {
		ru: 'Перемещение участников между голосовыми каналами.',
		en: 'Move members between voice channels.',
	},
	USE_VAD: {
		ru: 'Использование voice activity detection (без push-to-talk).',
		en: 'Use voice activity detection (no push-to-talk required).',
	},
	CHANGE_NICKNAME: {
		ru: 'Смена собственного ника на сервере.',
		en: 'Change own nickname in the guild.',
	},
	MANAGE_NICKNAMES: {
		ru: 'Смена никнеймов других участников.',
		en: "Change other members' nicknames.",
	},
	MANAGE_ROLES: {
		ru: 'Создание, редактирование, удаление ролей ниже своей.',
		en: 'Create, edit, and delete roles below your highest role.',
	},
	MANAGE_WEBHOOKS: {
		ru: 'Управление вебхуками.',
		en: 'Manage webhooks.',
	},
	MANAGE_EXPRESSIONS: {
		ru: 'Управление эмоджи, стикерами, звуками сервера.',
		en: 'Manage server emojis, stickers, and sounds.',
	},
	USE_EXTERNAL_STICKERS: {
		ru: 'Использование стикеров с других серверов.',
		en: 'Use stickers from other servers.',
	},
	MODERATE_MEMBERS: {
		ru: 'Тайм-ауты и прочие soft-действия модерации.',
		en: 'Timeout members and other soft-moderation actions.',
	},
	CREATE_EXPRESSIONS: {
		ru: 'Создание (но не управление чужими) эмоджи и стикеров.',
		en: "Create (but not manage others') emojis and stickers.",
	},
	PIN_MESSAGES: {
		ru: 'Прикрепление сообщений без MANAGE_MESSAGES.',
		en: 'Pin messages without MANAGE_MESSAGES.',
	},
	BYPASS_SLOWMODE: {
		ru: 'Игнорирование slowmode-ограничений канала.',
		en: 'Bypass channel slowmode limits.',
	},
	UPDATE_RTC_REGION: {
		ru: 'Смена RTC-региона голосового канала.',
		en: 'Change the voice channel RTC region.',
	},
};

const OPCODE_DESC = {
	dispatch: {
		ru: 'Событие от сервера. `t` содержит тип события, `d` — payload.',
		en: 'Server-to-client event. `t` holds the event type, `d` the payload.',
		dir: 'S→C',
	},
	heartbeat: {
		ru: 'Heartbeat. Клиент отправляет с последним `s` через интервал из HELLO. Сервер тоже может прислать — тогда надо ответить.',
		en: 'Heartbeat. Client sends with the last `s` on the interval from HELLO. Server may also send one; reply immediately.',
		dir: 'C↔S',
	},
	identify: {
		ru: 'Начинает новую сессию. Отправляется после HELLO.',
		en: 'Starts a new session. Sent after HELLO.',
		dir: 'C→S',
	},
	presence_update: {
		ru: 'Обновление статуса и активностей клиента.',
		en: 'Update client status and activities.',
		dir: 'C→S',
	},
	voice_state_update: {
		ru: 'Присоединение/выход из голосового канала, мут, глушение.',
		en: 'Join/leave a voice channel, mute, deafen.',
		dir: 'C→S',
	},
	voice_server_ping: {
		ru: 'Проверка латенции до voice-сервера.',
		en: 'Voice-server latency ping.',
		dir: 'C→S',
	},
	resume: {
		ru: 'Восстановление прерванной сессии с последним `s`.',
		en: 'Resume an interrupted session with the last `s`.',
		dir: 'C→S',
	},
	reconnect: {
		ru: 'Сервер просит переподключиться и возобновить сессию.',
		en: 'Server asks the client to reconnect and resume.',
		dir: 'S→C',
	},
	request_guild_members: {
		ru: 'Запрос списка участников гильдии (для больших гильдий).',
		en: 'Request guild member list (for large guilds).',
		dir: 'C→S',
	},
	invalid_session: {
		ru: 'Сессия невалидна. `d: true` — можно резюмировать, `false` — надо идентифицироваться заново.',
		en: "Session is invalid. `d: true` means resume is possible; `false` means re-identify.",
		dir: 'S→C',
	},
	hello: {
		ru: 'Первое сообщение после подключения. В `d.heartbeat_interval` — миллисекунды между heartbeat.',
		en: 'First message after connect. `d.heartbeat_interval` is the ms between heartbeats.',
		dir: 'S→C',
	},
	heartbeat_ack: {
		ru: 'Подтверждение heartbeat. Если не пришёл — реконнект.',
		en: 'Heartbeat acknowledgement. If missing, reconnect.',
		dir: 'S→C',
	},
	gateway_error: {
		ru: 'Ошибка gateway-уровня с деталями в `d`.',
		en: 'Gateway-level error with details in `d`.',
		dir: 'S→C',
	},
	call_connect: {
		ru: 'Служебное событие для звонков (личные сообщения, voice-сессии).',
		en: 'Call-related control event (DMs, voice sessions).',
		dir: 'C↔S',
	},
	lazy_request: {
		ru: 'Ленивый запрос участников гильдии по сегментам.',
		en: 'Lazy guild-member request by ranges.',
		dir: 'C→S',
	},
};

const CLOSE_CODE_DESC = {
	unknown_error: {
		ru: 'Неизвестная ошибка. Повторное подключение обычно помогает.',
		en: 'Unknown error. A reconnect usually succeeds.',
		reconnect: true,
	},
	unknown_opcode: {
		ru: 'Клиент отправил неизвестный опкод.',
		en: 'Client sent an unknown opcode.',
		reconnect: true,
	},
	decode_error: {
		ru: 'Не удалось декодировать payload (обычно битый JSON).',
		en: 'Payload failed to decode (typically broken JSON).',
		reconnect: true,
	},
	not_authenticated: {
		ru: 'Клиент отправил payload до IDENTIFY.',
		en: 'Client sent a payload before IDENTIFY.',
		reconnect: true,
	},
	authentication_failed: {
		ru: 'Токен невалиден. **Не переподключайтесь** — сбросьте и обновите токен.',
		en: 'Token is invalid. **Do not reconnect** — reset the token and update it.',
		reconnect: false,
	},
	already_authenticated: {
		ru: 'IDENTIFY отправлен повторно в уже авторизованной сессии.',
		en: 'IDENTIFY sent again on an already-authenticated session.',
		reconnect: true,
	},
	invalid_seq: {
		ru: 'RESUME с `s`, которого не существует. Начните новую сессию через IDENTIFY.',
		en: 'RESUME with a `s` the server does not have. Start a fresh session via IDENTIFY.',
		reconnect: true,
	},
	rate_limited: {
		ru: 'Слишком частые сообщения. Сделайте паузу перед повторным подключением.',
		en: 'Too many payloads. Back off before reconnecting.',
		reconnect: true,
	},
	session_timeout: {
		ru: 'Heartbeat пропущен, сессия закрыта по таймауту.',
		en: 'Heartbeat was missed; the session timed out.',
		reconnect: true,
	},
	invalid_shard: {
		ru: 'Неверный `shard` в IDENTIFY.',
		en: 'Invalid `shard` value in IDENTIFY.',
		reconnect: false,
	},
	sharding_required: {
		ru: 'Слишком большие гильдии — требуется шардинг.',
		en: 'Too many large guilds; sharding is required.',
		reconnect: false,
	},
	invalid_api_version: {
		ru: 'URL содержит неподдерживаемый `v=`. Используйте `v=1`.',
		en: 'URL contains an unsupported `v=`. Use `v=1`.',
		reconnect: false,
	},
};

// ─── Permissions page ────────────────────────────────────────────────────────

function permissionsPage(lang) {
	const perms = parsePermissions();
	const isRu = lang === 'ru';
	const title = isRu ? 'Права доступа' : 'Permissions';
	const desc = isRu
		? 'Битовое поле прав: все биты, их числовые значения и комбинация ролей.'
		: 'The permission bitfield: every bit, its numeric value, and how roles combine.';
	const header = isRu ? AUTOGEN_HEADER('backend/src/constants/Channel.ts') : AUTOGEN_HEADER_EN('backend/src/constants/Channel.ts');

	const intro = isRu
		? `Права во Флудилке хранятся как 64-битное целое число. Каждый бит — отдельное право. Роли пользователя объединяются побитовым ИЛИ; overwrites канала применяются поверх: **deny** побитово обнуляет, **allow** выставляет биты.

Проверка прав идёт слева направо по цепочке \`@everyone → роли → overwrites категории → overwrites канала\`. Бит \`ADMINISTRATOR\` обходит все проверки.`
		: `Permissions in Floodilka are stored as a 64-bit integer. Each bit is a separate permission. A user's roles combine via bitwise OR; channel overwrites are applied on top: **deny** clears bits, **allow** sets them.

Resolution order is \`@everyone → roles → category overwrites → channel overwrites\`. The \`ADMINISTRATOR\` bit bypasses every check.`;

	const tableHeader = isRu
		? '| Имя | Бит | Значение | Описание |\n|-----|-----|----------|----------|'
		: '| Name | Bit | Value | Description |\n|------|-----|-------|-------------|';

	const rows = perms
		.map((p) => {
			const d = PERMISSION_DESC[p.name] ?? {ru: '—', en: '—'};
			return `| \`${p.name}\` | ${p.bit} | \`${p.value}\` | ${isRu ? d.ru : d.en} |`;
		})
		.join('\n');

	const example = isRu
		? `## Построение маски прав в инвайт-ссылке

Сложите значения через побитовое ИЛИ:

\`\`\`js
const permissions =
	(1 << 10) |  // VIEW_CHANNEL
	(1 << 11) |  // SEND_MESSAGES
	(1 << 16);   // READ_MESSAGE_HISTORY
// → 68608
\`\`\`

Вставьте число в параметр \`permissions\` OAuth2-ссылки:

\`\`\`
https://floodilka.com/oauth2/authorize?client_id=APP_ID&scope=bot&permissions=68608
\`\`\`

Для прав с битами >= 32 используйте \`BigInt\`: \`(1n << 40n)\` вместо \`1 << 40\`.`
		: `## Building a permissions bitfield for invite URLs

OR the values together:

\`\`\`js
const permissions =
	(1 << 10) |  // VIEW_CHANNEL
	(1 << 11) |  // SEND_MESSAGES
	(1 << 16);   // READ_MESSAGE_HISTORY
// → 68608
\`\`\`

Drop the number into the OAuth2 URL \`permissions\` parameter:

\`\`\`
https://floodilka.com/oauth2/authorize?client_id=APP_ID&scope=bot&permissions=68608
\`\`\`

For bits >= 32 use \`BigInt\`: \`(1n << 40n)\` instead of \`1 << 40\`.`;

	return `---
title: "${title}"
description: "${desc}"
---

${header}

${intro}

## Полный список
${isRu ? '' : '(full list)'}

${tableHeader}
${rows}

${example}
`;
}

// ─── Gateway opcodes page ───────────────────────────────────────────────────

function opcodesPage(lang) {
	const {opcodes} = parseGatewayConstants();
	const isRu = lang === 'ru';
	const title = isRu ? 'Опкоды Gateway' : 'Gateway Opcodes';
	const desc = isRu
		? 'Все опкоды WebSocket-протокола Gateway: назначение, направление, payload.'
		: 'Every opcode in the Gateway WebSocket protocol: purpose, direction, and payload.';
	const header = isRu ? AUTOGEN_HEADER('gateway/src/utils/constants.erl') : AUTOGEN_HEADER_EN('gateway/src/utils/constants.erl');

	const intro = isRu
		? `Каждое сообщение Gateway — JSON с полями \`op\`, \`d\`, \`s\`, \`t\`. Опкод (\`op\`) определяет роль сообщения в протоколе. Направление:

- **C→S** — клиент отправляет серверу
- **S→C** — сервер отправляет клиенту
- **C↔S** — используется в обе стороны`
		: `Every Gateway message is a JSON object with \`op\`, \`d\`, \`s\`, \`t\`. The opcode (\`op\`) defines the message role. Directions:

- **C→S** — client sends to server
- **S→C** — server sends to client
- **C↔S** — used both ways`;

	const tableHeader = isRu
		? '| Код | Имя | Направление | Описание |\n|-----|-----|-------------|----------|'
		: '| Code | Name | Direction | Description |\n|------|------|-----------|-------------|';

	const rows = opcodes
		.map((o) => {
			const d = OPCODE_DESC[o.name] ?? {ru: '—', en: '—', dir: '—'};
			const upper = o.name.toUpperCase();
			return `| ${o.num} | \`${upper}\` | ${d.dir} | ${isRu ? d.ru : d.en} |`;
		})
		.join('\n');

	return `---
title: "${title}"
description: "${desc}"
---

${header}

${intro}

${tableHeader}
${rows}

${
	isRu
		? `## Что дальше

- [Жизненный цикл соединения](/gateway/connection-lifecycle/) — как HELLO → IDENTIFY → READY складываются в рабочую сессию
- [Коды закрытия](/gateway/close-codes/) — как интерпретировать WebSocket close code
- [События](/gateway/events/) — полный список dispatch-событий`
		: `## What's next

- [Connection lifecycle](/gateway/connection-lifecycle/) — how HELLO → IDENTIFY → READY form a working session
- [Close codes](/gateway/close-codes/) — how to interpret a WebSocket close code
- [Events](/gateway/events/) — full list of dispatch events`
}
`;
}

// ─── Close codes page ───────────────────────────────────────────────────────

function closeCodesPage(lang) {
	const {closeCodes} = parseGatewayConstants();
	const isRu = lang === 'ru';
	const title = isRu ? 'Коды закрытия Gateway' : 'Gateway Close Codes';
	const desc = isRu
		? 'WebSocket close codes, которые может вернуть Gateway, и рекомендации по реконнекту.'
		: 'WebSocket close codes the Gateway can send, and reconnect guidance.';
	const header = isRu ? AUTOGEN_HEADER('gateway/src/utils/constants.erl') : AUTOGEN_HEADER_EN('gateway/src/utils/constants.erl');

	const tableHeader = isRu
		? '| Код | Имя | Переподключаться | Описание |\n|-----|-----|------------------|----------|'
		: '| Code | Name | Reconnect | Description |\n|------|------|-----------|-------------|';

	const rows = closeCodes
		.map((c) => {
			const d = CLOSE_CODE_DESC[c.name] ?? {ru: '—', en: '—', reconnect: true};
			const yes = isRu ? 'Да' : 'Yes';
			const no = isRu ? 'Нет' : 'No';
			return `| ${c.num} | \`${c.name.toUpperCase()}\` | ${d.reconnect ? yes : no} | ${isRu ? d.ru : d.en} |`;
		})
		.join('\n');

	const intro = isRu
		? `Gateway закрывает соединение при ошибке протокола или аутентификации. Коды в диапазоне 4000-4999 — прикладные, пришедшие от сервера. При стандартных закрытиях (1000-1015) — реконнект безопасен.

**Переподключаться: Нет** означает, что проблема не решится без вмешательства разработчика (неправильный токен, устаревшая версия API). Попытка бесконечно реконнектиться превратится в DoS.`
		: `Gateway closes connections on protocol or authentication errors. Codes in 4000-4999 are application-level, issued by the server. For standard close codes (1000-1015), reconnecting is safe.

**Reconnect: No** means the issue cannot be fixed without developer action (wrong token, outdated API version). Looping reconnects will turn into a self-inflicted DoS.`;

	return `---
title: "${title}"
description: "${desc}"
---

${header}

${intro}

${tableHeader}
${rows}
`;
}

// ─── Error codes page ───────────────────────────────────────────────────────

const ERROR_CATEGORIES = [
	{prefix: 'UNKNOWN_', ru: 'Объект не найден', en: 'Object not found'},
	{prefix: 'MAX_', ru: 'Превышен лимит', en: 'Limit exceeded'},
	{prefix: 'CANNOT_', ru: 'Действие запрещено в текущем контексте', en: 'Action forbidden in the current context'},
	{prefix: 'INVALID_', ru: 'Невалидные данные', en: 'Invalid data'},
	{prefix: 'MISSING_', ru: 'Отсутствует обязательное поле или право', en: 'Required field or permission missing'},
];

function errorCodesPage(lang) {
	const codes = parseErrorCodes();
	const isRu = lang === 'ru';
	const title = isRu ? 'Коды ошибок REST API' : 'REST API Error Codes';
	const desc = isRu
		? 'Все строковые коды ошибок, которые возвращает REST API, и категории для быстрой навигации.'
		: 'Every string error code the REST API can return, plus categories for quick lookup.';
	const header = isRu ? AUTOGEN_HEADER('backend/src/constants/API.ts') : AUTOGEN_HEADER_EN('backend/src/constants/API.ts');

	const intro = isRu
		? `Ответы с HTTP-статусами 4xx и 5xx содержат JSON вида:

\`\`\`json
{
	"code": "UNKNOWN_CHANNEL",
	"message": "Канал не найден"
}
\`\`\`

Ориентируйтесь в первую очередь на \`code\` (стабильный машиночитаемый идентификатор), \`message\` — человеко-читаемая подсказка на языке клиента и может меняться.

## Категории

Большинство кодов имеют общий префикс, по которому понятно, что произошло:`
		: `Any 4xx/5xx response contains JSON in this shape:

\`\`\`json
{
	"code": "UNKNOWN_CHANNEL",
	"message": "Channel not found"
}
\`\`\`

Rely on \`code\` — it's a stable machine-readable identifier. \`message\` is a human hint localised to the client and may change.

## Categories

Most codes share a prefix that tells you what went wrong:`;

	const categoriesList = ERROR_CATEGORIES.map(
		(c) => `- \`${c.prefix}*\` — ${isRu ? c.ru : c.en}`,
	).join('\n');

	const allHeader = isRu ? '## Все коды' : '## All codes';
	const listEntries = codes.map((c) => `- \`${c}\``).join('\n');

	return `---
title: "${title}"
description: "${desc}"
---

${header}

${intro}

${categoriesList}

${allHeader}

${listEntries}
`;
}

// ─── Runner ─────────────────────────────────────────────────────────────────

function write(outPath, content) {
	mkdirSync(dirname(outPath), {recursive: true});
	writeFileSync(outPath, content);
	console.log('wrote', outPath.replace(REPO + '/', ''));
}

for (const lang of ['ru', 'en']) {
	const base = lang === 'ru' ? CONTENT : resolve(CONTENT, 'en');
	write(resolve(base, 'topics/permissions.mdx'), permissionsPage(lang));
	write(resolve(base, 'topics/error-codes.mdx'), errorCodesPage(lang));
	write(resolve(base, 'gateway/opcodes.mdx'), opcodesPage(lang));
	write(resolve(base, 'gateway/close-codes.mdx'), closeCodesPage(lang));
}
