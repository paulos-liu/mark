/**
 * A few real VS Code color themes, in the same shape VS Code ships them
 * (workbench `colors` + TextMate `tokenColors`). Bundled so the theme import
 * can be exercised without a file dialog. Color values are the published
 * palettes of each theme.
 */

/** Dracula — official palette (https://draculatheme.com). */
export const dracula = {
  name: 'Dracula',
  type: 'dark',
  colors: {
    'editor.background': '#282A36',
    'editor.foreground': '#F8F8F2',
    'sideBar.background': '#21222C',
    'editorWidget.background': '#343746',
    'input.background': '#21222C',
    'editorGroup.border': '#1E1F29',
    'input.border': '#191A21',
    'descriptionForeground': '#BFBFBF',
    'editorLineNumber.foreground': '#6272A4',
    'textLink.foreground': '#FF79C6',
    'button.foreground': '#F8F8F2',
  },
  tokenColors: [
    { scope: 'comment', settings: { foreground: '#6272A4' } },
    { scope: ['string', 'string.quoted'], settings: { foreground: '#F1FA8C' } },
    { scope: ['constant.numeric', 'constant.language'], settings: { foreground: '#BD93F9' } },
    { scope: ['keyword', 'storage.type', 'storage.modifier'], settings: { foreground: '#FF79C6' } },
    { scope: ['entity.name.function', 'support.function'], settings: { foreground: '#50FA7B' } },
    { scope: ['variable', 'entity.name.tag'], settings: { foreground: '#FF79C6' } },
    { scope: 'punctuation', settings: { foreground: '#F8F8F2' } },
  ],
};

/** Solarized Light — Ethan Schoonover's palette. */
export const solarizedLight = {
  name: 'Solarized Light',
  type: 'light',
  colors: {
    'editor.background': '#FDF6E3',
    'editor.foreground': '#657B83',
    'sideBar.background': '#EEE8D5',
    'editorWidget.background': '#EEE8D5',
    'input.background': '#FDF6E3',
    'editorGroup.border': '#DDD6C1',
    'input.border': '#D3CBB7',
    'descriptionForeground': '#586E75',
    'editorLineNumber.foreground': '#93A1A1',
    'textLink.foreground': '#268BD2',
    'button.foreground': '#FDF6E3',
  },
  tokenColors: [
    { scope: 'comment', settings: { foreground: '#93A1A1' } },
    { scope: ['string', 'string.quoted'], settings: { foreground: '#2AA198' } },
    { scope: ['constant.numeric', 'constant.language'], settings: { foreground: '#D33682' } },
    { scope: ['keyword', 'storage.type'], settings: { foreground: '#859900' } },
    { scope: ['entity.name.function', 'support.function'], settings: { foreground: '#268BD2' } },
    { scope: ['variable', 'entity.name.tag'], settings: { foreground: '#268BD2' } },
    { scope: 'punctuation', settings: { foreground: '#657B83' } },
  ],
};

/** Nord — official palette (https://www.nordtheme.com). */
export const nord = {
  name: 'Nord',
  type: 'dark',
  colors: {
    'editor.background': '#2E3440',
    'editor.foreground': '#D8DEE9',
    'sideBar.background': '#2E3440',
    'editorWidget.background': '#3B4252',
    'input.background': '#3B4252',
    'editorGroup.border': '#3B4252',
    'input.border': '#434C5E',
    'descriptionForeground': '#D8DEE9',
    'editorLineNumber.foreground': '#4C566A',
    'textLink.foreground': '#88C0D0',
    'button.foreground': '#ECEFF4',
  },
  tokenColors: [
    { scope: 'comment', settings: { foreground: '#616E88' } },
    { scope: ['string', 'string.quoted'], settings: { foreground: '#A3BE8C' } },
    { scope: ['constant.numeric', 'constant.language'], settings: { foreground: '#B48EAD' } },
    { scope: ['keyword', 'storage.type'], settings: { foreground: '#81A1C1' } },
    { scope: ['entity.name.function', 'support.function'], settings: { foreground: '#88C0D0' } },
    { scope: ['variable', 'entity.name.tag'], settings: { foreground: '#8FBCBB' } },
    { scope: 'punctuation', settings: { foreground: '#ECEFF4' } },
  ],
};

export const THEME_PRESETS = [dracula, nord, solarizedLight];
