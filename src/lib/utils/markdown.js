import DOMPurify from 'dompurify';
import { Marked } from 'marked';
import katex from 'katex';
import { slugify } from './headings.js';

const marked = new Marked();

// KaTeX marked extension: renders $$...$$ (block) and $...$ (inline) math
marked.use({
  extensions: [
    {
      name: 'mathBlock',
      level: 'block',
      start(src) { return src.indexOf('$$'); },
      tokenizer(src) {
        const match = src.match(/^\$\$([^$]+?)\$\$/s);
        if (match) return { type: 'mathBlock', raw: match[0], text: match[1].trim() };
      },
      renderer(token) {
        try {
          return katex.renderToString(token.text, { displayMode: true, throwOnError: false });
        } catch {
          return `<span class="katex-error">${token.text}</span>`;
        }
      },
    },
    {
      name: 'mathInline',
      level: 'inline',
      start(src) { return src.indexOf('$'); },
      tokenizer(src) {
        const match = src.match(/^\$([^$\n]+?)\$/);
        if (match) return { type: 'mathInline', raw: match[0], text: match[1].trim() };
      },
      renderer(token) {
        try {
          return katex.renderToString(token.text, { displayMode: false, throwOnError: false });
        } catch {
          return `<span class="katex-error">${token.text}</span>`;
        }
      },
    },
  ],
});

// Track duplicate anchors per render to make them unique
/** @type {Record<string, number>} */
let anchorCounts = {};

marked.use({
  renderer: {
    heading({ tokens, depth }) {
      const text = tokens.map(t => t.raw).join('');
      let anchor = slugify(text);

      // Handle duplicate anchors
      if (anchorCounts[anchor] != null) {
        anchorCounts[anchor]++;
        anchor = `${anchor}-${anchorCounts[anchor]}`;
      } else {
        anchorCounts[anchor] = 0;
      }

      const inline = this.parser.parseInline(tokens);
      return `<h${depth} id="${anchor}">${inline}</h${depth}>`;
    },
  },
  gfm: true,
  breaks: false,
  async: false,
});

/**
 * Render markdown string to sanitized HTML.
 * Uses DOMPurify to prevent XSS from malicious markdown files.
 * @param {string} content
 * @returns {string}
 */
export function renderMarkdown(content) {
  anchorCounts = {};
  const rawHtml = /** @type {string} */ (marked.parse(content));
  return DOMPurify.sanitize(rawHtml, {
    ADD_ATTR: ['id', 'aria-hidden'],  // id for anchors; aria-hidden for KaTeX
    ADD_TAGS: ['mark'],               // Allow mark elements for search highlighting
  });
}
