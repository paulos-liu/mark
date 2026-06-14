export const searchState = $state({
  searchText: '',
  /**
   * Total number of matches in the rendered document. Counted from the DOM by
   * the viewer (via `setMatchCount`) so the titlebar count and the highlighted
   * `<mark>` elements always come from the same source and cannot disagree.
   */
  matchCount: 0,
  currentMatchIndex: 0,
});

/**
 * Record the match count reported by the rendered view.
 * @param {number} count
 */
export function setMatchCount(count) {
  searchState.matchCount = count;
}

export function nextMatch() {
  if (searchState.matchCount === 0) return;
  searchState.currentMatchIndex =
    (searchState.currentMatchIndex + 1) % searchState.matchCount;
}

export function prevMatch() {
  if (searchState.matchCount === 0) return;
  searchState.currentMatchIndex =
    (searchState.currentMatchIndex - 1 + searchState.matchCount) %
    searchState.matchCount;
}
