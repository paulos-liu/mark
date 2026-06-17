<script>
  import { untrack } from 'svelte';
  import { getScrollPosition, saveScrollPosition } from '$lib/stores/scrollMemory.js';
  import { renderMermaidSvg } from '$lib/utils/mermaid.js';

  /** @type {Map<Element, string>} Maps each rendered .mermaid-diagram wrapper to its source */
  const mermaidSources = new Map();
  // Mermaid blocks are rendered by the `html` $effect below (which also runs on
  // mount); mermaid itself lazy-loads on first render.

  let {
    html = '',
    searchText = '',
    currentMatchIndex = 0,
    fontSize = 18,
    contentWidth = 680,
    showCopyButton = true,
    frontmatter = /** @type {Record<string, string>} */ ({}),
    showFrontmatter = false,
    filePath = '',
    effectiveTheme = 'light',
    readFont = '"Newsreader", Georgia, serif',
    onviewerscroll = /** @type {(() => void) | undefined} */ (undefined),
    onopenrelative = /** @type {((href: string) => void) | undefined} */ (undefined),
    onmatchcount = /** @type {((count: number) => void) | undefined} */ (undefined),
  } = $props();

  // Intercept link clicks so the webview never navigates away from the app.
  /** @param {MouseEvent} e */
  async function handleViewerClick(e) {
    const target = /** @type {Element} */ (e.target);
    const a = target?.closest?.('a[href]');
    if (!a) return;
    const href = a.getAttribute('href') ?? '';
    if (!href) return;

    if (href.startsWith('#')) {
      e.preventDefault();
      const id = decodeURIComponent(href.slice(1));
      try {
        viewerEl?.querySelector(`#${CSS.escape(id)}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch {}
      return;
    }
    if (/^[a-z][a-z0-9+.-]*:/i.test(href)) {
      // Absolute URL (http, https, mailto, …) — open in the OS default handler.
      e.preventDefault();
      try {
        const { openUrl } = await import('@tauri-apps/plugin-opener');
        await openUrl(href);
      } catch (err) {
        console.error('Failed to open link:', err);
      }
      return;
    }
    // Relative link (e.g. ./other.md) — let the host resolve and open it.
    e.preventDefault();
    onopenrelative?.(href);
  }

  let frontmatterOpen = $state(true);
  let hasFrontmatter = $derived(showFrontmatter && Object.keys(frontmatter).length > 0);

  // Re-render existing diagrams with the new theme when it changes. Read the
  // theme as the call argument (not a bare statement) so it's always tracked as a
  // dependency — otherwise, on the first run (before any diagram is rendered)
  // rerenderMermaidTheme early-returns without reading it and the effect never
  // re-runs on a theme switch, leaving diagrams stuck in the old palette.
  $effect(() => {
    rerenderMermaidTheme(effectiveTheme === 'dark');
  });
  let viewerEl;

  // Inject copy buttons into <pre> blocks and clear highlights when html changes
  $effect(() => {
    html;
    showCopyButton;
    if (!viewerEl) return;
    clearHighlights();
    if (showCopyButton) {
      injectCopyButtons();
    } else {
      removeCopyButtons();
    }
    // New document: clear stored sources, then render any mermaid blocks
    mermaidSources.clear();
    renderMermaid();

    // Restore scroll position after DOM settles
    const path = filePath;
    if (path) {
      requestAnimationFrame(() => {
        if (viewerEl) viewerEl.scrollTop = getScrollPosition(path);
      });
    }
  });

  async function renderMermaid() {
    if (!viewerEl) return;
    // untrack: this runs inside the `html` $effect, which must NOT re-run on a
    // theme change (it would clear mermaidSources, and there are no <pre> blocks
    // left to re-render). Re-theming is handled by the effect above.
    const dark = untrack(() => effectiveTheme === 'dark');
    const blocks = viewerEl.querySelectorAll('pre > code.language-mermaid');
    for (const code of blocks) {
      const pre = code.parentElement;
      if (!pre || pre.dataset.mermaidRendered) continue;
      const source = code.textContent ?? '';
      try {
        const svg = await renderMermaidSvg(source, dark);
        const wrapper = document.createElement('div');
        wrapper.className = 'mermaid-diagram';
        wrapper.innerHTML = svg;
        pre.replaceWith(wrapper);
        mermaidSources.set(wrapper, source);
      } catch {
        pre.dataset.mermaidRendered = 'error';
      }
    }
  }

  /** @param {boolean} dark */
  async function rerenderMermaidTheme(dark) {
    if (mermaidSources.size === 0) return;
    for (const [wrapper, source] of mermaidSources) {
      if (!wrapper.isConnected) {
        mermaidSources.delete(wrapper);
        continue;
      }
      try {
        wrapper.innerHTML = await renderMermaidSvg(source, dark);
      } catch {}
    }
  }

  // Persist scroll position on scroll (debounced 200ms)
  let _scrollTimer;
  function handleScroll() {
    if (filePath) {
      clearTimeout(_scrollTimer);
      _scrollTimer = setTimeout(() => {
        if (viewerEl) saveScrollPosition(filePath, viewerEl.scrollTop);
      }, 200);
    }
    onviewerscroll?.();
  }

  // Highlight matches by walking the rendered DOM, then report how many were
  // found. The count and the `<mark>` elements come from this single pass, so
  // the titlebar count can never disagree with what's highlighted. Tracking
  // `html` re-applies highlights after a document swap.
  $effect(() => {
    const _text = searchText;
    const _currentIdx = currentMatchIndex;
    html;

    if (!viewerEl) return;

    clearHighlights();

    const count = _text ? applyHighlights(_text, _currentIdx) : 0;
    onmatchcount?.(count);
  });

  function removeCopyButtons() {
    if (!viewerEl) return;
    viewerEl.querySelectorAll('.code-copy-btn').forEach((b) => b.remove());
    viewerEl.querySelectorAll('.code-block-wrapper').forEach((w) => {
      const pre = w.querySelector('pre');
      if (pre) w.replaceWith(pre);
    });
  }

  function injectCopyButtons() {
    if (!viewerEl) return;
    removeCopyButtons();

    const pres = viewerEl.querySelectorAll('pre');
    for (const pre of pres) {
      // Mermaid blocks are replaced by their rendered diagram — don't wrap them.
      if (pre.querySelector('code.language-mermaid')) continue;
      const wrapper = document.createElement('div');
      wrapper.className = 'code-block-wrapper';
      pre.parentNode?.insertBefore(wrapper, pre);
      wrapper.appendChild(pre);

      const btn = document.createElement('button');
      btn.className = 'code-copy-btn';
      btn.setAttribute('aria-label', 'Copy code');
      btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"/><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"/></svg>`;

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const code = pre.querySelector('code');
        const text = (code || pre).textContent;
        navigator.clipboard.writeText(text).then(() => {
          btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/></svg>`;
          btn.classList.add('copied');
          setTimeout(() => {
            btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"/><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"/></svg>`;
            btn.classList.remove('copied');
          }, 1500);
        }).catch((err) => console.error('Copy failed:', err));
      });

      wrapper.appendChild(btn);
    }
  }

  function clearHighlights() {
    if (!viewerEl) return;
    viewerEl.querySelectorAll('mark.search-hl').forEach((el) => {
      const parent = el.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(el.textContent), el);
        parent.normalize();
      }
    });
  }

  function applyHighlights(query, activeIndex) {
    if (!viewerEl) return 0;

    const walker = document.createTreeWalker(viewerEl, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    const lowerQuery = query.toLowerCase();
    let globalMatchIdx = 0;

    for (const node of textNodes) {
      const text = node.textContent;
      const lower = text.toLowerCase();
      let lastIdx = 0;
      const parts = [];
      let pos = lower.indexOf(lowerQuery, 0);

      while (pos !== -1) {
        if (pos > lastIdx) {
          parts.push({ type: 'text', value: text.slice(lastIdx, pos) });
        }
        parts.push({
          type: 'match',
          value: text.slice(pos, pos + query.length),
          isCurrent: globalMatchIdx === activeIndex,
        });
        globalMatchIdx++;
        lastIdx = pos + query.length;
        pos = lower.indexOf(lowerQuery, lastIdx);
      }

      if (parts.length === 0) continue;

      if (lastIdx < text.length) {
        parts.push({ type: 'text', value: text.slice(lastIdx) });
      }

      const frag = document.createDocumentFragment();
      for (const part of parts) {
        if (part.type === 'text') {
          frag.appendChild(document.createTextNode(part.value));
        } else {
          const mark = document.createElement('mark');
          mark.className = 'search-hl' + (part.isCurrent ? ' current' : '');
          mark.textContent = part.value;
          frag.appendChild(mark);
        }
      }

      node.parentNode.replaceChild(frag, node);
    }

    const current = viewerEl.querySelector('mark.search-hl.current');
    if (current) {
      current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    return globalMatchIdx;
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="markdown-viewer" bind:this={viewerEl} onscroll={handleScroll} onclick={handleViewerClick}>
  <div
    class="markdown-body"
    style="font-size: {fontSize}px; max-width: {contentWidth === 9999 ? 'none' : contentWidth + 'px'}; font-family: {readFont};"
  >
    {#if hasFrontmatter}
      <details class="frontmatter-block" bind:open={frontmatterOpen}>
        <summary class="frontmatter-summary">Frontmatter</summary>
        <dl class="frontmatter-list">
          {#each Object.entries(frontmatter) as [key, value]}
            <div class="frontmatter-row">
              <dt class="frontmatter-key">{key}</dt>
              <dd class="frontmatter-value">{value}</dd>
            </div>
          {/each}
        </dl>
      </details>
    {/if}
    {@html html}
  </div>
</div>

<style>
  .markdown-viewer {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 48px 40px 180px;
    scrollbar-width: thin;
    scrollbar-color: var(--line-2, #d8d2c5) transparent;
  }

  .markdown-viewer::-webkit-scrollbar { width: 10px; }
  .markdown-viewer::-webkit-scrollbar-thumb {
    background: var(--line-2, #d8d2c5);
    border-radius: 5px;
    border: 3px solid transparent;
    background-clip: content-box;
  }

  .markdown-body {
    margin: 0 auto;
    color: var(--ink, #272320);
    line-height: 1.72;
  }

  /* Headings — inherit the reading font so they follow the "Reading font"
     setting (serif/sans/mono), matching the body and the editor's headings. */
  .markdown-body :global(h1),
  .markdown-body :global(h2),
  .markdown-body :global(h3),
  .markdown-body :global(h4) {
    font-family: inherit;
    color: var(--ink, #272320);
    line-height: 1.2;
    letter-spacing: -0.018em;
    scroll-margin-top: 24px;
  }

  .markdown-body :global(h1) {
    font-size: 2em;
    font-weight: 700;
    margin: 0 0 0.5em;
    letter-spacing: -0.03em;
  }

  .markdown-body :global(h2) {
    font-size: 1.42em;
    font-weight: 650;
    margin: 1.9em 0 0.6em;
    padding-bottom: 0.32em;
    border-bottom: 0.5px solid var(--line, #e6e1d7);
  }

  .markdown-body :global(h3) {
    font-size: 1.12em;
    font-weight: 650;
    margin: 1.6em 0 0.5em;
  }

  .markdown-body :global(h4) {
    font-size: 0.82em;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--ink-2, #5d574e);
    margin: 1.5em 0 0.4em;
  }

  .markdown-body :global(h5),
  .markdown-body :global(h6) {
    font-size: 0.85em;
    font-weight: 600;
    margin: 1em 0 0.5em;
    color: var(--ink-2, #5d574e);
  }

  .markdown-body :global(p) { margin: 0 0 1.05em; }

  .markdown-body :global(a) {
    color: var(--accent, #c2683f);
    text-decoration: none;
    border-bottom: 1px solid var(--accent-line, rgba(194,104,63,.38));
    transition: border-color 0.12s;
  }

  .markdown-body :global(a:hover) { border-bottom-color: var(--accent, #c2683f); }

  .markdown-body :global(strong) { font-weight: 650; color: var(--ink, #272320); }
  .markdown-body :global(em) { font-style: italic; }

  .markdown-body :global(ul),
  .markdown-body :global(ol) { padding-left: 1.6em; margin: 0 0 1.05em; }
  .markdown-body :global(li) { margin: 0.3em 0; }
  .markdown-body :global(li::marker) { color: var(--ink-3, #938c80); }

  .markdown-body :global(blockquote) {
    margin: 1.4em 0;
    padding: 0.2em 0 0.2em 1.3em;
    border-left: 3px solid var(--accent-line, rgba(194,104,63,.38));
    color: var(--ink-2, #5d574e);
    font-style: italic;
  }

  .markdown-body :global(blockquote p:last-child) { margin-bottom: 0; }

  /* Inline code */
  .markdown-body :global(:not(pre) > code) {
    font: 0.85em var(--mono, monospace);
    background: var(--code-bg, #f4f2ec);
    color: var(--accent, #c2683f);
    padding: 0.12em 0.4em;
    border-radius: 5px;
    border: 0.5px solid var(--line, #e6e1d7);
    white-space: nowrap;
  }

  /* Code blocks */
  .markdown-body :global(pre) {
    position: relative;
    margin: 1.5em 0;
    padding: 14px 16px;
    overflow-x: auto;
    background: var(--code-bg, #f4f2ec);
    border: 0.5px solid var(--line-2, #d8d2c5);
    border-radius: 12px;
    font: 0.8em/1.7 var(--mono, monospace);
    color: var(--code-ink, #43403a);
    scrollbar-width: thin;
  }

  .markdown-body :global(pre code) {
    font: inherit;
    background: none;
    border: none;
    padding: 0;
    color: inherit;
    white-space: pre;
  }

  .markdown-body :global(.code-block-wrapper) { position: relative; }

  .markdown-body :global(.code-copy-btn) {
    position: absolute;
    right: 8px;
    top: 8px;
    width: 28px;
    height: 28px;
    padding: 0;
    border: none;
    border-radius: 6px;
    background: var(--surface, #f3f1eb);
    color: var(--ink-3, #938c80);
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.15s, background 0.12s, color 0.12s;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2;
  }

  .markdown-body :global(.code-block-wrapper:hover .code-copy-btn),
  .markdown-body :global(.code-copy-btn:focus) { opacity: 1; }

  .markdown-body :global(.code-copy-btn:hover) {
    background: var(--surface-2, #e9e6dd);
    color: var(--ink, #272320);
  }

  .markdown-body :global(.code-copy-btn.copied) {
    opacity: 1;
    color: var(--tok-str, #5d7a3f);
  }

  /* Tables */
  .markdown-body :global(table) {
    border-collapse: collapse;
    width: 100%;
    margin: 1.5em 0;
    font-family: var(--ui, system-ui);
    font-size: 0.86em;
    border: 0.5px solid var(--line-2, #d8d2c5);
    border-radius: 12px;
    overflow: hidden;
  }

  .markdown-body :global(thead) { background: var(--surface, #f3f1eb); }

  .markdown-body :global(th) {
    text-align: left;
    font-weight: 650;
    color: var(--ink, #272320);
    padding: 10px 14px;
    border-bottom: 0.5px solid var(--line-2, #d8d2c5);
    white-space: nowrap;
  }

  .markdown-body :global(td) {
    padding: 9px 14px;
    border-bottom: 0.5px solid var(--line, #e6e1d7);
    color: var(--ink-2, #5d574e);
  }

  .markdown-body :global(tbody tr:last-child td) { border-bottom: none; }
  .markdown-body :global(tbody tr:hover td) { background: var(--surface, #f3f1eb); }

  .markdown-body :global(hr) {
    border: none;
    border-top: 0.5px solid var(--line-2, #d8d2c5);
    margin: 2.4em 0;
  }

  .markdown-body :global(img) { max-width: 100%; border-radius: 9px; }

  /* Search highlights */
  :global(mark.search-hl) {
    background: color-mix(in oklch, #f4be4f 55%, transparent);
    color: inherit;
    border-radius: 3px;
    padding: 0 1px;
    box-shadow: 0 0 0 1px color-mix(in oklch, #f4be4f 40%, transparent);
  }

  :global(mark.search-hl.current) {
    background: var(--accent, #c2683f);
    color: #fff;
    box-shadow: 0 0 0 2px var(--accent-soft, rgba(194,104,63,.16));
  }

  /* Mermaid */
  .markdown-body :global(.mermaid-diagram) {
    margin: 1.6em 0;
    padding: 22px;
    border-radius: 12px;
    background: var(--surface, #f3f1eb);
    border: 0.5px solid var(--line, #e6e1d7);
    display: grid;
    place-items: center;
    overflow-x: auto;
  }

  .markdown-body :global(.mermaid-diagram svg) {
    max-width: 100%;
    height: auto;
  }

  /* Frontmatter */
  .frontmatter-block {
    margin-bottom: 24px;
    border: 0.5px solid var(--line, #e6e1d7);
    border-radius: 12px;
    overflow: hidden;
    font-family: var(--ui, system-ui);
    font-size: 85%;
  }

  .frontmatter-summary {
    padding: 8px 12px;
    background: var(--surface, #f3f1eb);
    cursor: pointer;
    font-weight: 600;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--ink-3, #938c80);
    user-select: none;
    list-style: none;
  }

  .frontmatter-summary::-webkit-details-marker { display: none; }

  .frontmatter-summary::before {
    content: '▶';
    display: inline-block;
    margin-right: 6px;
    font-size: 9px;
    transition: transform 0.15s;
  }

  .frontmatter-block[open] .frontmatter-summary::before { transform: rotate(90deg); }

  .frontmatter-list { margin: 0; padding: 8px 12px; }

  .frontmatter-row {
    display: flex;
    gap: 12px;
    padding: 4px 0;
    border-bottom: 0.5px solid var(--line, #e6e1d7);
  }

  .frontmatter-row:last-child { border-bottom: none; }

  .frontmatter-key {
    font-weight: 600;
    color: var(--ink-3, #938c80);
    min-width: 100px;
    flex-shrink: 0;
  }

  .frontmatter-value { color: var(--ink, #272320); margin: 0; word-break: break-word; }

  /* Task list */
  .markdown-body :global(input[type="checkbox"]) {
    pointer-events: none;
    margin-right: 6px;
    vertical-align: middle;
    accent-color: var(--accent, #c2683f);
    width: 14px;
    height: 14px;
  }

  .markdown-body :global(li:has(> input[type="checkbox"])) {
    list-style: none;
    margin-left: -1.5em;
  }
</style>