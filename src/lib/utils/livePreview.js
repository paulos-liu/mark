// Live Preview decoration layer for the Markdown editor.
//
// Renders Markdown *in place* (Obsidian-style "Live Preview"): syntax markers are
// hidden and the content is styled, while the raw markers are revealed on the
// line(s) the cursor/selection currently touches so they stay editable. Multi-line
// constructs (block widgets) are replaced with a rendered element that reverts to
// source when the cursor enters it.
//
// Architecture — TWO sources, because of a hard CodeMirror rule:
//   • Inline decorations (marks, single-line replaces, line decorations) come from
//     a ViewPlugin, culled to the viewport for performance.
//   • Block widgets (and any replace spanning a line break) MAY NOT be provided by
//     a plugin (CM throws "Block decorations may not be specified via plugins").
//     They must reach the editor through the decorations FACET from editor STATE,
//     so they live in a StateField. It works over the whole document but prunes
//     traversal to block containers, and recomputes on doc / selection / parse
//     changes (selection drives revert-on-active).
// `livePreview` exports both as a single extension array.
import { Decoration, ViewPlugin, WidgetType, EditorView } from '@codemirror/view';
import { StateField } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import katex from 'katex';
import { renderMarkdown } from './markdown.js';
import { renderMermaidSvg } from './mermaid.js';

// Heading container nodes → big/bold content classes.
const HEADING_CLASS = /** @type {Record<string, string>} */ ({
  ATXHeading1: 'cm-lp-h1',
  ATXHeading2: 'cm-lp-h2',
  ATXHeading3: 'cm-lp-h3',
  ATXHeading4: 'cm-lp-h4',
  ATXHeading5: 'cm-lp-h5',
  ATXHeading6: 'cm-lp-h6',
});

// Inline container nodes → content styling classes.
const CONTENT_CLASS = /** @type {Record<string, string>} */ ({
  StrongEmphasis: 'cm-lp-strong',
  Emphasis: 'cm-lp-em',
  Strikethrough: 'cm-lp-strike',
  InlineCode: 'cm-lp-code',
});

const hide = Decoration.replace({});

/** A round bullet rendered in place of a '-'/'*'/'+' list marker. */
class BulletWidget extends WidgetType {
  eq() {
    return true;
  }
  toDOM() {
    const span = document.createElement('span');
    span.className = 'cm-lp-bullet';
    span.textContent = '•';
    return span;
  }
}
const bullet = Decoration.replace({ widget: new BulletWidget() });

/** Renders an inline image, falling back to its alt text if the source can't load. */
class ImageWidget extends WidgetType {
  /** @param {string} src @param {string} alt */
  constructor(src, alt) {
    super();
    this.src = src;
    this.alt = alt;
  }
  /** @param {ImageWidget} other */
  eq(other) {
    return other.src === this.src && other.alt === this.alt;
  }
  toDOM() {
    const img = document.createElement('img');
    img.className = 'cm-lp-img';
    img.alt = this.alt;
    img.src = this.src;
    img.addEventListener('error', () => {
      const span = document.createElement('span');
      span.className = 'cm-lp-img-fallback';
      span.textContent = `🖼 ${this.alt || this.src}`;
      img.replaceWith(span);
    });
    return img;
  }
}

// Matches `![alt](src)` / `![alt](src "title")` / `![alt](<src with spaces>)`,
// capturing alt (1) and src as either the angle-bracket form (2) or bare (3).
const IMAGE_RE = /^!\[([^\]]*)\]\(\s*(?:<([^>]+)>|(\S+?))(?:\s+["'][^"']*["'])?\s*\)/;

/** Renders inline `$…$` math with KaTeX, falling back to raw text on error. */
class MathInlineWidget extends WidgetType {
  /** @param {string} tex */
  constructor(tex) {
    super();
    this.tex = tex;
  }
  /** @param {MathInlineWidget} other */
  eq(other) {
    return other.tex === this.tex;
  }
  toDOM() {
    const span = document.createElement('span');
    span.className = 'cm-lp-math';
    try {
      span.innerHTML = katex.renderToString(this.tex, { displayMode: false, throwOnError: false });
    } catch {
      span.textContent = `$${this.tex}$`;
    }
    return span;
  }
}

/**
 * A block-level widget that renders a whole construct (HR, table, code block, …)
 * in place. `render(source)` builds the DOM; `source` also keys equality so the
 * widget only re-renders when its source text changes.
 */
