<script>
  let { headings = [], onselect, activeAnchor = '' } = $props();

  let collapsed = $state(/** @type {Set<string>} */ (new Set()));

  function flatten(nodes, depth = 0) {
    /** @type {Array<{text:string,anchor:string,depth:number,hasChildren:boolean}>} */
    const out = [];
    for (const h of nodes) {
      const key = h.anchor ?? h.id ?? h.text;
      const hasChildren = h.children?.length > 0;
      out.push({ text: h.text, anchor: key, depth, hasChildren });
      if (hasChildren && !collapsed.has(key)) {
        out.push(...flatten(h.children, depth + 1));
      }
    }
    return out;
  }

  let flat = $derived(flatten(headings));

  function toggleCollapse(anchor) {
    const next = new Set(collapsed);
    if (next.has(anchor)) next.delete(anchor);
    else next.add(anchor);
    collapsed = next;
  }
</script>

<div class="toc-wrap">
  {#if flat.length === 0}
    <div class="empty">No headings</div>
  {:else}
    <div class="toc-list">
      {#each flat as item (item.anchor)}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="toc-item"
          class:active={item.anchor === activeAnchor}
          style="padding-left: {8 + item.depth * 14}px"
        >
          {#if item.hasChildren}
            <button
              class="toc-caret"
              class:collapsed={collapsed.has(item.anchor)}
              onclick={() => toggleCollapse(item.anchor)}
              aria-label={collapsed.has(item.anchor) ? 'Expand section' : 'Collapse section'}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="8" height="8" aria-hidden="true">
                <path d="m6 9 6 6 6-6"/>
              </svg>
            </button>
          {:else}
            <span class="toc-caret-spacer"></span>
          {/if}
          <button
            class="toc-text"
            onclick={() => onselect(item.anchor)}
          >
            {item.text}
          </button>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .toc-wrap {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .toc-list {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 10px 8px 14px;
    scrollbar-width: thin;
    scrollbar-color: var(--line-2, #d8d2c5) transparent;
  }

  .toc-list::-webkit-scrollbar { width: 5px; }
  .toc-list::-webkit-scrollbar-thumb {
    background: var(--line-2, #d8d2c5);
    border-radius: 3px;
  }

  .empty {
    padding: 16px 10px;
    font-size: 12px;
    color: var(--ink-3, #938c80);
    text-align: center;
  }

  .toc-item {
    display: flex;
    align-items: center;
    gap: 0;
    position: relative;
    border-radius: 7px;
    transition: background 0.1s;
  }

  .toc-item:hover { background: var(--surface-2, #e9e6dd); }

  .toc-item.active { background: none; }

  .toc-item.active::before {
    content: "";
    position: absolute;
    left: 2px;
    top: 50%;
    transform: translateY(-50%);
    width: 3px;
    height: 16px;
    border-radius: 2px;
    background: var(--accent, #c2683f);
  }

  .toc-caret {
    width: 16px;
    height: 16px;
    flex: 0 0 16px;
    display: grid;
    place-items: center;
    border: none;
    background: none;
    padding: 0;
    color: var(--ink-3, #938c80);
    cursor: default;
    transition: transform 0.15s, color 0.1s;
    border-radius: 4px;
    margin-right: 2px;
    flex-shrink: 0;
  }

  .toc-caret:hover { color: var(--ink-2, #5d574e); background: var(--surface-2, #e9e6dd); }
  .toc-caret.collapsed { transform: rotate(-90deg); }

  .toc-caret-spacer {
    width: 16px;
    flex: 0 0 16px;
    margin-right: 2px;
  }

  .toc-text {
    flex: 1;
    min-width: 0;
    text-align: left;
    border: none;
    background: none;
    padding: 5px 6px 5px 2px;
    font: 500 12.5px var(--ui, system-ui);
    color: var(--ink-2, #5d574e);
    line-height: 1.35;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: default;
    border-radius: 5px;
    transition: color 0.1s;
  }

  .toc-item:hover .toc-text { color: var(--ink, #272320); }
  .toc-item.active .toc-text { color: var(--accent, #c2683f); font-weight: 600; }
</style>
