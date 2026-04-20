/**
 * Parse and strip YAML frontmatter from markdown content.
 * Handles the leading `---` block only (no TOML `+++` support).
 *
 * @param {string} content
 * @returns {{ meta: Record<string, string>, body: string }}
 */
export function parseFrontmatter(content) {
  if (!content.startsWith('---')) return { meta: {}, body: content };

  const end = content.indexOf('\n---', 3);
  if (end === -1) return { meta: {}, body: content };

  const block = content.slice(3, end).trim();
  const body = content.slice(end + 4).replace(/^\n/, '');

  /** @type {Record<string, string>} */
  const meta = {};
  for (const line of block.split('\n')) {
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim().replace(/^["']|["']$/g, '');
    if (key) meta[key] = value;
  }

  return { meta, body };
}
