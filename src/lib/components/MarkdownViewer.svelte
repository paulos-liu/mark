<script>
  let {
    html = '',
    searchText = '',
    matches = [],
    currentMatchIndex = 0,
    fontSize = 16,
    contentWidth = 860,
    showCopyButton = true,
  } = $props();
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
  });

  // Apply/update highlights when search state changes.
  $effect(() => {
    const _text = searchText;
    const _matchCount = matches.length;
    const _currentIdx = currentMatchIndex;

    if (!viewerEl) return;

    clearHighlights();

    if (!_text || _matchCount === 0) return;

    applyHighlights(_text, _currentIdx);
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
        });
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
    if (!viewerEl) return;

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
    position: relative;
    margin: 0 0 16px;
    padding: 16px;
    padding-right: 40px;
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

  /* Code block wrapper - positions copy button outside the scroll context */
  .markdown-body :global(.code-block-wrapper) {
    position: relative;
  }

  /* Copy button - absolutely positioned in the wrapper, not the pre */
  .markdown-body :global(.code-copy-btn) {
    position: absolute;
    right: 8px;
    top: 8px;
    width: 28px;
    height: 28px;
    padding: 0;
    border: none;
    border-radius: 4px;
    background: var(--input-bg);
    color: var(--text-muted);
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.15s, background 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2;
  }

  .markdown-body :global(.code-block-wrapper:hover .code-copy-btn),
  .markdown-body :global(.code-copy-btn:focus) {
    opacity: 1;
  }

  .markdown-body :global(.code-copy-btn:hover) {
    background: var(--border);
    color: var(--text);
  }

  .markdown-body :global(.code-copy-btn.copied) {
    opacity: 1;
    color: #22c55e;
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

  /* Task list checkboxes */
  .markdown-body :global(input[type="checkbox"]) {
    pointer-events: none;
    margin-right: 6px;
    vertical-align: middle;
    accent-color: var(--accent);
    width: 14px;
    height: 14px;
  }

  .markdown-body :global(li:has(> input[type="checkbox"])) {
    list-style: none;
    margin-left: -1.5em;
  }
</style>