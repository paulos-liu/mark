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
