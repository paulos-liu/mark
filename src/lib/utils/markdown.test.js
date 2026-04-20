import { describe, it, expect } from 'vitest';
import { renderMarkdown } from './markdown.js';

describe('renderMarkdown', () => {
  it('renders basic paragraph', () => {
    const html = renderMarkdown('Hello world');
    expect(html).toContain('<p>Hello world</p>');
  });

  it('renders headings with id anchors', () => {
    const html = renderMarkdown('# My Heading');
    expect(html).toContain('id="my-heading"');
    expect(html).toContain('<h1');
  });

  it('renders GFM tables', () => {
    const md = '| A | B |\n|---|---|\n| 1 | 2 |';
    const html = renderMarkdown(md);
    expect(html).toContain('<table>');
    expect(html).toContain('<th>A</th>');
  });

  it('renders GFM strikethrough', () => {
    const html = renderMarkdown('~~crossed~~');
    expect(html).toContain('<del>crossed</del>');
  });

  it('renders GFM task list checkboxes', () => {
    const md = '- [x] Done\n- [ ] Todo';
    const html = renderMarkdown(md);
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('checked');
  });

  it('sanitizes XSS', () => {
    const html = renderMarkdown('<script>alert(1)</script>');
    expect(html).not.toContain('<script>');
  });

  it('preserves heading id attributes through sanitizer', () => {
    const html = renderMarkdown('## Section Two');
    expect(html).toContain('id="section-two"');
  });

  it('renders duplicate headings with unique anchors', () => {
    const html = renderMarkdown('# Foo\n# Foo');
    expect(html).toContain('id="foo"');
    expect(html).toContain('id="foo-1"');
  });
});
