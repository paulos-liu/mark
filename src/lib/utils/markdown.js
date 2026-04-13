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
 * Render markdown string to HTML.
 * @param {string} content
 * @returns {string}
 */
export function renderMarkdown(content) {
  anchorCounts = {};
  return marked.parse(content);
}
