import { describe, it, expect } from 'vitest';
import { slugify, extractHeadings, flattenHeadings } from './headings.js';

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('strips special chars', () => {
    expect(slugify('My Heading (v2.0)')).toBe('my-heading-v20');
  });

  it('strips html tags', () => {
    expect(slugify('<code>foo</code> bar')).toBe('foo-bar');
  });

  it('collapses multiple hyphens', () => {
    expect(slugify('foo  --  bar')).toBe('foo-bar');
  });

  it('handles unicode', () => {
    expect(slugify('日本語')).toBe('日本語');
  });

  it('returns empty string for empty input', () => {
    expect(slugify('')).toBe('');
  });
});

describe('extractHeadings', () => {
  it('extracts flat headings', () => {
    const md = '# One\n## Two\n### Three';
    const h = extractHeadings(md);
    expect(h).toHaveLength(1);
    expect(h[0].text).toBe('One');
    expect(h[0].children[0].text).toBe('Two');
    expect(h[0].children[0].children[0].text).toBe('Three');
  });

  it('ignores headings inside code blocks', () => {
    const md = '```\n# Not a heading\n```\n# Real';
    const h = extractHeadings(md);
    expect(h).toHaveLength(1);
    expect(h[0].text).toBe('Real');
  });

  it('handles multiple root headings', () => {
    const md = '# A\n# B\n# C';
    const h = extractHeadings(md);
    expect(h).toHaveLength(3);
  });

  it('ignores invalid headings (no space after #)', () => {
    const md = '#nospace\n# valid';
    const h = extractHeadings(md);
    expect(h).toHaveLength(1);
    expect(h[0].text).toBe('valid');
  });

  it('returns empty array for no headings', () => {
    expect(extractHeadings('just text')).toHaveLength(0);
  });

  it('dedupes duplicate anchors with the renderer counter scheme', () => {
    const md = '# Notes\n# Notes\n# Notes';
    const anchors = extractHeadings(md).map((h) => h.anchor);
    expect(anchors).toEqual(['notes', 'notes-1', 'notes-2']);
  });
});

describe('flattenHeadings', () => {
  it('flattens nested headings', () => {
    const md = '# A\n## B\n### C';
    const flat = flattenHeadings(extractHeadings(md));
    expect(flat.map(h => h.text)).toEqual(['A', 'B', 'C']);
  });
});
