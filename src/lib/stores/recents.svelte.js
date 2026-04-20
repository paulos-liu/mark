const STORAGE_KEY = 'mark-recent-files';
const MAX_RECENTS = 20;

/** @returns {string[]} */
function load() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return [];
}

/** @param {string[]} list */
function save(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {}
}

export const recentFiles = $state(load());

/** @param {string} filePath */
export function addRecent(filePath) {
  if (!filePath) return;
  const idx = recentFiles.indexOf(filePath);
  if (idx !== -1) recentFiles.splice(idx, 1);
  recentFiles.unshift(filePath);
  if (recentFiles.length > MAX_RECENTS) recentFiles.splice(MAX_RECENTS);
  save([...recentFiles]);
}
