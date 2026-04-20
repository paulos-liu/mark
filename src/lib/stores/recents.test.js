import { describe, it, expect, vi, beforeEach } from 'vitest';

// Provide a full localStorage mock
const store = {};
const mockLocalStorage = {
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
};
vi.stubGlobal('localStorage', mockLocalStorage);

// Import after stubbing
const { recentFiles, addRecent } = await import('./recents.svelte.js');

beforeEach(() => {
  mockLocalStorage.clear();
  recentFiles.splice(0);
});

describe('recents', () => {
  it('starts empty', () => {
    expect(recentFiles).toHaveLength(0);
  });

  it('adds a file', () => {
    addRecent('/foo.md');
    expect(recentFiles[0]).toBe('/foo.md');
  });

  it('prepends new files', () => {
    addRecent('/a.md');
    addRecent('/b.md');
    expect(recentFiles[0]).toBe('/b.md');
    expect(recentFiles[1]).toBe('/a.md');
  });

  it('moves existing entry to front', () => {
    addRecent('/a.md');
    addRecent('/b.md');
    addRecent('/a.md');
    expect(recentFiles[0]).toBe('/a.md');
    expect(recentFiles).toHaveLength(2);
  });

  it('ignores empty paths', () => {
    addRecent('');
    expect(recentFiles).toHaveLength(0);
  });

  it('caps at 20 entries', () => {
    for (let i = 0; i < 25; i++) addRecent(`/file-${i}.md`);
    expect(recentFiles).toHaveLength(20);
  });
});
