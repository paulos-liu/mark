<script>
  import FileTreeNode from './FileTreeNode.svelte';

  let {
    node,
    activeFile = '',
    depth = 0,
    onopen,
  } = $props();

  // Folders default to expanded so the whole listing is visible at a glance.
  let expanded = $state(true);

  // Rows indent by depth; matches the design's 8 + depth*14 gutter.
  let indent = $derived(8 + depth * 14);
</script>

{#if node.type === 'folder'}
  <button
    class="tree-row"
    style="padding-left:{indent}px"
    onclick={() => (expanded = !expanded)}
    aria-expanded={expanded}
    title={node.name}
  >
    <span class="tw caret" class:collapsed={!expanded} style="width:12px" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="8" height="8"><path d="m6 9 6 6 6-6"/></svg>
    </span>
    <span class="tw" aria-hidden="true">
      {#if expanded}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><path d="M3.5 8V6.5a1.5 1.5 0 0 1 1.5-1.5h3.2a1.5 1.5 0 0 1 1.05.43L11 7h5.5A1.5 1.5 0 0 1 18 8.5V9M3 9.5h16.2a1 1 0 0 1 .96 1.27l-1.7 6A1.5 1.5 0 0 1 17 18H5a1.5 1.5 0 0 1-1.46-1.16L2.1 10.8A1 1 0 0 1 3 9.5Z"/></svg>
      {:else}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><path d="M3 7a2 2 0 0 1 2-2h3.4a2 2 0 0 1 1.4.6L11 7h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/></svg>
      {/if}
    </span>
    <span class="label">{node.name}</span>
  </button>
  {#if expanded}
    {#each node.children as child (child.path)}
      <FileTreeNode node={child} {activeFile} {onopen} depth={depth + 1} />
    {/each}
  {/if}
{:else}
  <button
    class="tree-row"
    class:on={node.path === activeFile}
    style="padding-left:{indent}px"
    onclick={() => onopen(node.path)}
    aria-current={node.path === activeFile ? 'true' : undefined}
    title={node.path}
  >
    <span class="tw" style="margin-left:18px" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" width="12" height="12">
        <path d="M6 3h7l5 5v11a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/><path d="M13 3v5h5"/><path d="M8 16v-3l1.5 1.7L11 13v3M14 13v3M14 16l1.4-1.6" stroke-width="1.4"/>
      </svg>
    </span>
    <span class="label">{node.name}</span>
  </button>
{/if}

<style>
  .tree-row {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 4px 8px;
    border: none;
    background: none;
    border-radius: 7px;
    cursor: default;
    text-align: left;
    color: var(--ink-2, #5d574e);
    font: 500 12.5px var(--ui, system-ui);
    white-space: nowrap;
    transition: background 0.1s, color 0.1s;
  }

  .tree-row:hover { background: var(--surface-2, #e9e6dd); color: var(--ink, #272320); }

  .tree-row.on {
    background: var(--accent-soft, rgba(194,104,63,.16));
    color: var(--accent, #c2683f);
    font-weight: 600;
  }

  .tw {
    width: 13px;
    height: 13px;
    flex: 0 0 13px;
    display: grid;
    place-items: center;
    color: var(--ink-3, #938c80);
  }

  .tree-row.on .tw { color: var(--accent, #c2683f); }

  .caret { transition: transform 0.15s; }
  .caret.collapsed { transform: rotate(-90deg); }

  .label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
</style>
