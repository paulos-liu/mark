import { describe, it, expect } from 'vitest';
import { parseFrontmatter } from './frontmatter.js';

describe('parseFrontmatter', () => {
  it('parses basic key-value pairs', () => {
    const { meta, body } = parseFrontmatter('---\ntitle: Hello\ndate: 2024-01-01\n---\n# Body');
    expect(meta.title).toBe('Hello');
    expect(meta.date).toBe('2024-01-01');
    expect(body).toBe('# Body');
  });

  it('strips surrounding quotes from values', () => {
    const { meta } = parseFrontmatter('---\ntitle: "Quoted"\nauthor: \'Single\'\n---\n');
    expect(meta.title).toBe('Quoted');
    expect(meta.author).toBe('Single');
  });

  it('returns empty meta and full content when no frontmatter', () => {
    const { meta, body } = parseFrontmatter('# Just markdown');
    expect(meta).toEqual({});
    expect(body).toBe('# Just markdown');
  });

  it('returns empty meta when only opening --- present', () => {
    const { meta, body } = parseFrontmatter('---\ntitle: Oops');
    expect(meta).toEqual({});
    expect(body).toBe('---\ntitle: Oops');
  });

  it('handles empty frontmatter block', () => {
    const { meta, body } = parseFrontmatter('---\n---\n# Body');
    expect(meta).toEqual({});
    expect(body).toBe('# Body');
  });

  it('ignores lines without colons', () => {
    const { meta } = parseFrontmatter('---\ntitle: Valid\nbadline\n---\n');
    expect(meta.title).toBe('Valid');
    expect(Object.keys(meta)).toHaveLength(1);
  });

  it('handles values with colons', () => {
    const { meta } = parseFrontmatter('---\nurl: https://example.com/path\n---\n');
    expect(meta.url).toBe('https://example.com/path');
  });

  it('does NOT treat a leading thematic break as frontmatter', () => {
    const doc = '---\n\n# Real Title\n\nBody text.\n\n---\n\nMore.';
    const { meta, body } = parseFrontmatter(doc);
    expect(meta).toEqual({});
    expect(body).toBe(doc); // nothing swallowed
  });

  it('requires the closing fence to be a lone --- line', () => {
    // "----" is not a valid closer, so this is not frontmatter
    const doc = '---\ntitle: X\n----\nbody';
    const { meta, body } = parseFrontmatter(doc);
    expect(meta).toEqual({});
    expect(body).toBe(doc);
  });
});
