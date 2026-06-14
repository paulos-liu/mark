// Shared mermaid rendering for the Read view (MarkdownViewer) and the Live
// Preview editor (livePreview). Lazy-loads mermaid, renders to an SVG string, and
// cleans up the orphaned measurement nodes mermaid can leave in <body> on error.

/** @type {any} cached mermaid module (loaded once, reused) */
let mermaidMod;

/**
 * Render mermaid `code` to an SVG string.
 * @param {string} code mermaid diagram source
 * @param {boolean} dark whether to use the dark theme
 * @returns {Promise<string>} the rendered SVG markup
 */
export async function renderMermaidSvg(code, dark) {
  if (!mermaidMod) mermaidMod = (await import('mermaid')).default;
  mermaidMod.initialize({ startOnLoad: false, theme: dark ? 'dark' : 'neutral' });
  const id = 'mmd-' + Math.random().toString(36).slice(2);
  try {
    const { svg } = await mermaidMod.render(id, code);
    return svg;
  } catch (err) {
    // mermaid can leave a detached measurement node (`#id` / `#d+id`) behind.
    document.getElementById(id)?.remove();
    document.getElementById('d' + id)?.remove();
    throw err;
  }
}
