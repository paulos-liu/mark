const STORAGE_KEY = 'mark-settings';

const defaults = {
  theme: 'system',        // 'light' | 'dark' | 'system' — built-in palettes
  fontSize: 18,           // px
  contentWidth: 680,      // px max-width
  readFont: 'serif',      // 'serif' | 'sans' | 'mono'
  showCopyButton: true,   // show copy button on code blocks
  showFrontmatter: false, // show frontmatter metadata block
  customCSS: '',          // user-defined CSS injected into the document
  vscodeTheme: null,      // imported VS Code theme: { name, type, vars } | null
  sidebarOnStart: false,  // open the sidebar / table of contents on launch
};

const CONTENT_WIDTHS = [560, 680, 820, 9999];

/**
 * Normalize persisted values from older versions so every consumer
 * sees only canonical values (slider range 14–22, width presets).
 */
function migrate(s) {
  if (!CONTENT_WIDTHS.includes(s.contentWidth)) {
    // Old presets: 860 (Default) → 680, 1080 (Wide) → 820; anything else → default
    const legacy = { 860: 680, 1080: 820 };
    s.contentWidth = legacy[s.contentWidth] ?? defaults.contentWidth;
  }
  if (typeof s.fontSize !== 'number' || s.fontSize < 14 || s.fontSize > 22) {
    s.fontSize = Math.min(22, Math.max(14, Number(s.fontSize) || defaults.fontSize));
  }
  if (!['light', 'dark', 'system'].includes(s.theme)) {
    s.theme = defaults.theme;
  }
  return s;
}

function load() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return migrate({ ...defaults, ...JSON.parse(stored) });
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
 * Resolve the effective theme ('light' or 'dark') from settings + system preference.
 * @param {boolean} systemDark
 */
export function resolveTheme(systemDark) {
  if (settings.theme === 'system') return systemDark ? 'dark' : 'light';
  return settings.theme;
}
