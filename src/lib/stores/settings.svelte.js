const STORAGE_KEY = 'mark-settings';

const defaults = {
  theme: 'system',        // 'system' | 'light' | 'dark'
  fontSize: 16,           // px
  contentWidth: 860,      // px max-width
  showCopyButton: true,   // show copy button on code blocks
  showFrontmatter: true,  // show frontmatter metadata block
};

function load() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...defaults, ...JSON.parse(stored) };
  } catch {}
  return { ...defaults };
}

export const settings = $state(load());

export function updateSetting(key, value) {
  settings[key] = value;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {}
}

/**
 * Resolve the effective theme ('light' or 'dark') based on settings + system preference.
 * Call this reactively.
 */
export function resolveTheme(systemDark) {
  if (settings.theme === 'system') return systemDark ? 'dark' : 'light';
  return settings.theme;
}
