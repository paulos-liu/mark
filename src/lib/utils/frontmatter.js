/**
 * Parse and strip YAML frontmatter from markdown content.
 * Handles the leading `---` block only (no TOML `+++` support).
 *
 * @param {string} content
 * @returns {{ meta: Record<string, string>, body: string }}
 */
export function parseFrontmatter(content) {
  // Opening fence must be exactly `---` on the first line; the closing fence
  // must be a lone `---` line (not `----` or `---text`). This avoids treating a
  // document that merely starts with a thematic break as frontmatter.
  const match = content.match(/^---[ \t]*\r?\n([\s\S]*?)^---[ \t]*$(?:\r?\n|$)/m);
  if (!match) return { meta: {}, body: content };

  const block = match[1];
  const lines = block.split('\n');

  // A real (non-empty) frontmatter block's first content line is a `key:` pair.
  // If it isn't (e.g. a heading after a leading thematic break), treat as no
  // frontmatter so we don't silently swallow document content.
  const firstContent = lines.find((l) => l.trim() !== '');
  if (firstContent !== undefined && firstContent.indexOf(':') === -1) {
    return { meta: {}, body: content };
  }

  const body = content.slice(match[0].length);

  /** @type {Record<string, string>} */
  const meta = {};
  for (const line of lines) {
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim().replace(/^["']|["']$/g, '');
    if (key) meta[key] = value;
  }

  return { meta, body };
}
