import SimpleMarkdown from 'simple-markdown';
import DOMPurify from 'dompurify';
import Prism from 'prismjs';

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

const mentionRule = {
  order: defaultTextOrder - 0.5,
  match: SimpleMarkdown.inlineRegex(/^@([a-zA-Z0-9_]+)(?!\w)/),
  parse: (capture, parse, state) => {
    const normalized = capture[1]?.toLowerCase?.() ?? '';
    const mentionMap = state.mentionMap || {};
    const mention = mentionMap[normalized] || null;
    const isEveryone = normalized === 'everyone';
    const isSelf = normalized && normalized === state.currentUsername;

    return {
      type: 'mention',
      raw: capture[0],
      normalized,
      mention,
      isEveryone,
      isSelf
    };
  },
  html: (node) => {
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
    return `<span class="${classes.join(' ')}" ${dataAttrs.join(' ')} ${titleAttr}>${escapeHtml(node.raw)}</span>`;
  }
};

const createRules = () => {
  const rules = {
    ...SimpleMarkdown.defaultRules,
    mention: mentionRule,
    inlineCode: {
      ...SimpleMarkdown.defaultRules.inlineCode,
      html: (node) => `<code class="md-inline-code">${escapeHtml(node.content)}</code>`
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

  const state = {
    inline: false,
    mentionMap,
    currentUsername: options.currentUsername ? options.currentUsername.toLowerCase() : undefined
  };

  const ast = parseMarkdown(normalizedSource + '\n\n', state);
  const html = htmlOutput(ast, state);

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['a', 'b', 'blockquote', 'br', 'code', 'del', 'div', 'em', 'i', 'li', 'ol', 'p', 'pre', 'span', 'strong', 'u', 'ul'],
    ALLOWED_ATTR: [
      'class',
      'href',
      'rel',
      'target',
      'title',
      'data-mention',
      'data-mention-id'
    ]
  });
};

export default markdownToSanitizedHtml;
