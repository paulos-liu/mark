const STORAGE_KEY = 'mark-scroll-positions';
const MAX_ENTRIES = 100;

/** @returns {Record<string, number>} */
function load() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return {};
}

/** @param {Record<string, number>} map */
function save(map) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {}
}

/**
 * @param {string} filePath
 * @returns {number}
 */
export function getScrollPosition(filePath) {
  if (!filePath) return 0;
  return load()[filePath] ?? 0;
}

/**
 * @param {string} filePath
 * @param {number} scrollTop
 */
export function saveScrollPosition(filePath, scrollTop) {
  if (!filePath) return;
  const map = load();

  // Delete before reinserting so the key moves to the end (most recently used).
  // This keeps Object.keys() order as LRU — keys[0] is always the least recently used.
  if (filePath in map) {
    delete map[filePath];
  } else if (Object.keys(map).length >= MAX_ENTRIES) {
    // Evict the least recently used entry
    delete map[Object.keys(map)[0]];
  }

  map[filePath] = scrollTop;
  save(map);
}
