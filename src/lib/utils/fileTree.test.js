import { describe, it, expect } from 'vitest';
import { buildFileTree } from './fileTree.js';

describe('buildFileTree', () => {
  it('returns an empty root for no files', () => {
    const { rootName, root } = buildFileTree([]);
    expect(rootName).toBe('');
    expect(root.children).toEqual([]);
  });

  it('roots at the deepest shared directory', () => {
    const { rootName } = buildFileTree([
      '/Users/me/search-notes/a.md',
      '/Users/me/search-notes/b.md',
      '/Users/me/search-notes/drafts/c.md',
    ]);
    expect(rootName).toBe('search-notes');
  });

  it('nests subfolders and keeps full file paths', () => {
    const { root } = buildFileTree([
      '/notes/vector-search.md',
      '/notes/drafts/hybrid-search.md',
      '/notes/drafts/quantization-deep.md',
    ]);
    const drafts = root.children.find((c) => c.name === 'drafts');
    expect(drafts?.type).toBe('folder');
    expect(drafts.children.map((c) => c.name)).toEqual([
      'hybrid-search.md',
      'quantization-deep.md',
    ]);
    const draftFile = drafts.children[0];
    expect(draftFile.path).toBe('/notes/drafts/hybrid-search.md');
  });

  it('sorts folders before files, each alphabetically', () => {
    const { root } = buildFileTree([
      '/notes/TODO.md',
      '/notes/README.md',
      '/notes/zeta/z.md',
      '/notes/alpha/a.md',
    ]);
    const names = root.children.map((c) => `${c.type}:${c.name}`);
    expect(names).toEqual([
      'folder:alpha',
      'folder:zeta',
      'file:README.md',
      'file:TODO.md',
    ]);
  });

  it('handles a single file by rooting at its parent directory', () => {
    const { rootName, root } = buildFileTree(['/Users/me/docs/only.md']);
    expect(rootName).toBe('docs');
    expect(root.children).toHaveLength(1);
    expect(root.children[0]).toMatchObject({ name: 'only.md', type: 'file' });
  });

  it('normalizes Windows-style separators', () => {
    const { rootName } = buildFileTree([
      'C:\\Users\\me\\notes\\a.md',
      'C:\\Users\\me\\notes\\b.md',
    ]);
    expect(rootName).toBe('notes');
  });
});
