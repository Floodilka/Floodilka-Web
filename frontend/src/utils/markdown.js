import SimpleMarkdown from 'simple-markdown';
import DOMPurify from 'dompurify';
import Prism from 'prismjs';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import localizedFormat from 'dayjs/plugin/localizedFormat';

import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-csharp';

dayjs.extend(relativeTime);
dayjs.extend(localizedFormat);

const escapeHtml = (value) => {
  const text = value == null ? '' : String(value);

  if (typeof SimpleMarkdown.sanitizeText === 'function') {
    return SimpleMarkdown.sanitizeText(text);
  }

  return text.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
    case '&':
      return '&amp;';
    case '<':
      return '&lt;';
    case '>':
      return '&gt;';
    case '"':
      return '&quot;';
    case '\'':
      return '&#39;';
    default:
      return ch;
    }
  });
};

const sanitizeLanguage = (rawLang) => {
  if (!rawLang) {
    return 'plaintext';
  }

  return rawLang
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9#+-]/g, '');
};

const highlightCode = (code, language) => {
  const prismLanguage = Prism.languages[language];

  if (!prismLanguage) {
    return escapeHtml(code);
  }

  return Prism.highlight(code, prismLanguage, language);
};

const FORMAT_STYLES = {
  t: 'HH:mm',
  T: 'HH:mm:ss',
  d: 'MM/DD/YYYY',
  D: 'MMMM D, YYYY',
  f: 'MMMM D, YYYY h:mm A',
  F: 'dddd, MMMM D, YYYY h:mm A'
};

const DEFAULT_TOOLTIP_FORMAT = 'dddd, MMMM D, YYYY h:mm A';

const formatTimestamp = (timestamp, style) => {
  const time = dayjs.unix(Number(timestamp));
  if (!time.isValid()) {
    return null;
  }

  const normalizedStyle = style || 'f';

  if (normalizedStyle === 'R') {
    return {
      text: time.fromNow(),
      tooltip: time.format(DEFAULT_TOOLTIP_FORMAT)
    };
  }

  const formatPattern = FORMAT_STYLES[normalizedStyle] || FORMAT_STYLES.f;

  return {
    text: time.format(formatPattern),
    tooltip: time.format(DEFAULT_TOOLTIP_FORMAT)
  };
};

const normalizeLegacyPreBlocks = (source) => source.replace(/<pre>([\s\S]*?)<\/pre>/gi, (match, inner) => {
  const content = inner.trim();
  if (!content) {
    return '';
  }

  const fenceMatch = /^```([a-z0-9#+-]*)?\s*([\s\S]*?)\s*```$/i.exec(content);

  if (fenceMatch) {
    const [, rawLang = '', body = ''] = fenceMatch;
    const language = rawLang.trim();
    const normalizedBody = body.replace(/^\s+|\s+$/g, '');
    const langHeader = language ? `${language}\n` : '';
    return `\`\`\`${langHeader}${normalizedBody}\n\`\`\``;
  }

  return `\`\`\`\n${content}\n\`\`\``;
});

const normalizeQuoteLines = (source) => {
  const segments = source.split(/(```[\s\S]*?```)/g);

  return segments
    .map((segment, index) => {
      // Skip normalization inside fenced code blocks
      if (index % 2 === 1) {
        return segment;
      }

      return segment
        .split(/\r?\n/)
        .map((line) => {
          if (!line.startsWith('>')) {
            return line;
          }

          if (/^>+\s/.test(line)) {
            const content = line.replace(/^>+\s*/, '');
            return `> ${content}`;
          }

          if (/^>+\S/.test(line)) {
            return line.replace(/^>+/, (markers) =>
              markers
                .split('')
                .map(() => '\\>')
                .join('')
            );
          }

          return line;
        })
        .join('\n');
    })
    .join('');
};

const defaultTextOrder = SimpleMarkdown.defaultRules.text?.order ?? 0;
const emOrder = SimpleMarkdown.defaultRules.em?.order ?? 0;
const strikethroughOrder = SimpleMarkdown.defaultRules.del?.order ?? emOrder + 1;

