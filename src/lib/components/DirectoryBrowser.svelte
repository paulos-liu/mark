<script>
  import { buildFileTree } from '../utils/fileTree.js';
  import FileTreeNode from './FileTreeNode.svelte';

  let { files = /** @type {string[]} */ ([]), activeFile = '', onopen } = $props();

  let tree = $derived(buildFileTree(files));
</script>

<div class="browser">
  {#if files.length === 0}
    <div class="empty">No markdown files in this folder</div>
  {:else}
    <div class="tree" role="tree" aria-label="Files">
      {#if tree.rootName}
        <FileTreeNode node={tree.root} {activeFile} {onopen} depth={0} />
      {:else}
        {#each tree.root.children as child (child.path)}
          <FileTreeNode node={child} {activeFile} {onopen} depth={0} />
        {/each}
      {/if}
    </div>
  {/if}
</div>

<style>
  .browser {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .empty {
    padding: 16px 12px;
    font: 400 12px var(--ui, system-ui);
    color: var(--ink-3, #938c80);
    text-align: center;
  }

  .tree {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 10px 8px 14px;
    scrollbar-width: thin;
    scrollbar-color: var(--line-2, #d8d2c5) transparent;
  }
</style>
