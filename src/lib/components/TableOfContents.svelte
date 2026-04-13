<script>
  import HeadingRow from './HeadingRow.svelte';
  import { filterHeadings } from '../utils/headings.js';

  let { headings = [], onselect, onsearch, onsettings } = $props();

  let tocSearch = $state('');

  let filtered = $derived(filterHeadings(headings, tocSearch));
</script>

<nav class="toc" aria-label="Table of contents">
  <div class="toc-search">
    <input
      type="text"
      placeholder="Filter headings..."
      bind:value={tocSearch}
      aria-label="Filter headings"
    />
  </div>

  <div class="toc-list">
    {#if filtered.length === 0}
      <p class="empty">
        {tocSearch ? 'No matches found' : 'No headings found'}
      </p>
    {:else}
      <ul class="heading-list">
        {#each filtered as heading (heading.id)}
          <li>
            <HeadingRow {heading} {onselect} />
          </li>
        {/each}
      </ul>
    {/if}
  </div>

  <div class="toc-toolbar">
    <button class="toolbar-btn" onclick={onsettings} title="Settings (Cmd+,)" aria-label="Settings">
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    </button>
    <button class="toolbar-btn" onclick={onsearch} title="Search in document (Cmd+F)" aria-label="Search in document">
      <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
        <path fill="currentColor" d="M11.5 7a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Zm-.82 4.74a6 6 0 1 1 1.06-1.06l3.04 3.04a.75.75 0 1 1-1.06 1.06l-3.04-3.04Z"/>
      </svg>
    </button>
  </div>
</nav>

<style>
  .toc {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding-top: 36px;
    box-sizing: border-box;
  }

  .toc-search {
    padding: 8px 12px;
    border-bottom: 1px solid var(--border, #e5e5e5);
    flex-shrink: 0;
  }

  .toc-search input {
    width: 100%;
    padding: 6px 10px;
    box-sizing: border-box;
    border: 1px solid var(--border, #e5e5e5);
    border-radius: 6px;
    font-size: 12px;
    background: var(--input-bg, #f5f5f5);
    color: inherit;
    outline: none;
    font-family: inherit;
  }

  .toc-search input:focus {
    border-color: var(--accent, #0969da);
    box-shadow: 0 0 0 2px rgba(9, 105, 218, 0.15);
  }

  .toc-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px 12px;
  }

  .heading-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .heading-list li {
    margin: 0;
  }

  .empty {
    color: var(--text-muted, #999);
    font-size: 12px;
    padding: 12px 0;
    text-align: center;
  }

  .toc-toolbar {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 4px;
    padding: 8px 12px;
    border-top: 1px solid var(--border, #e5e5e5);
    flex-shrink: 0;
  }

  .toolbar-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    background: none;
    border-radius: 6px;
    cursor: pointer;
    color: var(--text-muted, #656d76);
    transition: all 0.15s ease;
  }

  .toolbar-btn:hover {
    background: var(--toc-hover, rgba(0, 0, 0, 0.06));
    color: var(--text, #1f2328);
  }
</style>
