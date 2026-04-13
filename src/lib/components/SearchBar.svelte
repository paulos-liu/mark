<script>
  let { searchText = $bindable(''), matchCount = 0, currentIndex = 0, onnext, onprev, onclose } = $props();

  function handleKeydown(e) {
    if (e.key === 'Escape') {
      onclose?.();
    } else if (e.key === 'Enter') {
      if (e.shiftKey) {
        onprev?.();
      } else {
        onnext?.();
      }
    }
  }
</script>

<div class="search-bar" role="search" aria-label="Document search">
  <div class="search-input-wrap">
    <svg class="search-icon" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path fill="currentColor" d="M11.5 7a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Zm-.82 4.74a6 6 0 1 1 1.06-1.06l3.04 3.04a.75.75 0 1 1-1.06 1.06l-3.04-3.04Z"/>
    </svg>
    <!-- svelte-ignore a11y_autofocus -->
    <input
      type="text"
      placeholder="Search..."
      bind:value={searchText}
      onkeydown={handleKeydown}
      autofocus
      aria-label="Search in document"
    />
  </div>

  {#if searchText}
    <span class="match-count" aria-live="polite">
      {matchCount > 0 ? `${currentIndex + 1} of ${matchCount}` : 'No results'}
    </span>
  {/if}

  <div class="nav-buttons">
    <button onclick={onprev} disabled={matchCount === 0} title="Previous (Shift+Enter)" aria-label="Previous match">
      <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
        <path fill="currentColor" d="M3.22 9.78a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1-1.06 1.06L8 6.06 4.28 9.78a.75.75 0 0 1-1.06 0Z"/>
      </svg>
    </button>
    <button onclick={onnext} disabled={matchCount === 0} title="Next (Enter)" aria-label="Next match">
      <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
        <path fill="currentColor" d="M12.78 6.22a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L3.22 7.28a.75.75 0 0 1 1.06-1.06L8 9.94l3.72-3.72a.75.75 0 0 1 1.06 0Z"/>
      </svg>
    </button>
  </div>

  <button class="close-btn" onclick={onclose} title="Close (Esc)" aria-label="Close search">
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <path fill="currentColor" d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"/>
    </svg>
  </button>
</div>

<style>
  .search-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    background: var(--search-bg, #f8f8f8);
    border-bottom: 1px solid var(--border, #e5e5e5);
  }

  .search-input-wrap {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    max-width: 300px;
    padding: 4px 8px;
    background: var(--input-bg, white);
    border: 1px solid var(--border, #e5e5e5);
    border-radius: 6px;
  }

  .search-input-wrap:focus-within {
    border-color: var(--accent, #0969da);
    box-shadow: 0 0 0 2px rgba(9, 105, 218, 0.15);
  }

  .search-icon {
    color: var(--text-muted, #999);
    flex-shrink: 0;
  }

  .search-input-wrap input {
    border: none;
    outline: none;
    background: none;
    font-size: 13px;
    width: 100%;
    color: inherit;
    font-family: inherit;
  }

  .match-count {
    font-size: 12px;
    color: var(--text-muted, #666);
    white-space: nowrap;
  }

  .nav-buttons {
    display: flex;
    gap: 2px;
  }

  .nav-buttons button,
  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    background: none;
    border-radius: 4px;
    cursor: pointer;
    color: var(--text-muted, #666);
  }

  .nav-buttons button:hover:not(:disabled),
  .close-btn:hover {
    background: var(--toc-hover, rgba(0, 0, 0, 0.08));
    color: var(--text, #333);
  }

  .nav-buttons button:disabled {
    opacity: 0.3;
    cursor: default;
  }
</style>
