import { describe, it, expect } from 'vitest';
import { stripJsonc, parseVscodeTheme, vscodeThemeToVars } from './vscodeTheme.js';

describe('stripJsonc', () => {
  it('removes line and block comments and trailing commas', () => {
    const src = `{
      // a comment
      "a": 1, /* block */
      "b": 2,
    }`;
    expect(JSON.parse(stripJsonc(src))).toEqual({ a: 1, b: 2 });
  });

  it('preserves comment-like sequences inside strings', () => {
    const src = '{ "url": "https://x.y//z", "note": "/* keep */" }';
    expect(JSON.parse(stripJsonc(src))).toEqual({
      url: 'https://x.y//z',
      note: '/* keep */',
    });
  });

  it('does not strip commas inside string values that look like trailing commas', () => {
    const src = '{ "a": "foo,]", "b": ["x,}"] }';
    expect(JSON.parse(stripJsonc(src))).toEqual({ a: 'foo,]', b: ['x,}'] });
  });
});

describe('vscodeThemeToVars', () => {
  const theme = {
    name: 'Test Dark',
    type: 'dark',
    colors: {
      'editor.background': '#282a36',
      'editor.foreground': '#f8f8f2',
      'sideBar.background': '#21222c',
      'textLink.foreground': '#bd93f9',
    },
    tokenColors: [
      { scope: 'comment', settings: { foreground: '#6272a4' } },
      { scope: ['string', 'string.quoted'], settings: { foreground: '#f1fa8c' } },
      { scope: 'keyword, storage.type', settings: { foreground: '#ff79c6' } },
    ],
  };

  it('maps workbench colors onto the app palette', () => {
    const out = vscodeThemeToVars(theme);
    expect(out.type).toBe('dark');
    expect(out.name).toBe('Test Dark');
    expect(out.vars['--paper']).toBe('#282a36');
    expect(out.vars['--ink']).toBe('#f8f8f2');
    expect(out.vars['--surface']).toBe('#21222c');
    expect(out.vars['--accent']).toBe('#bd93f9');
    expect(out.vars['color-scheme']).toBe('dark');
  });

  it('maps token scopes (string and comma-joined) to --tok vars', () => {
    const { vars } = vscodeThemeToVars(theme);
    expect(vars['--tok-com']).toBe('#6272a4');
    expect(vars['--tok-str']).toBe('#f1fa8c');
    expect(vars['--tok-key']).toBe('#ff79c6');
  });

  it('derives accent-soft from the imported accent', () => {
    const { vars } = vscodeThemeToVars(theme);
    expect(vars['--accent-soft']).toContain('#bd93f9');
  });

  it('falls back gracefully when colors are missing', () => {
    const out = vscodeThemeToVars({ name: 'Bare', type: 'light', tokenColors: [
      { scope: 'comment', settings: { foreground: '#999' } },
    ] });
    expect(out.type).toBe('light');
    expect(out.vars['--paper']).toBe('#ffffff');
    expect(out.vars['--tok-com']).toBe('#999');
  });

  it('returns null for non-themes', () => {
    expect(vscodeThemeToVars(null)).toBeNull();
    expect(vscodeThemeToVars({})).toBeNull();
    expect(vscodeThemeToVars({ colors: {}, tokenColors: [] })).toBeNull();
  });
});

describe('parseVscodeTheme', () => {
  it('parses JSONC theme text', () => {
    const text = `{
      // Solarized-ish
      "name": "Demo",
      "type": "light",
      "colors": { "editor.background": "#fdf6e3", "editor.foreground": "#586e75" },
      "tokenColors": [],
    }`;
    const out = parseVscodeTheme(text);
    expect(out.name).toBe('Demo');
    expect(out.vars['--paper']).toBe('#fdf6e3');
  });

  it('returns null for invalid JSON', () => {
    expect(parseVscodeTheme('not json')).toBeNull();
  });
});