const spoilerRule = {
  order: Math.min(emOrder, strikethroughOrder) - 0.1,
  match: SimpleMarkdown.inlineRegex(/^\|\|([\s\S]+?)\|\|(?!\|)/),
  parse: (capture, parse, state) => ({
    type: 'spoiler',
    content: parse(capture[1], state)
  }),
  html: (node, output, state) => `<span class="md-spoiler" data-spoiler="hidden">${output(node.content, state)}</span>`
};

const mentionRule = {
  order: defaultTextOrder - 0.5,
  match: SimpleMarkdown.inlineRegex(/^@([a-zA-Z0-9_]+)(?!\w)/),
  parse: (capture, parse, state) => {
    const normalized = capture[1]?.toLowerCase?.() ?? '';
    const mentionMap = state.mentionMap || {};
    const mention = mentionMap[normalized] || null;
    const isEveryone = normalized === 'everyone';
    const isSelf = normalized && normalized === state.currentUsername;
    const isKnown = !!mention || isEveryone || isSelf;

    return {
      type: 'mention',
      raw: capture[0],
      normalized,
      mention,
      isEveryone,
      isSelf,
      isKnown
    };
  },
  html: (node) => {
    if (!node.isKnown) {
      return escapeHtml(node.raw);
    }

    const classes = ['message-mention'];
    if (!node.isEveryone) {
      classes.push('mention-clickable');
    }
    if (node.isSelf) {
      classes.push('mention-current-user');
    }
    if (node.isEveryone) {
      classes.push('mention-everyone');
    }

    const username = node.mention?.username || node.normalized || node.raw.slice(1);
    const display = node.mention?.displayName || username;
    const dataAttrs = [`data-mention="${escapeHtml(username)}"`];

    if (node.mention?.id) {
      dataAttrs.push(`data-mention-id="${escapeHtml(String(node.mention.id))}"`);
    }

    const titleAttr = `title="${escapeHtml(display)}"`;
    dataAttrs.push('data-mention-type="user"');
    return `<span class="${classes.join(' ')}" ${dataAttrs.join(' ')} ${titleAttr}>${escapeHtml(node.raw)}</span>`;
  }
};

const customEmojiRule = {
  order: defaultTextOrder - 0.6,
  match: SimpleMarkdown.inlineRegex(/^<a?:([a-zA-Z0-9_]{2,32}):([0-9]{2,})>/),
  parse: (capture) => {
    const name = capture[1];
    const id = capture[2];
    const animated = capture[0].startsWith('<a:');
    return {
      type: 'customEmoji',
      name,
      id,
      animated
    };
  },
  html: (node) => {
    const safeName = escapeHtml(node.name);
    const safeId = escapeHtml(node.id);
    const extension = node.animated ? 'gif' : 'png';
    const src = `https://cdn.discordapp.com/emojis/${safeId}.${extension}`;
    const classes = ['md-custom-emoji'];
    return `<img class="${classes.join(' ')}" src="${src}" alt=":${safeName}:" draggable="false" data-emoji-id="${safeId}" data-emoji-animated="${node.animated ? 'true' : 'false'}" loading="lazy" />`;
  }
};

const roleMentionRule = {
  order: defaultTextOrder - 0.55,
  match: SimpleMarkdown.inlineRegex(/^<@&([0-9]{2,})>/),
  parse: (capture, parse, state) => {
    const id = capture[1];
    return {
      type: 'roleMention',
      id,
      raw: capture[0],
      name: state.roleMap?.[id]?.name || null
    };
  },
  html: (node, output, state) => {
    const role = state.roleMap?.[node.id];
    const displayName = role?.name || 'Удалённая роль';
    return `<span class="message-mention mention-role mention-clickable" data-mention="${escapeHtml(displayName)}" data-mention-id="${escapeHtml(node.id)}" data-mention-type="role" data-role-id="${escapeHtml(node.id)}">@${escapeHtml(displayName)}</span>`;
  }
};