class BlockWidget extends WidgetType {
  /**
   * @param {string} source raw markdown of the block
   * @param {(source: string) => HTMLElement} render
   */
  constructor(source, render) {
    super();
    this.source = source;
    this.render = render;
  }
  /** @param {BlockWidget} other */
  eq(other) {
    return other.source === this.source && other.render === this.render;
  }
  /** @param {import('@codemirror/view').EditorView} view */
  toDOM(view) {
    const el = this.render(this.source);
    // Click-to-edit: move the cursor into the block's source so it reverts to
    // raw markdown (matching Obsidian). CM places clicks next to a block widget,
    // not inside it, so we set the selection explicitly.
    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const pos = view.posAtDOM(el);
      view.dispatch({ selection: { anchor: pos } });
      view.focus();
    });
    return el;
  }
  ignoreEvent() {
    // We handle mousedown ourselves; let CodeMirror ignore widget-originated events.
    return true;
  }
  /** @param {HTMLElement} dom */
  destroy(dom) {
    // Tear down any per-widget resources (e.g. the mermaid theme observer).
    /** @type {any} */ (dom).__cmLpCleanup?.();
  }
}

/** Renders a thematic break (--- or *** or ___) as a horizontal rule. */
function renderHr() {
  const el = document.createElement('div');
  el.className = 'cm-lp-block cm-lp-hr';
  el.setAttribute('aria-hidden', 'true');
  return el;
}

/**
 * Renders a block of markdown source to a sanitized, styled fragment, reusing the
 * Read view's pipeline. Used for tables and non-mermaid code blocks.
 * @param {string} source raw markdown of the block
 */
function renderFragment(source) {
  const el = document.createElement('div');
  el.className = 'cm-lp-block cm-lp-rendered';
  el.innerHTML = renderMarkdown(source);
  return el;
}

/**
 * Render a mermaid diagram into `el` (async — mermaid is lazy-loaded). On failure
 * the raw source is shown so the diagram is still recoverable.
 * @param {HTMLElement} el @param {string} code
 */
async function renderMermaidInto(el, code) {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  try {
    el.innerHTML = await renderMermaidSvg(code, dark);
    el.classList.remove('cm-lp-mermaid-error');
  } catch {
    el.classList.add('cm-lp-mermaid-error');
    el.textContent = code;
  }
}

/**
 * Renders a fenced block: a mermaid diagram for a mermaid fence, otherwise a code block.
 * @param {string} source
 */
