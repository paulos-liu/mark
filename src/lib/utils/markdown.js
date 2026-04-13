import DOMPurify from 'dompurify';
import { Marked } from 'marked';
import { slugify } from './headings.js';

const marked = new Marked();

// Track duplicate anchors per render to make them unique
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
});

/**
 * Render markdown string to sanitized HTML.
 * Uses DOMPurify to prevent XSS from malicious markdown files.
 * @param {string} content
 * @returns {string}
 */
export function renderMarkdown(content) {
  anchorCounts = {};
  const rawHtml = marked.parse(content);
  return DOMPurify.sanitize(rawHtml, {
    // Allow id attributes for heading anchor scroll-to
    ADD_ATTR: ['id'],
    // Allow standard markdown HTML elements
    ADD_TAGS: ['mark'],
  });
}