const channelMentionRule = {
  order: defaultTextOrder - 0.54,
  match: SimpleMarkdown.inlineRegex(/^<#([0-9a-zA-Z]{2,})>/),
  parse: (capture, parse, state) => {
    const id = capture[1];
    return {
      type: 'channelMention',
      id,
      raw: capture[0],
      name: state.channelMap?.[id]?.name || null
    };
  },
  html: (node, output, state) => {
    const channel = state.channelMap?.[node.id];
    if (!channel) {
      return `<span class="message-mention mention-channel mention-clickable mention-channel-unknown" data-mention="#неизвестно" data-mention-id="${escapeHtml(node.id)}" data-mention-type="channel" data-channel-id="${escapeHtml(node.id)}" data-channel-unknown="true">#неизвестно</span>`;
    }

    const displayName = channel.name ? `#${channel.name}` : '#неизвестно';
    return `<span class="message-mention mention-channel mention-clickable" data-mention="${escapeHtml(displayName)}" data-mention-id="${escapeHtml(node.id)}" data-mention-type="channel" data-channel-id="${escapeHtml(node.id)}">${escapeHtml(displayName)}</span>`;
  }
};

const channelNameRule = {
  order: defaultTextOrder - 0.53,
  match: SimpleMarkdown.inlineRegex(/^#([^\s#]+)/),
  parse: (capture, parse, state) => {
    const name = capture[1];
    const channel = state.channelNameMap?.[name?.toLowerCase?.()] || null;
    return {
      type: 'channelNameMention',
      raw: capture[0],
      name,
      channel
    };
  },
  html: (node) => {
    if (!node.channel) {
      return escapeHtml(node.raw);
    }

    const id = node.channel.id;
    const displayName = node.channel.name || node.name;
    return `<span class="message-mention mention-channel mention-clickable" data-mention="#${escapeHtml(displayName)}" data-mention-id="${escapeHtml(String(id))}" data-mention-type="channel" data-channel-id="${escapeHtml(String(id))}">#${escapeHtml(displayName)}</span>`;
  }
};

const timestampRule = {
  order: defaultTextOrder - 0.53,
  match: SimpleMarkdown.inlineRegex(/^<t:(-?\d{1,}):?([tTdDfFR])?>/),
  parse: (capture) => ({
    type: 'timestamp',
    raw: capture[0],
    timestamp: capture[1],
    style: capture[2] || undefined
  }),
  html: (node) => {
    const formatted = formatTimestamp(node.timestamp, node.style);
    if (!formatted) {
      return escapeHtml(node.raw);
    }

    const titleAttr = formatted.tooltip ? ` title="${escapeHtml(formatted.tooltip)}"` : '';
    const styleAttr = node.style ? ` data-timestamp-style="${escapeHtml(node.style)}"` : '';
    return `<span class="md-timestamp"${titleAttr} data-timestamp="${escapeHtml(String(node.timestamp))}"${styleAttr}>${escapeHtml(formatted.text)}</span>`;
  }
};

const createRules = () => {
  const rules = {
    ...SimpleMarkdown.defaultRules,
    spoiler: spoilerRule,
    customEmoji: customEmojiRule,
    roleMention: roleMentionRule,
    channelMention: channelMentionRule,
    channelNameMention: channelNameRule,
    timestamp: timestampRule,
    mention: mentionRule,
    heading: {
      ...SimpleMarkdown.defaultRules.heading,
      match: SimpleMarkdown.blockRegex(/^ *(#{1,6})[ \t]+([^\n]+?)(?:\n+|$)/)
    },
    u: {
      ...SimpleMarkdown.defaultRules.u,
      html: (node, output, state) => `<span class="md-underline">${output(node.content, state)}</span>`
    },
    codeBlock: {
      ...SimpleMarkdown.defaultRules.codeBlock,
      html: (node) => {
        const language = sanitizeLanguage(node.lang);
        const highlighted = highlightCode(node.content, language);
        const languageClass = `language-${language}`;

        return `<pre class="md-code-block"><code class="${languageClass}">${highlighted}</code></pre>`;
      }
    },
    fence: {
      ...SimpleMarkdown.defaultRules.fence,
      html: (node, output, state) => {
        const language = sanitizeLanguage(node.lang);
        const highlighted = highlightCode(node.content, language);
        const languageClass = `language-${language}`;

        return `<pre class="md-code-block"><code class="${languageClass}">${highlighted}</code></pre>`;
      }
    },
    link: {
      ...SimpleMarkdown.defaultRules.link,
      html: (node, output, state) => {
        const content = output(node.content, state);
        const href = escapeHtml(node.target);
        const title = node.title ? ` title="${escapeHtml(node.title)}"` : '';
        return `<a class="md-link" href="${href}" target="_blank" rel="noopener noreferrer"${title}>${content}</a>`;
      }
    },
    autolink: {
      ...SimpleMarkdown.defaultRules.autolink,
      html: (node) => {
        const href = escapeHtml(node.target);
        return `<a class="md-link" href="${href}" target="_blank" rel="noopener noreferrer">${escapeHtml(node.target)}</a>`;
      }
    },
    blockQuote: {
      ...SimpleMarkdown.defaultRules.blockQuote,
      html: (node, output, state) => `<blockquote class="md-quote">${output(node.content, state)}</blockquote>`
    },
    list: {
      ...SimpleMarkdown.defaultRules.list,
      html: (node, output, state) => {
        const tag = node.ordered ? 'ol' : 'ul';
        return `<${tag} class="md-list">${node.items.map(item => `<li>${output(item, state)}</li>`).join('')}</${tag}>`;
      }
    },
    paragraph: {
      ...SimpleMarkdown.defaultRules.paragraph,
      html: (node, output, state) => `<p class="md-paragraph">${output(node.content, state)}</p>`
    }
  };

  // Disable raw HTML tags for safety
  rules.htmlTag = {
    ...SimpleMarkdown.defaultRules.htmlTag,
    match: () => null
  };

  return rules;
};

const rules = createRules();
const parseMarkdown = SimpleMarkdown.parserFor(rules);
const htmlOutput = SimpleMarkdown.outputFor(rules, 'html');

export const markdownToSanitizedHtml = (source, options = {}) => {
  if (!source || typeof source !== 'string') {
    return '';
  }

  const normalizedSource = normalizeQuoteLines(normalizeLegacyPreBlocks(source));

  const mentionMap = {};
  if (Array.isArray(options.mentions)) {
    options.mentions.forEach((mention) => {
      const key = (mention?.username || mention?.name || '').toLowerCase();
      if (key) {
        mentionMap[key] = mention;
      }
      if (mention?.id) {
        mentionMap[String(mention.id).toLowerCase()] = mention;
      }
    });
  }

  const roleMap = {};
  if (Array.isArray(options.roles)) {
    options.roles.forEach((role) => {
      const id = role?.id ?? role?._id ?? role?.roleId ?? role?.role?.id;
      if (!id) return;
      roleMap[String(id)] = {
        id: String(id),
        name: role?.name || role?.roleName || role?.displayName || role?.label || `Роль ${id}`
      };
    });
  }

  const channelMap = {};
  const channelNameMap = {};
  if (Array.isArray(options.channels)) {
    options.channels.forEach((channel) => {
      const id = channel?.id ?? channel?._id ?? channel?.channelId;
      if (!id) return;
      channelMap[String(id)] = {
        id: String(id),
        name: channel?.name || channel?.channelName || channel?.displayName || `канал-${id}`
      };
      const nameKey = (channel?.name || channel?.channelName || channel?.displayName || '').toLowerCase();
      if (nameKey) {
        channelNameMap[nameKey] = channelMap[String(id)];
      }
    });
  }

  const state = {
    inline: false,
    mentionMap,
    roleMap,
    channelMap,
    channelNameMap,
    currentUsername: options.currentUsername ? options.currentUsername.toLowerCase() : undefined
  };

  const ast = parseMarkdown(normalizedSource + '\n\n', state);
  const html = htmlOutput(ast, state);

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['a', 'b', 'blockquote', 'br', 'code', 'del', 'div', 'em', 'i', 'img', 'li', 'ol', 'p', 'pre', 'span', 'strong', 'u', 'ul'],
    ALLOWED_ATTR: [
      'class',
      'href',
      'rel',
      'target',
      'title',
      'data-mention',
      'data-mention-id',
      'data-mention-type',
      'data-spoiler',
      'src',
      'alt',
      'draggable',
      'data-emoji-id',
      'data-emoji-animated',
      'loading',
      'data-role-id',
      'data-channel-id',
      'data-timestamp',
      'data-timestamp-style'
    ]
  });
};

export default markdownToSanitizedHtml;
