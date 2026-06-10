/**
 * Parse a VS Code color theme (JSON / JSONC) and map it onto Mark's CSS
 * custom properties. VS Code workbench colors drive the app surfaces/ink,
 * and TextMate `tokenColors` drive the syntax palette.
 *
 * @typedef {{ name: string, type: 'light' | 'dark', vars: Record<string, string> }} MarkTheme
 */

/**
 * Strip `//` and block comments and trailing commas from JSONC text so it can
 * be JSON.parsed. String contents are preserved (comment markers inside
 * strings are not treated as comments).
 * @param {string} text
 */
export function stripJsonc(text) {
  let out = '';
  let inStr = false;
  let strCh = '';
  let inLine = false;
  let inBlock = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const n = text[i + 1];
    if (inLine) {
      if (c === '\n') { inLine = false; out += c; }
      continue;
    }
    if (inBlock) {
      if (c === '*' && n === '/') { inBlock = false; i++; }
      continue;
    }
    if (inStr) {
      out += c;
      if (c === '\\') { out += text[++i] ?? ''; continue; }
      if (c === strCh) inStr = false;
      continue;
    }
    if (c === '"' || c === "'") { inStr = true; strCh = c; out += c; continue; }
    if (c === '/' && n === '/') { inLine = true; i++; continue; }
    if (c === '/' && n === '*') { inBlock = true; i++; continue; }
    // Drop a trailing comma sitting (with only whitespace) before a closer.
    // Done here, outside strings, so commas inside string values are safe.
    if (c === '}' || c === ']') out = out.replace(/,(\s*)$/, '$1');
    out += c;
  }
  return out;
}

/**
 * First defined value among the given color keys.
 * @param {Record<string, any>} colors
 * @param {...string} keys
 */
function pick(colors, ...keys) {
  for (const k of keys) {
    const v = colors[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

/**
 * Find a foreground color for the first scope base that matches a tokenColor
 * rule. Scopes match by exact name or dotted-prefix on either side.
 * @param {any[]} tokenColors
 * @param {string[]} bases
 */
function tokenColor(tokenColors, bases) {
  for (const base of bases) {
    for (const tc of tokenColors) {
      const fg = tc?.settings?.foreground;
      if (!fg) continue;
      const raw = tc.scope;
      const list = Array.isArray(raw)
        ? raw
        : typeof raw === 'string'
          ? raw.split(',')
          : [];
      for (const entry of list) {
        const s = entry.trim();
        if (s === base || s.startsWith(base + '.') || base.startsWith(s + '.')) {
          return fg.trim();
        }
      }
    }
  }
  return null;
}

/**
 * Convert a parsed VS Code theme object into a MarkTheme, or null if it does
 * not look like a theme.
 * @param {any} theme
 * @returns {MarkTheme | null}
 */
export function vscodeThemeToVars(theme) {
  if (!theme || typeof theme !== 'object') return null;
  const colors = theme.colors && typeof theme.colors === 'object' ? theme.colors : {};
  const tokens = Array.isArray(theme.tokenColors) ? theme.tokenColors : [];
  if (Object.keys(colors).length === 0 && tokens.length === 0) return null;

  const type = theme.type === 'light' ? 'light' : 'dark';

  const paper = pick(colors, 'editor.background') ?? (type === 'dark' ? '#1e1e1e' : '#ffffff');
  const ink = pick(colors, 'editor.foreground', 'foreground') ?? (type === 'dark' ? '#d4d4d4' : '#272320');

  // Elevation steps: mix ink into paper for surfaces/lines when the theme
  // doesn't define a dedicated workbench color.
  const elev = (/** @type {number} */ pct) =>
    `color-mix(in oklch, ${ink} ${pct}%, ${paper})`;

  const surface = pick(colors, 'sideBar.background', 'editorGroupHeader.tabsBackground', 'activityBar.background') ?? elev(5);
  const surface2 = pick(colors, 'input.background', 'list.hoverBackground', 'editorWidget.background') ?? elev(11);
  const surfaceHi = pick(colors, 'editorWidget.background', 'dropdown.background', 'quickInput.background') ?? (type === 'dark' ? elev(8) : paper);
  const line = pick(colors, 'editorGroup.border', 'panel.border', 'sideBar.border') ?? elev(15);
  const line2 = pick(colors, 'input.border', 'dropdown.border', 'contrastBorder') ?? elev(24);

  const ink2 = pick(colors, 'descriptionForeground', 'sideBar.foreground') ?? elev(72);
  const ink3 = pick(colors, 'editorLineNumber.foreground', 'disabledForeground') ?? elev(50);

  const accent = pick(colors, 'textLink.foreground', 'button.background', 'focusBorder', 'activityBarBadge.background', 'progressBar.background') ?? '#c2683f';
  const accentInk = pick(colors, 'button.foreground') ?? '#ffffff';

  const codeBg = pick(colors, 'textCodeBlock.background', 'textBlockQuote.background') ?? elev(6);

  const tok = (/** @type {string[]} */ bases, /** @type {string} */ fallback) =>
    tokenColor(tokens, bases) ?? fallback;

  /** @type {Record<string, string>} */
  const vars = {
    '--paper': paper,
    '--surface': surface,
    '--surface-2': surface2,
    '--surface-hi': surfaceHi,
    '--ink': ink,
    '--ink-2': ink2,
    '--ink-3': ink3,
    '--line': line,
    '--line-2': line2,
    '--code-bg': codeBg,
    '--code-ink': ink,
    '--accent': accent,
    '--accent-ink': accentInk,
    '--accent-soft': `color-mix(in oklch, ${accent} ${type === 'dark' ? 24 : 16}%, transparent)`,
    '--accent-line': `color-mix(in oklch, ${accent} ${type === 'dark' ? 46 : 38}%, transparent)`,
    '--tok-key': tok(['keyword', 'storage', 'keyword.control'], accent),
    '--tok-str': tok(['string'], ink),
    '--tok-num': tok(['constant.numeric', 'constant'], ink),
    '--tok-fn': tok(['entity.name.function', 'support.function'], ink),
    '--tok-com': tok(['comment'], ink3),
    '--tok-attr': tok(['variable', 'entity.name.tag', 'support.type'], ink2),
    '--tok-punc': tok(['punctuation'], ink3),
    '--shadow-rgb': type === 'dark' ? '0 0 0' : '30 25 18',
    'color-scheme': type,
  };

  return { name: typeof theme.name === 'string' ? theme.name : 'Imported theme', type, vars };
}

/**
 * Parse JSONC theme text into a MarkTheme.
 * @param {string} text
 * @returns {MarkTheme | null}
 */
export function parseVscodeTheme(text) {
  let obj;
  try {
    obj = JSON.parse(stripJsonc(text));
  } catch {
    return null;
  }
  return vscodeThemeToVars(obj);
}
