import { describe, it, expect, beforeEach, vi } from 'vitest';

// Provide a full localStorage mock (happy-dom's implementation is incomplete)
const store = {};
const mockLocalStorage = {
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
};
vi.stubGlobal('localStorage', mockLocalStorage);

import { getScrollPosition, saveScrollPosition } from './scrollMemory.js';

beforeEach(() => {
  mockLocalStorage.clear();
});

describe('scrollMemory', () => {
  it('returns 0 for unknown path', () => {
    expect(getScrollPosition('/unknown/file.md')).toBe(0);
  });

  it('returns 0 for empty path', () => {
    expect(getScrollPosition('')).toBe(0);
  });

  it('saves and retrieves scroll position', () => {
    saveScrollPosition('/foo/bar.md', 420);
    expect(getScrollPosition('/foo/bar.md')).toBe(420);
  });

  it('overwrites existing entry for same path', () => {
    saveScrollPosition('/foo/bar.md', 100);
    saveScrollPosition('/foo/bar.md', 999);
    expect(getScrollPosition('/foo/bar.md')).toBe(999);
  });

  it('stores multiple paths independently', () => {
    saveScrollPosition('/a.md', 10);
    saveScrollPosition('/b.md', 20);
    expect(getScrollPosition('/a.md')).toBe(10);
    expect(getScrollPosition('/b.md')).toBe(20);
  });

  it('evicts oldest entry when at max capacity', () => {
    // Fill to MAX_ENTRIES (100)
    for (let i = 0; i < 100; i++) {
      saveScrollPosition(`/file-${i}.md`, i);
    }
    // Adding one more should evict /file-0.md
    saveScrollPosition('/new.md', 999);
    expect(getScrollPosition('/file-0.md')).toBe(0);
    expect(getScrollPosition('/new.md')).toBe(999);
  });
});
