<script>
  import { onMount, onDestroy } from 'svelte';

  let {
    value = '',
    effectiveTheme = 'light',
    fontSize = 18,
    contentWidth = 680,
    readFont = '"Newsreader", Georgia, serif',
    livePreview = false,
    onchange = /** @type {((value: string) => void) | undefined} */ (undefined),
  } = $props();

  /** @type {HTMLDivElement | undefined} */
  let hostEl;
  /** @type {import('@codemirror/view').EditorView | undefined} */
  let view;
  /** @type {import('@codemirror/state').Compartment | undefined} */
  let themeComp;
  /** @type {import('@codemirror/state').Compartment | undefined} */
  let liveComp;
  let ready = $state(false);

  // CM modules / extensions, captured after the lazy import so $effects can reuse them.
  /** @type {any} */ let EditorViewMod;
  /** @type {any} */ let liveExtRef;

  /**
   * Build the look-and-feel extension: warm palette (via the app's CSS custom
   * properties, so it tracks [data-theme] live), reading font, content width,
   * and comfortable padding that mirrors MarkdownViewer.
   * @param {any} EditorView
   * @param {{ dark: boolean, fontSize: number, fontFamily: string, contentWidth: number }} opts
   */
  function makeTheme(EditorView, { dark, fontSize, fontFamily, contentWidth }) {
    const maxWidth = contentWidth === 9999 ? 'none' : contentWidth + 'px';
    return EditorView.theme(
      {
        '&': {
          height: '100%',
          color: 'var(--ink, #272320)',
          backgroundColor: 'var(--paper, #fbfaf7)',
          fontSize: fontSize + 'px',
        },
        '.cm-scroller': {
          fontFamily,
          lineHeight: '1.72',
          padding: '48px 40px 180px',
          overflowX: 'hidden',
        },
        '.cm-content': {
          maxWidth,
          margin: '0 auto',
          width: '100%',
          caretColor: 'var(--accent, #c2683f)',
          padding: '0',
        },
        '.cm-line': { padding: '0' },
        '&.cm-focused': { outline: 'none' },
        '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent, #c2683f)' },
        '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
          backgroundColor: 'var(--accent-soft, rgba(194,104,63,.16))',
        },
        '.cm-panels': {
          backgroundColor: 'var(--surface, #f3f1eb)',
          color: 'var(--ink, #272320)',
          borderColor: 'var(--line, #e6e1d7)',
        },
        '.cm-searchMatch': {
          backgroundColor: 'color-mix(in oklch, #f4be4f 55%, transparent)',
          outline: '1px solid color-mix(in oklch, #f4be4f 40%, transparent)',
        },
        '.cm-searchMatch.cm-searchMatch-selected': {
          backgroundColor: 'var(--accent, #c2683f)',
          color: '#fff',
        },
      },
      { dark },
    );
  }

  onMount(async () => {
    const [
      { EditorView, keymap, drawSelection, highlightSpecialChars },
      { EditorState, Compartment },
      { defaultKeymap, history, historyKeymap, indentWithTab },
      { markdown, markdownLanguage },
      { syntaxHighlighting, HighlightStyle },
      { tags: t },
      { search, searchKeymap },
    ] = await Promise.all([
      import('@codemirror/view'),
      import('@codemirror/state'),
      import('@codemirror/commands'),
      import('@codemirror/lang-markdown'),
      import('@codemirror/language'),
      import('@lezer/highlight'),
      import('@codemirror/search'),
    ]);

    // Live Preview decoration layer (lazy — only pulled in with the editor).
    ({ livePreview: liveExtRef } = await import('../utils/livePreview.js'));

    EditorViewMod = EditorView;
    themeComp = new Compartment();
    liveComp = new Compartment();

    // Source-mode markdown highlighting: keep the raw markers visible but muted
    // (like Obsidian's source mode), styling the content with the warm palette.
    // Heading sizes mirror MarkdownViewer's .markdown-body so Read and Edit
    // match. These token styles are the SINGLE source of heading sizing (they
    // apply in both Source and Live modes); the Live line classes (.cm-lp-h*)
    // must NOT also set font-size or the two multiply (~2x too big).
    const markStyle = HighlightStyle.define([
      { tag: t.heading1, fontSize: '2em', fontWeight: '700', color: 'var(--ink)' },
      { tag: t.heading2, fontSize: '1.42em', fontWeight: '650', color: 'var(--ink)' },
      { tag: t.heading3, fontSize: '1.12em', fontWeight: '650', color: 'var(--ink)' },
      { tag: t.heading4, fontSize: '0.82em', fontWeight: '700', color: 'var(--ink-2)' },
      { tag: [t.heading5, t.heading6], fontSize: '0.85em', fontWeight: '600', color: 'var(--ink-2)' },
      { tag: t.strong, fontWeight: '700', color: 'var(--ink)' },
      { tag: t.emphasis, fontStyle: 'italic' },
      { tag: t.strikethrough, textDecoration: 'line-through', color: 'var(--ink-3)' },
      { tag: t.link, color: 'var(--accent)' },
      { tag: t.url, color: 'var(--ink-3)' },
      { tag: t.monospace, fontFamily: 'var(--mono)', color: 'var(--accent)' },
      { tag: t.quote, color: 'var(--ink-2)', fontStyle: 'italic' },
      { tag: t.list, color: 'var(--ink-3)' },
      { tag: t.contentSeparator, color: 'var(--ink-3)' },
      // Syntax punctuation (**, #, `, >, -, [], etc.) — muted but present.
      { tag: [t.processingInstruction, t.meta], color: 'var(--ink-3)' },
    ]);

    const state = EditorState.create({
      doc: value,
      extensions: [
        history(),
        drawSelection(),
        highlightSpecialChars(),
        EditorView.lineWrapping,
        markdown({ base: markdownLanguage }),
        syntaxHighlighting(markStyle),
        liveComp.of(livePreview ? liveExtRef : []),
        search({ top: true }),
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) onchange?.(u.state.doc.toString());
        }),
        themeComp.of(
          makeTheme(EditorView, {
            dark: effectiveTheme === 'dark',
            fontSize,
            fontFamily: readFont,
            contentWidth,
          }),
        ),
      ],
    });

    view = new EditorView({ state, parent: hostEl });
    ready = true;
    view.focus();
  });

  onDestroy(() => view?.destroy());

  // Re-theme on appearance / typography / width changes (no editor rebuild).
  $effect(() => {
    const t = effectiveTheme,
      fs = fontSize,
      ff = readFont,
      cw = contentWidth;
    if (view && themeComp && EditorViewMod) {
      view.dispatch({
        effects: themeComp.reconfigure(
          makeTheme(EditorViewMod, { dark: t === 'dark', fontSize: fs, fontFamily: ff, contentWidth: cw }),
        ),
      });
    }
  });

  // Toggle Live Preview decorations on/off without rebuilding the editor
  // (preserves cursor, selection, scroll, and undo history across the switch).
  $effect(() => {
    const lp = livePreview;
    if (view && liveComp && liveExtRef !== undefined) {
      view.dispatch({ effects: liveComp.reconfigure(lp ? liveExtRef : []) });
    }
  });

  // External replacement of the buffer (e.g. reload-from-disk). Skips no-ops so
  // it never fights the user's own edits (value is fed back from updateListener).
  $effect(() => {
    const v = value;
    if (ready && view && v !== view.state.doc.toString()) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: v } });
    }
  });
