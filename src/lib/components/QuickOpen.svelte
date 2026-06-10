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

  $effect(() => { filtered; selectedIndex = 0; });
  $effect(() => { if (inputEl) inputEl.focus(); });

  function handleKeydown(e) {
    if (e.key === 'Escape') { e.stopPropagation(); onclose(); }
    if (e.key === 'ArrowDown') { e.preventDefault(); selectedIndex = Math.min(selectedIndex + 1, filtered.length - 1); }
    if (e.key === 'ArrowUp') { e.preventDefault(); selectedIndex = Math.max(selectedIndex - 1, 0); }
    if (e.key === 'Enter' && filtered[selectedIndex]) onopen(filtered[selectedIndex]);
  }

  /** @param {string} p */
  const fileName = (p) => p.split('/').pop() ?? p;
  /** @param {string} p */
  const dirName = (p) => { const parts = p.split('/'); parts.pop(); return parts.join('/').replace(/^\/Users\/[^/]+/, '~'); };
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="overlay" onclick={(e) => e.target === e.currentTarget && onclose()}>
  <div class="modal qo" role="dialog" aria-modal="true" aria-label="Quick Open" onclick={(e) => e.stopPropagation()}>
    <div class="qo-input">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" width="18" height="18" style="color:var(--ink-3);flex:0 0 18px" aria-hidden="true">
        <circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/>
      </svg>
      <!-- svelte-ignore a11y_autofocus -->
      <input
        bind:this={inputEl}
        bind:value={query}
        onkeydown={handleKeydown}
        placeholder="Go to file…"
        autocomplete="off"
        spellcheck="false"
        aria-label="Search recent files"
      />
      <kbd class="kbd">esc</kbd>
    </div>

    <div class="qo-list" role="listbox">
      {#if filtered.length === 0}
        <div class="qo-empty">
          {query ? `No files match "${query}"` : 'No recent files'}
        </div>
      {:else}
        {#each filtered as file, i}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <div
            class="qo-item"
            class:sel={i === selectedIndex}
            role="option"
            aria-selected={i === selectedIndex}
            onmouseenter={() => (selectedIndex = i)}
            onmousedown={() => onopen(file)}
          >
            <span class="qo-ico" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" width="15" height="15">
                <path d="M6 3h7l5 5v11a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/><path d="M13 3v5h5"/>
                <path d="M8 16v-3l1.5 1.7L11 13v3M14 13v3M14 16l1.4-1.6" stroke-width="1.3"/>
              </svg>
            </span>
            <div class="qo-meta">
              <div class="qo-name">{fileName(file)}</div>
              <div class="qo-path">{dirName(file)}</div>
            </div>
          </div>
        {/each}
      {/if}
    </div>

    <div class="qo-foot">
      <span class="k"><kbd class="kbd">↑↓</kbd> navigate</span>
      <span class="k"><kbd class="kbd">⏎</kbd> open</span>
      <span class="k"><kbd class="kbd">⌘O</kbd> recent files</span>
    </div>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 300;
    background: rgba(0,0,0,0.32);
    -webkit-backdrop-filter: blur(2px);
    backdrop-filter: blur(2px);
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding-top: 78px;
    animation: fade 0.14s ease;
  }

  @keyframes fade { from { opacity: 0; } }

  .modal.qo {
    width: 560px;
    max-width: 90vw;
    background: var(--surface-hi, #fff);
    border: 0.5px solid var(--line-2, #d8d2c5);
    border-radius: 14px;
    box-shadow: 0 30px 80px -12px rgba(var(--shadow-rgb, 30 25 18) / 0.5);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    animation: pop 0.16s cubic-bezier(.2,.8,.3,1);
  }

  @keyframes pop { from { opacity: 0; transform: translateY(-8px) scale(0.985); } }

  .qo-input {
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 15px 18px;
    border-bottom: 0.5px solid var(--line, #e6e1d7);
  }

  .qo-input input {
    flex: 1;
    border: none;
    background: none;
    outline: none;
    font: 500 17px var(--ui, system-ui);
    color: var(--ink, #272320);
  }

  .qo-input input::placeholder { color: var(--ink-3, #938c80); font-weight: 400; }

  .kbd {
    font: 600 10.5px var(--mono, monospace);
    background: var(--surface, #f3f1eb);
    border: 0.5px solid var(--line-2, #d8d2c5);
    border-bottom-width: 1.5px;
    border-radius: 5px;
    padding: 2px 6px;
    color: var(--ink-2, #5d574e);
    white-space: nowrap;
  }

  .qo-list { max-height: 300px; overflow-y: auto; padding: 6px; }

  .qo-item {
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 9px 10px;
    border-radius: 9px;
    cursor: default;
    color: var(--ink-2, #5d574e);
    transition: background 0.08s;
  }

  .qo-item.sel { background: var(--accent-soft, rgba(194,104,63,.16)); }

  .qo-ico {
    flex: 0 0 30px;
    width: 30px;
    height: 30px;
    border-radius: 8px;
    background: var(--surface, #f3f1eb);
    display: grid;
    place-items: center;
    color: var(--ink-3, #938c80);
    transition: background 0.1s, color 0.1s;
  }

  .qo-item.sel .qo-ico {
    background: var(--accent, #c2683f);
    color: #fff;
  }

  .qo-meta { flex: 1; min-width: 0; }

  .qo-name {
    font: 600 13.5px var(--ui, system-ui);
    color: var(--ink, #272320);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .qo-path {
    font: 500 11.5px var(--mono, monospace);
    color: var(--ink-3, #938c80);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    direction: rtl;
    text-align: left;
  }

  .qo-empty {
    padding: 34px;
    text-align: center;
    color: var(--ink-3, #938c80);
    font-size: 13px;
  }

  .qo-foot {
    display: flex;
    gap: 14px;
    align-items: center;
    padding: 9px 16px;
    border-top: 0.5px solid var(--line, #e6e1d7);
    font: 500 11px var(--ui, system-ui);
    color: var(--ink-3, #938c80);
  }

  .k { display: flex; align-items: center; gap: 5px; white-space: nowrap; }
</style>
