<script>
  let { files = /** @type {string[]} */ ([]), activeFile = '', onopen } = $props();

  /** @param {string} filePath */
  function fileName(filePath) {
    return filePath.split('/').pop() ?? filePath;
  }
</script>

<div class="browser">
  <div class="browser-header">
    <span class="browser-title">Files</span>
    <span class="browser-count">{files.length}</span>
  </div>
  <ul class="file-list">
    {#each files as file}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <li
        class="file-item"
        class:active={file === activeFile}
        role="option"
        aria-selected={file === activeFile}
        onclick={() => onopen(file)}
        title={file}
      >
        <svg class="file-icon" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
          <path fill="currentColor" d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 9 4.25V1.5Zm6.75.062V4.25c0 .138.112.25.25.25h2.688l-.011-.013-2.914-2.914-.013-.011Z"/>
        </svg>
        <span class="file-name">{fileName(file)}</span>
      </li>
    {/each}
  </ul>
</div>

<style>
  .browser {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .browser-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px 6px;
    flex-shrink: 0;
  }

  .browser-title {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted);
  }

  .browser-count {
    font-size: 11px;
    color: var(--text-muted);
    background: var(--input-bg);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 0 6px;
    min-width: 18px;
    text-align: center;
  }

  .file-list {
    list-style: none;
    margin: 0;
    padding: 0 4px 8px;
    overflow-y: auto;
    flex: 1;
  }

  .file-item {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 6px 8px;
    border-radius: 6px;
    cursor: pointer;
    color: var(--toc-text);
    font-size: 13px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .file-item:hover {
    background: var(--toc-hover);
  }

  .file-item.active {
    background: var(--accent);
    color: white;
  }

  .file-item.active .file-icon {
    color: white;
  }

  .file-icon {
    flex-shrink: 0;
    color: var(--text-muted);
  }

  .file-name {
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }
</style>
