import { flattenHeadings } from '../utils/headings.js';

export const searchState = $state({
  searchText: '',
  matches: [],
  currentMatchIndex: 0,
});

/**
 * Compute all match positions for the given text.
 * @param {string} content - Raw markdown content
 * @param {string} query - Search text
 */
export function computeMatches(content, query) {
  if (!query) {
    searchState.matches = [];
    searchState.currentMatchIndex = 0;
    return;
  }

  const lower = content.toLowerCase();
  const search = query.toLowerCase();
  const positions = [];
  let start = 0;

  while (true) {
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
 * @param {string} content
 * @param {import('../utils/headings.js').Heading[]} headings
 * @returns {string|null}
 */
export function getCurrentMatchHeading(content, headings) {
  if (searchState.matches.length === 0) return null;
  const matchPos = searchState.matches[searchState.currentMatchIndex];
  const allHeadings = flattenHeadings(headings);
  const lower = content.toLowerCase();

  let closest = null;
  let closestPos = -1;

  for (const h of allHeadings) {
    const idx = lower.indexOf(h.text.toLowerCase());
    if (idx !== -1 && idx < matchPos && idx > closestPos) {
      closest = h;
      closestPos = idx;
    }
  }

  return closest?.anchor ?? null;
}
