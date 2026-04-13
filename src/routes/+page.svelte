<script>
  import { onMount } from 'svelte';
  import { slide, fly } from 'svelte/transition';
  import Titlebar from '$lib/components/Titlebar.svelte';
  import MarkdownViewer from '$lib/components/MarkdownViewer.svelte';
  import TableOfContents from '$lib/components/TableOfContents.svelte';
  import SearchBar from '$lib/components/SearchBar.svelte';
  import FloatingTocButton from '$lib/components/FloatingTocButton.svelte';
  import SettingsDialog from '$lib/components/SettingsDialog.svelte';
  import { documentState, loadDocument } from '$lib/stores/document.svelte.js';
  import { uiState } from '$lib/stores/ui.svelte.js';
  import { settings, resolveTheme } from '$lib/stores/settings.svelte.js';
  import {
    searchState,
    computeMatches,
    nextMatch,
    prevMatch,
  } from '$lib/stores/search.svelte.js';
  import { openMarkdownFile, readFile } from '$lib/utils/fileHandler.js';

  const ALLOWED_EXTENSIONS = ['.md', '.markdown', '.txt'];

  let showSettings = $state(false);
  let systemDark = $state(false);

  let effectiveTheme = $derived(resolveTheme(systemDark));

  // Apply theme to document
  $effect(() => {
    document.documentElement.setAttribute('data-theme', effectiveTheme);
  });

  // Recompute matches when search text or content changes
  $effect(() => {
    computeMatches(documentState.content, searchState.searchText);
  });

  function scrollToHeading(anchor) {
    const el = document.getElementById(anchor);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  async function handleOpenFile() {
    try {
      const result = await openMarkdownFile();
      if (result) {
        await loadDocument(result.content, result.filePath, result.fileName);
      }
    } catch (err) {
      console.error('Failed to open file:', err);
    }
  }

  /** Centralized search close -- single source of truth for cleanup */
  function closeSearch() {
    uiState.showSearch = false;
    searchState.searchText = '';
  }

  function toggleSearch() {
    if (uiState.showSearch) {
      closeSearch();
    } else {
      uiState.showSearch = true;
    }
  }

  function handleKeydown(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'o') {
      e.preventDefault();
      handleOpenFile();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
      e.preventDefault();
      toggleSearch();
    }
    if (e.key === 'Escape') {
      if (showSettings) {
        showSettings = false;
      } else if (uiState.showSearch) {
        closeSearch();
      }
    }
    if ((e.metaKey || e.ctrlKey) && e.key === ',') {
      e.preventDefault();
      showSettings = !showSettings;
    }
  }

  /** Check if a file path has an allowed markdown extension */
  function isAllowedFile(filePath) {
    const lower = filePath.toLowerCase();
    return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
  }

  onMount(() => {
    let destroyed = false;

    // Track system dark mode preference
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    systemDark = mq.matches;
    const handler = (e) => (systemDark = e.matches);
    mq.addEventListener('change', handler);

    // Store the unlisten promise so cleanup can await it
    let unlistenPromise = null;

    (async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');

        // Check if a file was passed via CLI args
        if (!destroyed) {
          const pendingFile = await invoke('get_pending_file');
          if (pendingFile && !destroyed) {
            try {
              const result = await readFile(pendingFile);
              if (!destroyed) {
                await loadDocument(result.content, result.filePath, result.fileName);
              }
            } catch (err) {
              console.error('Failed to open file from CLI:', err);
            }
          }
        }

        // Set up drag-drop listener
        if (!destroyed) {
          const appWindow = getCurrentWebviewWindow();
          unlistenPromise = appWindow.onDragDropEvent(async (event) => {
            if (destroyed) return;
            if (event.payload.type === 'drop' && event.payload.paths?.length > 0) {
              const path = event.payload.paths[0];
              if (isAllowedFile(path)) {
                try {
                  const result = await readFile(path);
                  if (!destroyed) {
                    await loadDocument(result.content, result.filePath, result.fileName);
                  }
                } catch (err) {
                  console.error('Failed to read dropped file:', err);
                }
              }
            }
          });
        }
      } catch (err) {
        console.error('Tauri API initialization failed:', err);
      }

      // Check URL query params (works outside Tauri too, e.g. dev mode)
      if (!destroyed) {
        const params = new URLSearchParams(window.location.search);
        const filePath = params.get('file');
        if (filePath && isAllowedFile(filePath)) {
          try {
            const result = await readFile(filePath);
            if (!destroyed) {
              await loadDocument(result.content, result.filePath, result.fileName);
            }
          } catch (err) {
            console.error('Failed to load file from params:', err);
          }
        }
      }
    })();

    return () => {
      destroyed = true;
      mq.removeEventListener('change', handler);
      // Await the unlisten promise in case it resolved after mount cleanup
      if (unlistenPromise) {
        unlistenPromise.then((unlisten) => unlisten());
      }
    };
  });
