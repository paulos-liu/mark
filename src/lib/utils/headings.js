/**
 * Heading extraction and hierarchy building.
 * Ported from MarkdownProcessor.swift — stack-based algorithm.
 */

/**
 * @typedef {Object} Heading
 * @property {string} id
 * @property {number} level
 * @property {string} text
 * @property {string} anchor
 * @property {number} line  1-based line number (plus `lineOffset`) of the heading
 * @property {Heading[]} children
 */

/**
 * Convert heading text to URL-safe anchor.
 * Supports unicode characters (CJK, accented letters, etc.)
 * "My Heading (v2.0)" -> "my-heading-v20"
 * @param {string} text
 * @returns {string}
 */
export function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    // Remove HTML tags that may appear in heading text
    .replace(/<[^>]*>/g, '')
    // Replace whitespace and separator chars with hyphens
    .replace(/[\s\-_]+/g, '-')
    // Remove characters that are not word chars, hyphens, or unicode letters/numbers
    .replace(/[^\p{L}\p{N}\-]/gu, '')
    // Collapse multiple hyphens
    .replace(/-{2,}/g, '-')
    // Strip leading/trailing hyphens
    .replace(/^-|-$/g, '');
}

/**
 * Extract headings from raw markdown and build hierarchical tree.
 * Ignores headings inside fenced code blocks.
 * @param {string} markdown
 * @param {number} [lineOffset=0] added to each heading's 1-based line number, so
 *   headings parsed from frontmatter-stripped body still point at the right line
 *   in the original buffer (used by the editor's TOC navigation).
 * @returns {Heading[]}
 */
export function extractHeadings(markdown, lineOffset = 0) {
  const roots = [];
  const stack = [];
  const lines = markdown.split('\n');
  let inCodeBlock = false;
  // Dedupe anchors with the same counter scheme as the markdown.js heading
  // renderer, so TOC anchors always match the rendered DOM ids.
  /** @type {Record<string, number>} */
  const anchorCounts = {};

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    // Track fenced code blocks (``` or ~~~)
    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    if (!trimmed.startsWith('#')) continue;

    // Count heading level
    let level = 0;
    while (level < trimmed.length && trimmed[level] === '#') level++;

    // Must be valid: level <= 6, followed by space, non-empty text
    if (level > 6 || level >= trimmed.length || trimmed[level] !== ' ') continue;

    const text = trimmed.slice(level + 1).trim();
    if (!text) continue;

    let anchor = slugify(text);
    if (anchorCounts[anchor] != null) {
      anchorCounts[anchor]++;
      anchor = `${anchor}-${anchorCounts[anchor]}`;
    } else {
      anchorCounts[anchor] = 0;
    }

    const heading = {
      id: crypto.randomUUID(),
      level,
      text,
      anchor,
      line: i + 1 + lineOffset,
      children: [],
    };

    // Pop stack until we find a parent with smaller level
    while (stack.length > 0 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }

    if (stack.length === 0) {
      roots.push(heading);
    } else {
      stack[stack.length - 1].children.push(heading);
    }

    stack.push(heading);
  }

  return roots;
}
