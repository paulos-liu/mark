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
 * @property {Heading[]} children
 */

/**
 * Convert heading text to URL-safe anchor.
 * "My Heading (v2.0)" -> "my-heading-v2-0"
 * @param {string} text
 * @returns {string}
 */
export function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Extract headings from raw markdown and build hierarchical tree.
 * @param {string} markdown
 * @returns {Heading[]}
 */
export function extractHeadings(markdown) {
  const roots = [];
  const stack = [];
  const lines = markdown.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('#')) continue;

    // Count heading level
    let level = 0;
    while (level < trimmed.length && trimmed[level] === '#') level++;

    // Must be valid: level <= 6, followed by space, non-empty text
    if (level > 6 || level >= trimmed.length || trimmed[level] !== ' ') continue;

    const text = trimmed.slice(level + 1).trim();
    if (!text) continue;

    const heading = {
      id: crypto.randomUUID(),
      level,
      text,
      anchor: slugify(text),
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

/**
 * Flatten heading tree into a list (for search context).
 * @param {Heading[]} headings
 * @returns {Heading[]}
 */
export function flattenHeadings(headings) {
  const result = [];
  for (const h of headings) {
    result.push(h);
    if (h.children.length > 0) {
      result.push(...flattenHeadings(h.children));
    }
  }
  return result;
}

/**
 * Filter headings by search text, preserving ancestors of matches.
 * @param {Heading[]} headings
 * @param {string} query
 * @returns {Heading[]}
 */
export function filterHeadings(headings, query) {
  if (!query) return headings;
  const lower = query.toLowerCase();

  return headings.reduce((acc, heading) => {
    const matches = heading.text.toLowerCase().includes(lower);
    const filteredChildren = filterHeadings(heading.children, query);

    if (matches || filteredChildren.length > 0) {
      acc.push({ ...heading, children: filteredChildren });
    }
    return acc;
  }, []);
}
