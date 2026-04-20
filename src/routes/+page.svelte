<script>
  import { onMount } from 'svelte';
  import 'katex/dist/katex.min.css';
  import { slide, fly } from 'svelte/transition';
  import Titlebar from '$lib/components/Titlebar.svelte';
  import MarkdownViewer from '$lib/components/MarkdownViewer.svelte';
  import TableOfContents from '$lib/components/TableOfContents.svelte';
  import SearchBar from '$lib/components/SearchBar.svelte';
  import FloatingTocButton from '$lib/components/FloatingTocButton.svelte';
  import SettingsDialog from '$lib/components/SettingsDialog.svelte';
  import QuickOpen from '$lib/components/QuickOpen.svelte';
  import DirectoryBrowser from '$lib/components/DirectoryBrowser.svelte';
  import { documentState, loadDocument } from '$lib/stores/document.svelte.js';
  import { addRecent } from '$lib/stores/recents.svelte.js';
  import { uiState } from '$lib/stores/ui.svelte.js';
  import { settings, updateSetting, resolveTheme } from '$lib/stores/settings.svelte.js';
  import {
    searchState,
    computeMatches,
    nextMatch,
    prevMatch,
  } from '$lib/stores/search.svelte.js';
  import { openMarkdownFile, readFile } from '$lib/utils/fileHandler.js';

  const ALLOWED_EXTENSIONS = ['.md', '.markdown', '.txt'];

  let showSettings = $state(false);
  let showQuickOpen = $state(false);
  let systemDark = $state(false);
  let sidebarWidth = $state(260);
  let isResizing = $state(false);
  let watchEnabled = $state(false);
  let directoryFiles = $state(/** @type {string[] | null} */ (null));

  let effectiveTheme = $derived(resolveTheme(systemDark));

  // Apply theme to document and native window titlebar
  $effect(() => {
    document.documentElement.setAttribute('data-theme', effectiveTheme);
    import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
      getCurrentWindow().setTheme(effectiveTheme).catch(() => {});
    }).catch(() => {});
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

  /** Wrapper around loadDocument that also tracks recents */
  async function openFile(content, filePath, fileName) {
    await loadDocument(content, filePath, fileName);
    if (filePath && filePath !== 'stdin') addRecent(filePath);
  }

  async function startWatchingFile(filePath) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('start_watch', { path: filePath });
      watchEnabled = true;
    } catch (err) {
      console.error('Failed to start watching:', err);
    }
  }

  async function stopWatchingFile() {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('stop_watch');
      watchEnabled = false;
    } catch {}
  }

  async function handleOpenFile() {
    try {
      const result = await openMarkdownFile();
      if (result) {
        await stopWatchingFile();
        await openFile(result.content, result.filePath, result.fileName);
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

  function startResize(e) {
    e.preventDefault();
    isResizing = true;
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    function onMouseMove(e) {
      const newWidth = Math.min(480, Math.max(180, startWidth + e.clientX - startX));
      sidebarWidth = newWidth;
    }

    function onMouseUp() {
      isResizing = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  const FONT_SIZES = [14, 16, 18, 20, 24];

  function handleZoomIn() {
    const next = FONT_SIZES.find((s) => s > settings.fontSize) ?? FONT_SIZES[FONT_SIZES.length - 1];
    updateSetting('fontSize', next);
  }

  function handleZoomOut() {
    const prev = [...FONT_SIZES].reverse().find((s) => s < settings.fontSize) ?? FONT_SIZES[0];
    updateSetting('fontSize', prev);
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
    if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
      e.preventDefault();
      const viewer = document.querySelector('.markdown-viewer');
      if (viewer) {
        const range = document.createRange();
        range.selectNodeContents(viewer);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
    if (e.key === 'Escape') {
      if (showQuickOpen) {
        showQuickOpen = false;
      } else if (showSettings) {
        showSettings = false;
      } else if (uiState.showSearch) {
        closeSearch();
      }
    }
    if ((e.metaKey || e.ctrlKey) && e.key === ',') {
      e.preventDefault();
      showSettings = !showSettings;
    }
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'e') {
      e.preventDefault();
      if (documentState.content) window.print();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
      e.preventDefault();
      showQuickOpen = !showQuickOpen;
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

    // Store unlisten functions so cleanup can call them
    let unlistenPromise = null;
    let unlistenOpenFile = null;
    let unlistenMenu = null;

    (async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const { listen } = await import('@tauri-apps/api/event');
        const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');

        // Listen for files opened via macOS file association / open command
        if (!destroyed) {
          unlistenOpenFile = await listen('open-file', async (event) => {
            if (destroyed) return;
            const path = /** @type {string} */ (event.payload);
            if (isAllowedFile(path)) {
              try {
                const result = await readFile(path);
                if (!destroyed) {
                  await openFile(result.content, result.filePath, result.fileName);
                }
              } catch (err) {
                console.error('Failed to open file from event:', err);
              }
            }
          });
        }

        // Listen for native macOS menu events
        if (!destroyed) {
          unlistenMenu = await listen('menu-event', (event) => {
            if (destroyed) return;
            const action = /** @type {string} */ (event.payload);
            switch (action) {
              case 'open-file': handleOpenFile(); break;
              case 'preferences': showSettings = !showSettings; break;
              case 'toggle-sidebar': uiState.showTOC = !uiState.showTOC; break;
              case 'find': toggleSearch(); break;
              case 'zoom-in': handleZoomIn(); break;
              case 'zoom-out': handleZoomOut(); break;
              case 'actual-size': updateSetting('fontSize', 16); break;
              case 'export-pdf': if (documentState.content) window.print(); break;
              case 'quick-open': showQuickOpen = !showQuickOpen; break;
              case 'toggle-watch':
                if (watchEnabled) {
                  stopWatchingFile();
                } else if (documentState.filePath) {
                  startWatchingFile(documentState.filePath);
                }
                break;
            }
          });
        }

        // Listen for file-changed events (from the file watcher)
        let unlistenFileChanged = null;
        if (!destroyed) {
          unlistenFileChanged = await listen('file-changed', async (event) => {
            if (destroyed) return;
            const path = /** @type {string} */ (event.payload);
            try {
              const result = await readFile(path);
              if (!destroyed) {
                await openFile(result.content, result.filePath, result.fileName);
              }
            } catch (err) {
              console.error('Failed to reload changed file:', err);
            }
          });
        }

        // Check if a file was passed via CLI args
        if (!destroyed) {
          const pendingFile = await invoke('get_pending_file');
          if (pendingFile && !destroyed) {
            try {
              const result = await readFile(pendingFile);
              if (!destroyed) {
                await openFile(result.content, result.filePath, result.fileName);
                // Check if -w flag was set
                const pendingWatch = await invoke('get_pending_watch');
                if (pendingWatch) await startWatchingFile(pendingFile);
              }
            } catch (err) {
              console.error('Failed to open file from CLI:', err);
            }
          }
        }

        // Check if a directory was passed via CLI (mark .)
        if (!destroyed) {
          const dirFiles = await invoke('get_pending_directory');
          if (dirFiles && dirFiles.length > 0 && !destroyed) {
            directoryFiles = dirFiles;
            uiState.showTOC = true;
            try {
              const result = await readFile(dirFiles[0]);
              if (!destroyed) await openFile(result.content, result.filePath, result.fileName);
            } catch (err) {
              console.error('Failed to open first directory file:', err);
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
                    await openFile(result.content, result.filePath, result.fileName);
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
              await openFile(result.content, result.filePath, result.fileName);
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
      if (unlistenOpenFile) unlistenOpenFile();
      if (unlistenMenu) unlistenMenu();
      // Await the unlisten promise in case it resolved after mount cleanup
      if (unlistenPromise) {
        unlistenPromise.then((unlisten) => unlisten());
      }
    };
  });
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="app-layout" class:resizing={isResizing}>
  {#if uiState.showTOC}
    <aside class="sidebar" style="width: {sidebarWidth}px" transition:slide={{ axis: 'x', duration: 200 }}>
      {#if directoryFiles}
        <DirectoryBrowser
          files={directoryFiles}
          activeFile={documentState.filePath}
          onopen={async (filePath) => {
            try {
              const result = await readFile(filePath);
              await openFile(result.content, result.filePath, result.fileName);
            } catch (err) {
              console.error('Failed to open file from directory browser:', err);
            }
          }}
        />
      {:else}
        <TableOfContents
          headings={documentState.headings}
          onselect={scrollToHeading}
          onsearch={toggleSearch}
          onsettings={() => (showSettings = true)}
        />
      {/if}
    </aside>
    <div class="resize-handle" onmousedown={startResize} role="separator" aria-label="Resize sidebar"></div>
  {/if}

  <main class="content">
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
        showCopyButton={settings.showCopyButton}
        frontmatter={documentState.frontmatter}
        showFrontmatter={settings.showFrontmatter}
        filePath={documentState.filePath}
        effectiveTheme={effectiveTheme}
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
  </main>
</div>

<FloatingTocButton
  active={uiState.showTOC}
  onclick={() => (uiState.showTOC = !uiState.showTOC)}
/>

{#if showSettings}
  <SettingsDialog onclose={() => (showSettings = false)} />
{/if}

{#if showQuickOpen}
  <QuickOpen
    onopen={async (filePath) => {
      showQuickOpen = false;
      try {
        const result = await readFile(filePath);
        await openFile(result.content, result.filePath, result.fileName);
      } catch (err) {
        console.error('Failed to open recent file:', err);
      }
    }}
    onclose={() => (showQuickOpen = false)}
  />
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
    border-top: 1px solid var(--border);
    box-sizing: border-box;
  }

  .sidebar {
    height: 100%;
    background: var(--sidebar-bg);
    border-right: 1px solid var(--border);
    overflow: hidden;
    flex-shrink: 0;
  }

  .resize-handle {
    width: 4px;
    margin-left: -4px;
    cursor: col-resize;
    flex-shrink: 0;
    z-index: 10;
    position: relative;
  }

  .resize-handle:hover,
  .resizing .resize-handle {
    background: var(--accent, #0969da);
    opacity: 0.5;
  }

  .resizing {
    user-select: none;
    cursor: col-resize;
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

  @media print {
    .sidebar,
    .resize-handle,
    :global(.floating-toc-btn),
    :global(.search-bar),
    :global(.settings-dialog),
    :global(.code-copy-btn) {
      display: none !important;
    }

    :global(body) {
      overflow: visible;
      height: auto;
    }

    .app-layout {
      height: auto;
    }

    .content {
      overflow: visible;
    }

    :global(.markdown-viewer) {
      overflow: visible;
      padding: 0;
    }

    :global(.markdown-body) {
      max-width: none !important;
    }
  }
</style>