</script>

<div class="markdown-editor" bind:this={hostEl}></div>

<style>
  .markdown-editor {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .markdown-editor :global(.cm-editor) {
    height: 100%;
  }

  .markdown-editor :global(.cm-scroller) {
    scrollbar-width: thin;
    scrollbar-color: var(--line-2, #d8d2c5) transparent;
  }

  .markdown-editor :global(.cm-scroller::-webkit-scrollbar) {
    width: 10px;
  }

  .markdown-editor :global(.cm-scroller::-webkit-scrollbar-thumb) {
    background: var(--line-2, #d8d2c5);
    border-radius: 5px;
    border: 3px solid transparent;
    background-clip: content-box;
  }

  /* ── Live Preview content styling (rendered-in-place, warm palette) ──
     Heading SIZE comes from the markStyle syntax tokens (see makeTheme), which
     already match MarkdownViewer's .markdown-body scale. These line classes must
     NOT set font-size — it would compound with the token size (~2x too large).
     They add only the non-size heading treatment (weight, colour, leading,
     h4 label casing). */
  .markdown-editor :global(.cm-lp-h1) { font-weight: 700; line-height: 1.2; letter-spacing: -0.03em; color: var(--ink); }
  .markdown-editor :global(.cm-lp-h2) { font-weight: 650; line-height: 1.2; color: var(--ink); }
  .markdown-editor :global(.cm-lp-h3) { font-weight: 650; color: var(--ink); }
  .markdown-editor :global(.cm-lp-h4) { font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ink-2); }
  .markdown-editor :global(.cm-lp-h5) { font-weight: 600; color: var(--ink-2); }
  .markdown-editor :global(.cm-lp-h6) { font-weight: 600; color: var(--ink-2); }
  .markdown-editor :global(.cm-lp-strong) { font-weight: 700; color: var(--ink); }
  .markdown-editor :global(.cm-lp-em) { font-style: italic; }
  .markdown-editor :global(.cm-lp-strike) { text-decoration: line-through; color: var(--ink-3); }
  .markdown-editor :global(.cm-lp-code) {
    font-family: var(--mono);
    font-size: 0.9em;
    background: var(--code-bg);
    color: var(--code-ink);
    padding: 0.1em 0.35em;
    border-radius: 5px;
  }
  .markdown-editor :global(.cm-lp-quote) {
    border-left: 3px solid var(--accent-line, rgba(194, 104, 63, 0.38));
    padding-left: 0.85em;
    color: var(--ink-2);
    font-style: italic;
  }
  .markdown-editor :global(.cm-lp-bullet) { color: var(--accent); }
  .markdown-editor :global(.cm-lp-img) {
    max-width: 100%;
    height: auto;
    border-radius: 6px;
    vertical-align: bottom;
  }
  .markdown-editor :global(.cm-lp-img-fallback) {
    color: var(--ink-3);
    font-style: italic;
  }

  /* ── Live Preview block widgets ── */
  .markdown-editor :global(.cm-lp-block) { margin: 0.2em 0; }
  .markdown-editor :global(.cm-lp-hr) {
    height: 0;
    border: none;
    border-top: 1px solid var(--line-2, #d8d2c5);
    margin: 0.9em 0;
  }

  /* Rendered fragments (code blocks, tables, …) reuse the warm reading palette. */
  .markdown-editor :global(.cm-lp-rendered) { margin: 0.6em 0; }
  .markdown-editor :global(.cm-lp-rendered pre) {
    background: var(--code-bg, #f4f2ec);
    color: var(--code-ink, #43403a);
    font-family: var(--mono);
    font-size: 0.86em;
    line-height: 1.55;
    padding: 0.85em 1em;
    border-radius: 8px;
    overflow-x: auto;
    margin: 0;
  }
  .markdown-editor :global(.cm-lp-rendered pre code) {
    font-family: var(--mono);
    background: none;
    padding: 0;
    color: inherit;
  }
  .markdown-editor :global(.cm-lp-rendered table) {
    border-collapse: collapse;
    width: 100%;
    font-size: 0.9em;
    margin: 0;
  }
  .markdown-editor :global(.cm-lp-rendered th),
  .markdown-editor :global(.cm-lp-rendered td) {
    border: 0.5px solid var(--line-2, #d8d2c5);
    padding: 0.4em 0.7em;
    text-align: left;
  }
  .markdown-editor :global(.cm-lp-rendered th) {
    background: var(--surface, #f3f1eb);
    font-weight: 650;
  }
  .markdown-editor :global(.cm-lp-mermaid) {
    display: flex;
    justify-content: center;
    margin: 0.6em 0;
  }
  .markdown-editor :global(.cm-lp-mermaid svg) { max-width: 100%; height: auto; }
  .markdown-editor :global(.cm-lp-mermaid-error) {
    font-family: var(--mono);
    font-size: 0.85em;
    color: var(--ink-3);
    white-space: pre-wrap;
    display: block;
  }
</style>