</script>

<svelte:window onkeydown={handleKeydown} />

<Titlebar />

<div class="app-layout">
  {#if uiState.showTOC}
    <aside class="sidebar" transition:slide={{ axis: 'x', duration: 200 }}>
      <TableOfContents
        headings={documentState.headings}
        onselect={scrollToHeading}
        onsearch={toggleSearch}
        onsettings={() => (showSettings = true)}
      />
    </aside>
  {/if}

  <main class="content">
    {#if documentState.loading}
      <div class="loading-state" role="status" aria-live="polite">
        <div class="spinner" aria-hidden="true"></div>
        <p>Loading {documentState.fileName || 'file'}...</p>
      </div>
    {:else if documentState.content}
      <MarkdownViewer
        html={documentState.html}
        searchText={searchState.searchText}
        matches={searchState.matches}
        currentMatchIndex={searchState.currentMatchIndex}
        fontSize={settings.fontSize}
        contentWidth={settings.contentWidth}
      />
    {:else}
      <div class="empty-state">
        <div class="empty-content">
          <h2>Mark</h2>
          <p>Open a markdown file to get started</p>
          <p class="shortcut">
            <kbd>&#8984;+O</kbd> to open a file
          </p>
          <p class="shortcut">or drag and drop a <code>.md</code> file here</p>
        </div>
      </div>
    {/if}

    {#if uiState.showSearch}
      <SearchBar
        bind:searchText={searchState.searchText}
        matchCount={searchState.matches.length}
        currentIndex={searchState.currentMatchIndex}
        onnext={nextMatch}
        onprev={prevMatch}
        onclose={closeSearch}
      />
    {/if}
  </main>
</div>

<FloatingTocButton
  active={uiState.showTOC}
  onclick={() => (uiState.showTOC = !uiState.showTOC)}
/>

{#if showSettings}
  <SettingsDialog onclose={() => (showSettings = false)} />
{/if}

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif;
    font-size: 14px;
    line-height: 1.5;
    color: var(--text, #1f2328);
    background: var(--bg, #ffffff);
    overflow: hidden;
    height: 100vh;
  }

  :global(:root),
  :global([data-theme="light"]) {
    --bg: #ffffff;
    --sidebar-bg: #f6f8fa;
    --border: #d1d9e0;
    --text: #1f2328;
    --text-muted: #656d76;
    --accent: #0969da;
    --input-bg: #f6f8fa;
    --search-bg: #f6f8fa;
    --toc-text: #1f2328;
    --toc-arrow: #656d76;
    --toc-hover: rgba(208, 215, 222, 0.32);
  }

  :global([data-theme="dark"]) {
    --bg: #0d1117;
    --sidebar-bg: #161b22;
    --border: #30363d;
    --text: #e6edf3;
    --text-muted: #8b949e;
    --accent: #388bfd;
    --input-bg: #21262d;
    --search-bg: #161b22;
    --toc-text: #e6edf3;
    --toc-arrow: #8b949e;
    --toc-hover: rgba(177, 186, 196, 0.12);
  }

  .app-layout {
    display: flex;
    height: 100vh;
    width: 100vw;
  }

  .sidebar {
    width: 260px;
    min-width: 200px;
    max-width: 320px;
    height: 100vh;
    background: var(--sidebar-bg);
    border-right: 1px solid var(--border);
    overflow: hidden;
    flex-shrink: 0;
  }

  .content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
  }

  .empty-state {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 48px;
  }

  .empty-content {
    text-align: center;
    color: var(--text-muted);
  }

  .empty-content h2 {
    font-size: 32px;
    font-weight: 600;
    color: var(--text);
    margin: 0 0 8px;
  }

  .empty-content p {
    margin: 4px 0;
    font-size: 14px;
  }

  .shortcut {
    margin-top: 16px;
  }

  kbd {
    display: inline-block;
    padding: 2px 6px;
    font-size: 12px;
    font-family: -apple-system, BlinkMacSystemFont, monospace;
    background: var(--input-bg);
    border: 1px solid var(--border);
    border-radius: 4px;
    box-shadow: 0 1px 0 var(--border);
  }

  code {
    font-size: 13px;
    padding: 2px 5px;
    background: var(--input-bg);
    border-radius: 4px;
  }

  .loading-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: var(--text-muted);
    font-size: 13px;
  }

  .loading-state p {
    margin: 0;
  }

  .spinner {
    width: 24px;
    height: 24px;
    border: 2.5px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
