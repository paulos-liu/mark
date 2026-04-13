import { flattenHeadings } from '../utils/headings.js';

export const searchState = $state({
  searchText: '',
  matches: [],
  currentMatchIndex: 0,
});

/** Maximum number of matches to track to prevent UI freezing */
const MAX_MATCHES = 10000;

/**
 * Compute all match positions for the given text.
 * @param {string} content - Raw markdown content
 * @param {string} query - Search text
 */
export function computeMatches(content, query) {
  if (!query || !query.trim()) {
    searchState.matches = [];
    searchState.currentMatchIndex = 0;
    return;
  }

  const lower = content.toLowerCase();
  const search = query.toLowerCase();
  const positions = [];
  let start = 0;

  while (positions.length < MAX_MATCHES) {
    const idx = lower.indexOf(search, start);
    if (idx === -1) break;
    positions.push(idx);
    start = idx + 1;
  }

  searchState.matches = positions;
  searchState.currentMatchIndex = 0;
}

export function nextMatch() {
  if (searchState.matches.length === 0) return;
  searchState.currentMatchIndex =
    (searchState.currentMatchIndex + 1) % searchState.matches.length;
}

export function prevMatch() {
  if (searchState.matches.length === 0) return;
  searchState.currentMatchIndex =
    (searchState.currentMatchIndex - 1 + searchState.matches.length) %
    searchState.matches.length;
}

/**
 * Find the heading anchor that appears before the current match.
 * Uses line-based position tracking for accurate heading location.
 * @param {string} content
 * @param {import('../utils/headings.js').Heading[]} headings
 * @returns {string|null}
 */
export function getCurrentMatchHeading(content, headings) {
  if (searchState.matches.length === 0) return null;
  const matchPos = searchState.matches[searchState.currentMatchIndex];
  const allHeadings = flattenHeadings(headings);

  // Build a map of heading text to its position as a markdown heading line,
  // not just any occurrence of that text in the document.
  const lines = content.split('\n');
  let closest = null;
  let closestPos = -1;
  let charOffset = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#')) {
      // Extract heading text from line
      let level = 0;
      while (level < trimmed.length && trimmed[level] === '#') level++;
      if (level <= 6 && level < trimmed.length && trimmed[level] === ' ') {
        const headingText = trimmed.slice(level + 1).trim();
        // Find the matching heading object
        const match = allHeadings.find(
          (h) => h.text === headingText && h.level === level
        );
        if (match && charOffset <= matchPos && charOffset > closestPos) {
          closest = match;
          closestPos = charOffset;
        }
      }
    }
    charOffset += line.length + 1; // +1 for newline
  }

  return closest?.anchor ?? null;
}
