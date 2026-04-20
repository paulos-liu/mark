<script>
  import { recentFiles } from '$lib/stores/recents.svelte.js';

  let { onopen, onclose } = $props();

  let query = $state('');
  let selectedIndex = $state(0);
  let inputEl;

  let trimmedQuery = $derived(query.trim());
  let filtered = $derived(
    trimmedQuery
      ? recentFiles.filter((p) => p.toLowerCase().includes(trimmedQuery.toLowerCase()))
      : recentFiles
  );

  $effect(() => {
    // Reset selection when results change
    filtered;
    selectedIndex = 0;
  });

  $effect(() => {
    if (inputEl) inputEl.focus();
  });

  function handleKeydown(e) {
    if (e.key === 'Escape') { e.stopPropagation(); onclose(); }
    if (e.key === 'ArrowDown') { e.preventDefault(); selectedIndex = Math.min(selectedIndex + 1, filtered.length - 1); }
    if (e.key === 'ArrowUp') { e.preventDefault(); selectedIndex = Math.max(selectedIndex - 1, 0); }
    if (e.key === 'Enter' && filtered[selectedIndex]) { onopen(filtered[selectedIndex]); }
  }

  function handleBackdropClick(e) {
    if (e.target === e.currentTarget) onclose();
  }

  /** @param {string} filePath */
  function fileName(filePath) {
    return filePath.split('/').pop() ?? filePath;
  }

  /** @param {string} filePath */
  function dirName(filePath) {
    const parts = filePath.split('/');
    parts.pop();
    const dir = parts.join('/');
    return dir.replace(/^\/Users\/[^/]+/, '~');
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="backdrop" onclick={handleBackdropClick}>
  <div class="panel" role="dialog" aria-modal="true" aria-label="Quick Open">
    <div class="search-row">
      <svg class="search-icon" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <path fill="currentColor" d="M10.68 11.74a6 6 0 0 1-7.922-8.982 6 6 0 0 1 8.982 7.922l3.04 3.04a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215ZM11.5 7a4.499 4.499 0 1 0-8.997 0A4.499 4.499 0 0 0 11.5 7Z"/>
      </svg>
      <!-- svelte-ignore a11y_autofocus -->
      <input
        bind:this={inputEl}
        bind:value={query}
        onkeydown={handleKeydown}
        class="search-input"
        placeholder="Open recent file..."
        autocomplete="off"
        spellcheck="false"
      />
      <kbd class="hint">esc</kbd>
    </div>

    {#if filtered.length > 0}
      <ul class="results" role="listbox">
        {#each filtered as file, i}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <li
            class="result-item"
            class:selected={i === selectedIndex}
            role="option"
            aria-selected={i === selectedIndex}
            onclick={() => onopen(file)}
            onmouseenter={() => (selectedIndex = i)}
          >
            <span class="file-name">{fileName(file)}</span>
            <span class="file-dir">{dirName(file)}</span>
          </li>
        {/each}
      </ul>
    {:else}
      <div class="empty">No recent files{query ? ' matching your search' : ''}</div>
    {/if}
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 300;
    background: rgba(0, 0, 0, 0.35);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 80px;
    backdrop-filter: blur(2px);
  }

  .panel {
    width: 560px;
    max-width: 90vw;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
    overflow: hidden;
    max-height: 60vh;
    display: flex;
    flex-direction: column;
  }

  .search-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
  }

  .search-icon {
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .search-input {
    flex: 1;
    border: none;
    background: none;
    font-size: 14px;
    color: var(--text);
    outline: none;
    font-family: inherit;
  }

  .search-input::placeholder {
    color: var(--text-muted);
  }

  .hint {
    font-size: 11px;
    padding: 2px 5px;
    background: var(--input-bg);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .results {
    list-style: none;
    margin: 0;
    padding: 4px 0;
    overflow-y: auto;
  }

  .result-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 16px;
    cursor: pointer;
    overflow: hidden;
  }

  .result-item.selected {
    background: var(--accent);
    color: white;
  }

  .result-item.selected .file-dir {
    opacity: 0.75;
  }

  .file-name {
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex-shrink: 0;
    max-width: 50%;
  }

  .file-dir {
    font-size: 11px;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: right;
    direction: rtl;
    min-width: 0;
  }

  .result-item.selected .file-dir {
    color: inherit;
  }

  .empty {
    padding: 24px 16px;
    text-align: center;
    font-size: 13px;
    color: var(--text-muted);
  }
</style>
