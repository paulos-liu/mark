<script>
  let {
    html = '',
    searchText = '',
    matches = [],
    currentMatchIndex = 0,
    fontSize = 16,
    contentWidth = 860,
  } = $props();
  let viewerEl;

  // Clear highlights whenever html changes (new document loaded)
  // and re-apply if there's an active search
  $effect(() => {
    // Track html to re-run when document changes
    html;
    if (!viewerEl) return;
    clearHighlights();
  });

  // Apply/update highlights when search state changes.
  // Reading searchText, matches.length, and currentMatchIndex ensures
  // this effect re-runs when any of those change (Svelte 5 fine-grained tracking).
  $effect(() => {
    const _text = searchText;
    const _matchCount = matches.length;
    const _currentIdx = currentMatchIndex;

    if (!viewerEl) return;

    clearHighlights();

    if (!_text || _matchCount === 0) return;

    applyHighlights(_text, _currentIdx);
  });

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
    if (!viewerEl) return;

    // Walk text nodes and wrap matches
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

    // Scroll current match into view
    const current = viewerEl.querySelector('mark.search-hl.current');
    if (current) {
      current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
</script>

<div class="markdown-viewer" bind:this={viewerEl}>
  <div
    class="markdown-body"
    style="font-size: {fontSize}px; max-width: {contentWidth}px;"
  >
    {@html html}
  </div>
</div>

<style>
  .markdown-viewer {
    flex: 1;
    overflow-y: auto;
    padding: 16px 48px 48px;
  }

  .markdown-body {
    margin: 0 auto;
    color: var(--text);
    line-height: 1.6;
  }

  /* GitHub-flavored markdown base styles */
  .markdown-body :global(h1) { font-size: 2em; font-weight: 600; margin: 0.67em 0; padding-bottom: 0.3em; border-bottom: 1px solid var(--border); }
  .markdown-body :global(h2) { font-size: 1.5em; font-weight: 600; margin: 1em 0 0.5em; padding-bottom: 0.3em; border-bottom: 1px solid var(--border); }
  .markdown-body :global(h3) { font-size: 1.25em; font-weight: 600; margin: 1em 0 0.5em; }
  .markdown-body :global(h4) { font-size: 1em; font-weight: 600; margin: 1em 0 0.5em; }
  .markdown-body :global(h5) { font-size: 0.875em; font-weight: 600; margin: 1em 0 0.5em; }
  .markdown-body :global(h6) { font-size: 0.85em; font-weight: 600; margin: 1em 0 0.5em; color: var(--text-muted); }

  .markdown-body :global(p) { margin: 0 0 16px; }
  .markdown-body :global(a) { color: var(--accent); text-decoration: none; }
  .markdown-body :global(a:hover) { text-decoration: underline; }

  .markdown-body :global(ul),
  .markdown-body :global(ol) { padding-left: 2em; margin: 0 0 16px; }
  .markdown-body :global(li) { margin: 4px 0; }
  .markdown-body :global(li + li) { margin-top: 4px; }

  .markdown-body :global(blockquote) {
    margin: 0 0 16px;
    padding: 0 1em;
    color: var(--text-muted);
    border-left: 3px solid var(--border);
  }

  .markdown-body :global(code) {
    font-family: 'SF Mono', SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace;
    font-size: 85%;
    padding: 0.2em 0.4em;
    background: var(--input-bg);
    border-radius: 4px;
  }

  .markdown-body :global(pre) {
    margin: 0 0 16px;
    padding: 16px;
    overflow-x: auto;
    background: var(--input-bg);
    border-radius: 8px;
    line-height: 1.45;
  }

  .markdown-body :global(pre code) {
    padding: 0;
    background: none;
    font-size: 85%;
  }

  .markdown-body :global(table) {
    border-collapse: collapse;
    width: 100%;
    margin: 0 0 16px;
  }

  .markdown-body :global(th),
  .markdown-body :global(td) {
    padding: 6px 13px;
    border: 1px solid var(--border);
  }

  .markdown-body :global(th) {
    font-weight: 600;
    background: var(--input-bg);
  }

  .markdown-body :global(tr:nth-child(2n)) {
    background: var(--input-bg);
  }

  .markdown-body :global(hr) {
    height: 2px;
    margin: 24px 0;
    background: var(--border);
    border: none;
  }

  .markdown-body :global(img) {
    max-width: 100%;
    border-radius: 4px;
  }

  :global(mark.search-hl) {
    background: #ffd54f;
    color: inherit;
    border-radius: 2px;
    padding: 0 1px;
  }

  :global(mark.search-hl.current) {
    background: #ff9800;
    color: white;
  }
</style>