function renderFenced(source) {
  if (/^[`~]{3,}\s*mermaid\b/i.test(source)) {
    const el = document.createElement('div');
    el.className = 'cm-lp-block cm-lp-mermaid';
    const code = source
      .replace(/^[`~]{3,}[^\n]*\n?/, '') // opening fence + info line
      .replace(/\n?[`~]{3,}\s*$/, ''); // closing fence
    el.textContent = 'Rendering diagram…';
    renderMermaidInto(el, code);
    // mermaid bakes the theme into the SVG, so re-render on a light/dark switch.
    // The observer is disconnected in BlockWidget.destroy via __cmLpCleanup.
    const observer = new MutationObserver(() => renderMermaidInto(el, code));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    /** @type {any} */ (el).__cmLpCleanup = () => observer.disconnect();
    return el;
  }
  return renderFragment(source);
}

// Block-level syntax-tree nodes → their renderer. Replaced with a widget when
// inactive, shown as raw source when the cursor is inside.
const BLOCK_RENDERERS = /** @type {Record<string, (source: string) => HTMLElement>} */ ({
  HorizontalRule: renderHr,
  FencedCode: renderFenced,
  Table: renderFragment,
});

// Tree nodes worth descending into when hunting for block widgets — everything
// else (paragraphs, headings, inline) is pruned so the whole-doc pass stays cheap.
const BLOCK_CONTAINERS = new Set([
  'Document',
  'Blockquote',
  'BulletList',
  'OrderedList',
  'ListItem',
]);

/**
 * The set of 1-based line numbers any selection range touches. Markers/blocks on
 * these lines stay "raw" so they're editable (reveal-on-active-line).
 * @param {import('@codemirror/state').EditorState} state
 * @returns {Set<number>}
 */
function activeLines(state) {
  const doc = state.doc;
  const set = new Set();
  for (const r of state.selection.ranges) {
    const first = doc.lineAt(r.from).number;
    const last = doc.lineAt(r.to).number;
    for (let n = first; n <= last; n++) set.add(n);
  }
  return set;
}

/** Order-independent signature of an active-line set, for cheap change detection. */
function signature(/** @type {Set<number>} */ set) {
  return [...set].sort((a, b) => a - b).join(',');
}

// ── Inline decorations (ViewPlugin, viewport-culled) ──────────────────────────

/**
 * Compute inline Live Preview decorations for the editor's visible span.
 * @param {import('@codemirror/view').EditorView} view
 * @param {Set<number>} active 1-based line numbers the selection touches
 */
function buildInlineDecorations(view, active) {
  /** @type {import('@codemirror/state').Range<Decoration>[]} */
  const deco = [];
  const { state } = view;
  const doc = state.doc;
  const ranges = view.visibleRanges;
  if (ranges.length === 0) return Decoration.none;

  /** @param {number} pos */
  const isActive = (pos) => active.has(doc.lineAt(pos).number);
  /** Extend past the space(s) following a block marker (e.g. '# ', '> '). */
  const spaceEnd = (/** @type {number} */ to) => {
    let end = to;
    while (end < doc.length && doc.sliceString(end, end + 1) === ' ') end++;
    return end;
  };

  // Single pass across the whole visible span (visibleRanges are gap-free without
  // code folding, which this editor doesn't enable), avoiding double-decoration.
  syntaxTree(state).iterate({
    from: ranges[0].from,
    to: ranges[ranges.length - 1].to,
    enter: (node) => {
      const name = node.name;
      // Block constructs are handled by the StateField; never decorate inside them.
      if (BLOCK_RENDERERS[name]) return false;

      // Inline images: render in place (fallback to alt on error) when inactive.
      if (name === 'Image') {
        if (!isActive(node.from)) {
          const m = IMAGE_RE.exec(doc.sliceString(node.from, node.to));
          if (m) {
            deco.push(
              Decoration.replace({ widget: new ImageWidget(m[2] ?? m[3], m[1]) }).range(node.from, node.to),
            );
          }
        }
        return false; // don't descend into the image's link/url marks
      }

      // Content styling (applied even on active lines so it stays formatted
      // while the raw markers are revealed for editing).
      const headingClass = HEADING_CLASS[name];
      if (headingClass) {
        deco.push(Decoration.mark({ class: headingClass }).range(node.from, node.to));
      }
      const contentClass = CONTENT_CLASS[name];
      if (contentClass) {
        deco.push(Decoration.mark({ class: contentClass }).range(node.from, node.to));
      }
      // Blockquote: accent left border + muted italic on every line it spans.
      if (name === 'Blockquote') {
        const firstLine = doc.lineAt(node.from).number;
        const lastLine = doc.lineAt(Math.max(node.from, node.to - 1)).number;
        for (let n = firstLine; n <= lastLine; n++) {
          deco.push(Decoration.line({ class: 'cm-lp-quote' }).range(doc.line(n).from));
        }
      }

      // Marker hiding — skipped on active lines.
      if (isActive(node.from)) return;
      const parent = node.node.parent?.name;
      if (name === 'HeaderMark') {
        deco.push(hide.range(node.from, spaceEnd(node.to)));
      } else if (name === 'EmphasisMark' || name === 'StrikethroughMark') {
        deco.push(hide.range(node.from, node.to));
      } else if (name === 'CodeMark' && parent === 'InlineCode') {
        // CodeMark is shared with fenced code — only hide inline backticks.
        deco.push(hide.range(node.from, node.to));
      } else if (name === 'QuoteMark') {
        deco.push(hide.range(node.from, spaceEnd(node.to)));
      } else if (name === 'ListMark' && parent === 'ListItem') {
        if (/^[-*+]$/.test(doc.sliceString(node.from, node.to))) {
          deco.push(bullet.range(node.from, node.to));
        }
      }
    },
  });

  // Inline math ($…$): lezer doesn't parse it, so scan visible inactive lines.
  // Skip currency ("$5", "$ x $") and anything inside code (per the syntax tree).
  const tree = syntaxTree(state);
  const firstLine = doc.lineAt(ranges[0].from).number;
  const lastLine = doc.lineAt(ranges[ranges.length - 1].to).number;
  for (let n = firstLine; n <= lastLine; n++) {
    if (active.has(n)) continue;
    const line = doc.line(n);
    const re = /\$([^$\n]+?)\$/g;
    for (let m; (m = re.exec(line.text)); ) {
      const inner = m[1];
      const from = line.from + m.index;
      // Skip currency ("$ x $", math followed by a digit) and anything inside
      // code. Crucially, rewind lastIndex past only the opening '$' so a skipped
      // delimiter can still start a real span ("Cost $5 … $E=mc^2$").
      if (
        /^\s|\s$/.test(inner) ||
        /^\d/.test(line.text.slice(m.index + m[0].length)) ||
        /Code/.test(tree.resolveInner(from + 1, 1).name)
      ) {
        re.lastIndex = m.index + 1;
        continue;
      }
      deco.push(
        Decoration.replace({ widget: new MathInlineWidget(inner.trim()) }).range(from, from + m[0].length),
      );
    }
  }

  return Decoration.set(deco, /* sort */ true);
}

const inlineLivePreview = ViewPlugin.fromClass(
  class {
    /** @param {import('@codemirror/view').EditorView} view */
    constructor(view) {
      this.active = activeLines(view.state);
      this.sig = signature(this.active);
      this.decorations = buildInlineDecorations(view, this.active);
    }
    /** @param {import('@codemirror/view').ViewUpdate} update */
    update(update) {
      // Rebuild on doc/viewport changes and when the parser advances the tree
      // (or content past the initial parse horizon stays raw on large docs).
      const treeChanged = syntaxTree(update.state) !== syntaxTree(update.startState);
      if (update.docChanged || update.viewportChanged || treeChanged) {
        this.active = activeLines(update.state);
        this.sig = signature(this.active);
        this.decorations = buildInlineDecorations(update.view, this.active);
      } else if (update.selectionSet) {
        // Selection moves only matter when the set of active lines changes.
        const next = activeLines(update.state);
        const sig = signature(next);
        if (sig !== this.sig) {
          this.active = next;
          this.sig = sig;
          this.decorations = buildInlineDecorations(update.view, next);
        }
      }
    }
  },
  { decorations: (v) => v.decorations },
);

// ── Block widgets (StateField, whole-doc, facet-provided) ─────────────────────

/**
 * Compute block-widget decorations across the whole document. Block constructs
 * are replaced with a rendered widget unless the selection touches them, in which
 * case the raw source is left in place to edit.
 * @param {import('@codemirror/state').EditorState} state
 * @param {Set<number>} active 1-based line numbers the selection touches
 */
function buildBlockDecorations(state, active) {
  /** @type {import('@codemirror/state').Range<Decoration>[]} */
  const deco = [];
  const doc = state.doc;
  /** Replace the block's whole-line range with `render`'s widget unless active. */
  const pushBlock = (
    /** @type {number} */ from,
    /** @type {number} */ to,
    /** @type {(source: string) => HTMLElement} */ render,
  ) => {
    const firstLine = doc.lineAt(from).number;
    const lastLine = doc.lineAt(Math.max(from, to - 1)).number;
    for (let n = firstLine; n <= lastLine; n++) if (active.has(n)) return;
    const lineFrom = doc.line(firstLine).from;
    const lineTo = doc.line(lastLine).to;
    deco.push(
      Decoration.replace({
        widget: new BlockWidget(doc.sliceString(lineFrom, lineTo), render),
        block: true,
      }).range(lineFrom, lineTo),
    );
  };

  /** @type {[number, number][]} code regions where math delimiters don't apply */
  const codeRanges = [];
  syntaxTree(state).iterate({
    enter: (node) => {
      const name = node.name;
      if (name === 'FencedCode' || name === 'CodeBlock') codeRanges.push([node.from, node.to]);
      const render = BLOCK_RENDERERS[name];
      if (render) {
        pushBlock(node.from, node.to, render);
        return false; // don't descend into a block widget's children
      }
      // Prune everything that can't contain a block widget.
      return BLOCK_CONTAINERS.has(name) ? undefined : false;
    },
  });

  // Block math: $$…$$ that occupies whole line(s) (lezer doesn't parse math, so
  // scan the text), excluding anything inside a code block.
  const text = doc.toString();
  const re = /\$\$([\s\S]+?)\$\$/g;
  for (let m; (m = re.exec(text)); ) {
    const start = m.index;
    const end = start + m[0].length;
    if (codeRanges.some(([a, b]) => start < b && end > a)) continue;
    const lineA = doc.lineAt(start);
    const lineB = doc.lineAt(end);
    const lead = text.slice(lineA.from, start);
    // Only a block when $$…$$ is the sole content of its line(s) and not indented
    // as code (4+ leading spaces or a tab is a CommonMark indented code block).
    if (lead.trim() || text.slice(end, lineB.to).trim()) continue;
    if (lead.length >= 4 || lead.includes('\t')) continue;
    pushBlock(start, end, renderFragment);
  }

  return Decoration.set(deco, /* sort */ true);
}

const blockLivePreview = StateField.define({
  create(state) {
    const active = activeLines(state);
    return { sig: signature(active), decorations: buildBlockDecorations(state, active) };
  },
  update(value, tr) {
    const treeChanged = syntaxTree(tr.state) !== syntaxTree(tr.startState);
    if (tr.docChanged || treeChanged) {
      const active = activeLines(tr.state);
      return { sig: signature(active), decorations: buildBlockDecorations(tr.state, active) };
    }
    if (tr.selection) {
      // A block's rendered/source state only flips when the cursor crosses into
      // or out of its line(s); gate on the active-line signature so plain cursor
      // navigation doesn't re-scan the whole document each keystroke.
      const active = activeLines(tr.state);
      const sig = signature(active);
      if (sig !== value.sig) return { sig, decorations: buildBlockDecorations(tr.state, active) };
    }
    return value;
  },
  provide: (f) => EditorView.decorations.from(f, (v) => v.decorations),
});

/** The full Live Preview extension: inline (viewport) + block widgets (state). */
export const livePreview = [inlineLivePreview, blockLivePreview];
