import { Marked } from 'marked';
import DOMPurify from 'dompurify';
import { slugify } from './headings.js';

const marked = new Marked();

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
 * Uses DOMPurify to prevent XSS from malicious markdown content.
 * @param {string} content
 * @returns {string}
 */
export function renderMarkdown(content) {
  anchorCounts = {};
  const rawHtml = /** @type {string} */ (marked.parse(content));
  return DOMPurify.sanitize(rawHtml, {
    ADD_ATTR: ['id'],         // Allow id attributes (needed for heading anchors)
    ADD_TAGS: ['mark'],       // Allow mark elements (used by search highlighting)
  });
}
