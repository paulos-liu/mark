<script>
  import { onMount } from 'svelte';
  import 'katex/dist/katex.min.css';
  import MarkdownViewer from '$lib/components/MarkdownViewer.svelte';
  import TableOfContents from '$lib/components/TableOfContents.svelte';
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
  import { openMarkdownFile, openFolderDialog, readFile } from '$lib/utils/fileHandler.js';

  const ALLOWED_EXTENSIONS = ['.md', '.markdown', '.txt'];
  const READ_FONTS = {
    serif: '"Newsreader", Georgia, serif',
    sans: '"Hanken Grotesk", system-ui, sans-serif',
    mono: '"JetBrains Mono", ui-monospace, monospace',
  };

  let showSettings = $state(false);
  let showQuickOpen = $state(false);
  let systemDark = $state(false);
  let sidebarWidth = $state(260);
  let isResizing = $state(false);
  let watchEnabled = $state(false);
  let directoryFiles = $state(/** @type {string[] | null} */ (null));
  let sbTab = $state('toc');
  let activeAnchor = $state('');
  let searchInputEl = $state(null);
  let openError = $state('');

  // An imported VS Code theme drives both the palette and light/dark mode;
  // otherwise the built-in Light/Dark/System setting (System follows the OS).
  let effectiveTheme = $derived(
    settings.vscodeTheme ? settings.vscodeTheme.type : resolveTheme(systemDark),
  );
  let readFontCss = $derived(READ_FONTS[settings.readFont] ?? READ_FONTS.serif);

  // Apply (or clear) the imported VS Code theme's CSS variables on :root.
  // Inline custom properties override the stylesheet's [data-theme] tokens.
  let appliedThemeVars = [];
  $effect(() => {
    const root = document.documentElement;
    for (const k of appliedThemeVars) root.style.removeProperty(k);
    appliedThemeVars = [];
    const vars = settings.vscodeTheme?.vars;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        root.style.setProperty(k, v);
        appliedThemeVars.push(k);
      }
    }
  });

  $effect(() => {
    const css = settings.customCSS;
    let el = document.getElementById('mark-custom-css');
    if (!el) {
      el = document.createElement('style');
      el.id = 'mark-custom-css';
      document.head.appendChild(el);
    }
    el.textContent = css;
  });

  $effect(() => {
    document.documentElement.setAttribute('data-theme', effectiveTheme);
    // In System mode, pass null so the OS drives the webview and
    // prefers-color-scheme keeps tracking the real system appearance.
    // Otherwise force the chosen light/dark (or imported theme's) mode.
    const isSystem = !settings.vscodeTheme && settings.theme === 'system';
    const windowTheme = isSystem ? null : effectiveTheme;
    import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
      getCurrentWindow().setTheme(windowTheme).catch(() => {});
    }).catch(() => {});
  });

  $effect(() => {
    computeMatches(documentState.content, searchState.searchText);
  });

  function scrollToHeading(anchor) {
    const el = document.getElementById(anchor);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      activeAnchor = anchor;
    }
  }

  async function openFile(content, filePath, fileName) {
    await loadDocument(content, filePath, fileName);
    const basename = filePath ? (filePath.split('/').pop() ?? '') : '';
    if (filePath && !basename.startsWith('mark_stdin_')) addRecent(filePath);
    activeAnchor = '';
  }

  /**
   * Read a file by path and display it, surfacing a user-visible message on
   * failure (e.g. a folder picked outside the app's allowed read scope).
   * @param {string} filePath
   */
  async function openByPath(filePath) {
    try {
      const result = await readFile(filePath);
      // Switching documents stops watching the previous file, like handleOpenFile.
      await stopWatchingFile();
      await openFile(result.content, result.filePath, result.fileName);
      openError = '';
      return true;
    } catch (err) {
      console.error('Failed to open file:', err);
      const name = filePath.split('/').pop() || 'file';
      openError = `Couldn't open “${name}”. It may be outside a folder Mark is allowed to read.`;
      return false;
    }
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

  async function exportPdf() {
    if (!documentState.content) return;
    try {
      const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
      await getCurrentWebviewWindow().print();
    } catch {
      window.print();
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
        directoryFiles = null;
        sbTab = 'toc';
        await openFile(result.content, result.filePath, result.fileName);
      }
    } catch (err) {
      console.error('Failed to open file:', err);
    }
  }

  async function handleOpenFolder() {
    try {
      const dir = await openFolderDialog();
      if (!dir) return;
      const { invoke } = await import('@tauri-apps/api/core');
      const files = /** @type {string[]} */ (await invoke('read_directory', { path: dir }));
      await stopWatchingFile();
      directoryFiles = files;
      sbTab = 'files';
      uiState.showTOC = true;
      if (files.length > 0) await openByPath(files[0]);
    } catch (err) {
      console.error('Failed to open folder:', err);
    }
  }

  function focusSearch() {
    searchInputEl?.focus();
    searchInputEl?.select();
  }

  function clearSearch() {
    searchState.searchText = '';
  }

  function startResize(e) {
    e.preventDefault();
    isResizing = true;
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    function onMouseMove(e) {
      sidebarWidth = Math.min(480, Math.max(180, startWidth + e.clientX - startX));
    }

    function onMouseUp() {
      isResizing = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  // Must stay within the settings slider range (14–22)
  const FONT_SIZES = [14, 16, 18, 20, 22];

  function handleZoomIn() {
    const next = FONT_SIZES.find((s) => s > settings.fontSize) ?? FONT_SIZES[FONT_SIZES.length - 1];
    updateSetting('fontSize', next);
  }

  function handleZoomOut() {
    const prev = [...FONT_SIZES].reverse().find((s) => s < settings.fontSize) ?? FONT_SIZES[0];
    updateSetting('fontSize', prev);
  }

  function handleKeydown(e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'o') {
      e.preventDefault();
      if (e.shiftKey) handleOpenFolder();
      else handleOpenFile();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
      e.preventDefault();
      focusSearch();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'a'
        && !(/** @type {Element} */ (e.target)?.closest?.('input, textarea, [contenteditable]'))) {
      e.preventDefault();
      const viewer = document.querySelector('.markdown-viewer');
      if (viewer) {
        const range = document.createRange();
        range.selectNodeContents(viewer);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
    }
    if (e.key === 'Escape') {
      if (showQuickOpen) { showQuickOpen = false; }
      else if (showSettings) { showSettings = false; }
      else if (searchState.searchText) { clearSearch(); searchInputEl?.blur(); }
    }
    if ((e.metaKey || e.ctrlKey) && e.key === ',') {
      e.preventDefault();
      showSettings = !showSettings;
    }
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'e') {
      e.preventDefault();
      exportPdf();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
      e.preventDefault();
      showQuickOpen = !showQuickOpen;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
      e.preventDefault();
      uiState.showTOC = !uiState.showTOC;
    }
  }

  function isAllowedFile(filePath) {
    const lower = filePath.toLowerCase();
    return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
  }

  /**
   * Resolve a relative markdown link (clicked in the viewer) against the
   * current document's directory and open it.
   * @param {string} href
   */
  function handleRelativeLink(href) {
    const fp = documentState.filePath;
    if (!fp) return;
    const clean = href.split('#')[0].split('?')[0];
    if (!clean) return;
    const baseDir = fp.slice(0, fp.lastIndexOf('/'));
    /** @type {string[]} */
    const out = [];
    for (const part of `${baseDir}/${clean}`.split('/')) {
      if (part === '' || part === '.') continue;
      if (part === '..') out.pop();
      else out.push(part);
    }
    const resolved = '/' + out.join('/');
    if (isAllowedFile(resolved)) openByPath(resolved);
  }

  let scrollSpyPending = false;
  function handleViewerScroll() {
    if (!uiState.showTOC || scrollSpyPending) return;
    scrollSpyPending = true;
    requestAnimationFrame(() => {
      scrollSpyPending = false;
      const viewer = document.querySelector('.markdown-viewer');
      if (!viewer) return;
      const headings = viewer.querySelectorAll('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]');
      if (!headings.length) return;
      const viewerTop = viewer.getBoundingClientRect().top;
      let active = headings[0].id;
      for (const h of headings) {
        if (h.getBoundingClientRect().top - viewerTop > 80) break;
        active = h.id;
      }
      if (active !== activeAnchor) activeAnchor = active;
    });
  }

  onMount(() => {
    let destroyed = false;

    // Dev-only hook: lets the Playwright suite populate the Files tree (which
    // is otherwise fed by a Tauri command unavailable in a plain browser).
    if (import.meta.env.DEV) {
      /** @type {any} */ (window).__markTest = {
        /** @param {string[]} paths */
        loadDirectory(paths) {
          directoryFiles = paths;
          sbTab = 'files';
          uiState.showTOC = true;
        },
        // Render markdown content directly (the real app reads files through a
        // Tauri command unavailable in a plain browser), so e2e tests can
        // exercise rendering, links, search, and frontmatter.
        loadContent(content, filePath = '/test/doc.md', fileName = 'doc.md') {
          directoryFiles = null;
          return openFile(content, filePath, fileName);
        },
      };
    }

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    systemDark = mq.matches;
    const handler = (e) => (systemDark = e.matches);
    mq.addEventListener('change', handler);

    let unlistenPromise = null;
    let unlistenOpenFile = null;
    let unlistenMenu = null;
    let unlistenFileChanged = null;

    (async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const { listen } = await import('@tauri-apps/api/event');
        const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');

        if (!destroyed) {
          unlistenOpenFile = await listen('open-file', async (event) => {
            if (destroyed) return;
            const path = /** @type {string} */ (event.payload);
            if (isAllowedFile(path)) {
              try {
                const result = await readFile(path);
                if (!destroyed) {
                  await stopWatchingFile();
                  directoryFiles = null;
                  sbTab = 'toc';
                  await openFile(result.content, result.filePath, result.fileName);
                }
              } catch (err) {
                console.error('Failed to open file from event:', err);
              }
            }
          });
        }

        if (!destroyed) {
          unlistenMenu = await listen('menu-event', (event) => {
            if (destroyed) return;
            const action = /** @type {string} */ (event.payload);
            switch (action) {
              case 'open-file': handleOpenFile(); break;
              case 'open-folder': handleOpenFolder(); break;
              case 'preferences': showSettings = !showSettings; break;
              case 'toggle-sidebar': uiState.showTOC = !uiState.showTOC; break;
              case 'find': focusSearch(); break;
              case 'zoom-in': handleZoomIn(); break;
              case 'zoom-out': handleZoomOut(); break;
              case 'actual-size': updateSetting('fontSize', 18); break;
              case 'export-pdf': exportPdf(); break;
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

        if (!destroyed) {
          unlistenFileChanged = await listen('file-changed', async (event) => {
            if (destroyed) return;
            const path = /** @type {string} */ (event.payload);
            // Ignore stale watch events for a file that's no longer displayed.
            if (path !== documentState.filePath) return;
            try {
              const result = await readFile(path);
              if (!destroyed) await loadDocument(result.content, result.filePath, result.fileName);
            } catch (err) {
              console.error('Failed to reload changed file:', err);
            }
          });
        }

        if (!destroyed) {
          const pendingFile = await invoke('get_pending_file');
          if (pendingFile && !destroyed) {
            try {
              const result = await readFile(pendingFile);
              if (!destroyed) {
                await openFile(result.content, result.filePath, result.fileName);
                const pendingWatch = await invoke('get_pending_watch');
                if (pendingWatch) await startWatchingFile(pendingFile);
              }
            } catch (err) {
              console.error('Failed to open file from CLI:', err);
            }
          }
        }

        if (!destroyed) {
          const dirFiles = await invoke('get_pending_directory');
          if (dirFiles && dirFiles.length > 0 && !destroyed) {
            directoryFiles = dirFiles;
            sbTab = 'files';
            uiState.showTOC = true;
            try {
              const result = await readFile(dirFiles[0]);
              if (!destroyed) await openFile(result.content, result.filePath, result.fileName);
            } catch (err) {
              console.error('Failed to open first directory file:', err);
            }
          }
        }

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
                    await stopWatchingFile();
                    directoryFiles = null;
                    sbTab = 'toc';
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

      if (!destroyed) {
        const params = new URLSearchParams(window.location.search);
        const filePath = params.get('file');
        if (filePath && isAllowedFile(filePath)) {
          try {
            const result = await readFile(filePath);
            if (!destroyed) await openFile(result.content, result.filePath, result.fileName);
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
      if (unlistenPromise) unlistenPromise.then((u) => u());
      if (unlistenFileChanged) unlistenFileChanged();
    };
  });
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="app-root"
  data-theme={effectiveTheme}
  class:resizing={isResizing}
>
  <!-- TITLEBAR -->
  <div class="titlebar" data-tauri-drag-region>
    <div class="traffic-spacer" data-tauri-drag-region></div>

    <button
      class="icon-btn tb-toggle"
      class:on={uiState.showTOC}
      onclick={() => (uiState.showTOC = !uiState.showTOC)}
      title={uiState.showTOC ? 'Hide sidebar (⌘\\)' : 'Show sidebar (⌘\\)'}
      aria-label={uiState.showTOC ? 'Hide sidebar' : 'Show sidebar'}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" width="16" height="16" aria-hidden="true">
        <rect x="3" y="4" width="18" height="16" rx="2"/>
        <path d="M9 4v16"/>
      </svg>
    </button>

    <div class="tb-title" data-tauri-drag-region>
      <span class="tb-app">Mark</span>
      {#if documentState.fileName}
        <span class="tb-file">{documentState.fileName}</span>
      {/if}
      {#if watchEnabled}
        <span class="tb-dirty" title="Watching for changes"></span>
      {/if}
    </div>

    <div class="tb-spacer" data-tauri-drag-region></div>

    <div class="tb-search" class:on={!!searchState.searchText}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;flex:0 0 14px;color:var(--ink-3)" aria-hidden="true">
        <circle cx="11" cy="11" r="7"/>
        <path d="m20 20-3.2-3.2"/>
      </svg>
      <input
        bind:this={searchInputEl}
        bind:value={searchState.searchText}
        placeholder="Find in document"
        onkeydown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); e.shiftKey ? prevMatch() : nextMatch(); }
          if (e.key === 'Escape') { clearSearch(); e.target.blur(); }
        }}
        aria-label="Search in document"
      />
      {#if searchState.searchText}
        <span class="tb-count">
          {searchState.matches.length ? `${searchState.currentMatchIndex + 1}/${searchState.matches.length}` : '0/0'}
        </span>
        <span class="tb-navbtns">
          <button class="icon-btn sm" onclick={prevMatch} disabled={!searchState.matches.length} title="Previous (⇧⏎)" aria-label="Previous match">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="12" height="12" aria-hidden="true"><path d="m6 14 6-6 6 6"/></svg>
          </button>
          <button class="icon-btn sm" onclick={nextMatch} disabled={!searchState.matches.length} title="Next (⏎)" aria-label="Next match">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="12" height="12" aria-hidden="true"><path d="m6 10 6 6 6-6"/></svg>
          </button>
        </span>
      {/if}
    </div>

    <button
      class="icon-btn"
      onclick={() => (showSettings = true)}
      title="Settings (⌘,)"
      aria-label="Settings"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="16" height="16" aria-hidden="true">
        <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    </button>
  </div>

  <!-- BODY -->
  <div class="body">
    <!-- Sidebar: always mounted, CSS width animates collapse -->
    <aside
      class="sidebar"
      class:collapsed={!uiState.showTOC}
      style="width:{uiState.showTOC ? sidebarWidth : 0}px"
    >
      <div class="sb-inner" style="width:{sidebarWidth}px">
        {#if directoryFiles}
          <div class="sb-tabs">
            <button class="sb-tab" class:on={sbTab === 'toc'} onclick={() => (sbTab = 'toc')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" width="14" height="14" aria-hidden="true">
                <path d="M8 6h12M8 12h12M8 18h12M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>
              </svg>
              Contents
            </button>
            <button class="sb-tab" class:on={sbTab === 'files'} onclick={() => (sbTab = 'files')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" width="14" height="14" aria-hidden="true">
                <path d="M3 7a2 2 0 0 1 2-2h3.4a2 2 0 0 1 1.4.6L11 7h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/>
              </svg>
              Files
            </button>
          </div>
          {#if sbTab === 'toc'}
            <TableOfContents
              headings={documentState.headings}
              onselect={scrollToHeading}
              activeAnchor={activeAnchor}
            />
          {:else}
            <DirectoryBrowser
              files={directoryFiles}
              activeFile={documentState.filePath}
              onopen={openByPath}
            />
          {/if}
        {:else}
          <TableOfContents
            headings={documentState.headings}
            onselect={scrollToHeading}
            activeAnchor={activeAnchor}
          />
        {/if}
      </div>
    </aside>

    {#if uiState.showTOC}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="sb-resize"
        class:drag={isResizing}
        onmousedown={startResize}
        role="separator"
        aria-label="Resize sidebar"
      ></div>
    {/if}

    <main class="reader">
      {#if documentState.loading}
        <div class="loading-state" role="status" aria-live="polite">
          <div class="spinner" aria-hidden="true"></div>
          <p>Loading {documentState.fileName || 'file'}…</p>
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
          readFont={readFontCss}
          onviewerscroll={handleViewerScroll}
          onopenrelative={handleRelativeLink}
        />
      {:else}
        <div class="empty-state">
          <div class="empty-content">
            <div class="empty-logo">M</div>
            <p class="empty-title">Mark</p>
            <p class="empty-desc">Open a file or a folder to get started</p>
            <div class="empty-actions">
              <button class="empty-btn" onclick={handleOpenFile}>Open File</button>
              <button class="empty-btn ghost" onclick={handleOpenFolder}>Open Folder</button>
            </div>
            <p class="empty-hint"><kbd>⌘O</kbd> file · <kbd>⇧⌘O</kbd> folder · or drag a <code>.md</code> file here</p>
          </div>
        </div>
      {/if}

      {#if openError}
        <div class="open-error" role="alert">
          <span>{openError}</span>
          <button class="open-error-x" onclick={() => (openError = '')} aria-label="Dismiss">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="13" height="13" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
          </button>
        </div>
      {/if}

      {#if watchEnabled}
        <div class="watch-badge" aria-label="File watching active">
          <span class="watch-dot" aria-hidden="true"></span>
          Watching
        </div>
      {/if}
    </main>
  </div>
</div>

{#if showSettings}
  <SettingsDialog onclose={() => (showSettings = false)} />
{/if}

{#if showQuickOpen}
  <QuickOpen
    onopen={async (filePath) => {
      showQuickOpen = false;
      await openByPath(filePath);
    }}
    onclose={() => (showQuickOpen = false)}
  />
{/if}

<style>
  /* ── Global tokens ── */
  :global(:root),
  :global([data-theme="light"]) {
    --paper:      #fbfaf7;
    --surface:    #f3f1eb;
    --surface-2:  #e9e6dd;
    --surface-hi: #ffffff;
    --ink:        #272320;
    --ink-2:      #5d574e;
    --ink-3:      #938c80;
    --line:       #e6e1d7;
    --line-2:     #d8d2c5;
    --code-bg:    #f4f2ec;
    --code-ink:   #43403a;
    --shadow-rgb: 30 25 18;
    --accent:     #c2683f;
    --accent-ink: #ffffff;
    --accent-soft: color-mix(in oklch, #c2683f 16%, transparent);
    --accent-line: color-mix(in oklch, #c2683f 38%, transparent);
    --tok-key: #a8543b; --tok-str: #5d7a3f; --tok-num: #9a6a2e;
    --tok-fn:  #3f6ea3; --tok-com: #a9a092; --tok-punc: #8a8478; --tok-attr: #6b5fa8;
    --ui:   "Hanken Grotesk", ui-sans-serif, system-ui, -apple-system, sans-serif;
    --mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
    color-scheme: light;
  }

  :global([data-theme="dark"]) {
    --paper:      #1b1815;
    --surface:    #211e19;
    --surface-2:  #2b2722;
    --surface-hi: #2e2a24;
    --ink:        #ece6db;
    --ink-2:      #a8a193;
    --ink-3:      #6f685d;
    --line:       #322e27;
    --line-2:     #3d3830;
    --code-bg:    #211e19;
    --code-ink:   #d2ccbf;
    --shadow-rgb: 0 0 0;
    --tok-key: #e0916f; --tok-str: #9dc06f; --tok-num: #d4a35e;
    --tok-fn:  #7fa9d8; --tok-com: #6f685d; --tok-punc: #8a8478; --tok-attr: #a99be0;
    --accent-soft: color-mix(in oklch, #c2683f 24%, transparent);
    --accent-line: color-mix(in oklch, #c2683f 46%, transparent);
    color-scheme: dark;
  }

  :global(*) { box-sizing: border-box; }

  :global(html),
  :global(body) {
    margin: 0;
    height: 100%;
    background: var(--paper);
    font-family: var(--ui);
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
    overflow: hidden;
  }

  :global(::selection) { background: var(--accent-soft); }

  /* ── Root ── */
  .app-root {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: var(--paper);
    color: var(--ink);
    font-size: 14px;
    font-family: var(--ui);
  }

  /* ── Titlebar ── */
  .titlebar {
    height: 46px;
    flex: 0 0 46px;
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 0 12px 0 13px;
    background: var(--surface);
    border-bottom: 0.5px solid var(--line);
    user-select: none;
    -webkit-user-select: none;
  }

  /* native traffic lights occupy 3×12px + 2×8px gaps starting at x:13 */
  .traffic-spacer {
    width: 58px;
    flex: 0 0 58px;
  }

  .tb-dirty {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--ink-3);
    margin-left: 2px;
    flex-shrink: 0;
    align-self: center;
  }

  /* serif titlebar title per the design screenshot */
  .tb-title {
    display: flex;
    align-items: baseline;
    gap: 7px;
    font-family: 'Newsreader', Georgia, serif;
    font-size: 14px;
    line-height: 1;
    /* Serif caps sit high in the line box. Fallback: optical nudge down to
       center with the icon buttons on engines without text-box trimming. */
    transform: translateY(2px);
    min-width: 0;
    flex: 0 1 auto;
    overflow: hidden;
  }

  /* Real fix on modern WebKit (Safari 18.2+): trim each text span's line box to
     cap height so its empty descender space is removed; align-items: center on
     .titlebar then centers the actual glyph mass exactly — no magic number.
     Must target the spans, not the flex .tb-title (flex generates no line box). */
  @supports (text-box: trim-both cap alphabetic) {
    /* text-box trims metrics to glyph mass; a sub-pixel nudge corrects the
       residual optical lift of mixed-case text (mass sits toward x-height). */
    .tb-title { transform: translateY(0.5px); }
    .tb-app,
    .tb-file { text-box: trim-both cap alphabetic; }
  }

  .tb-app {
    font-weight: 600;
    color: var(--ink);
    letter-spacing: -0.01em;
    flex-shrink: 0;
  }

  .tb-file {
    color: var(--ink-2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-weight: 500;
    font-size: 13px;
    min-width: 0;
  }

  .tb-spacer { flex: 1; min-width: 12px; }

  .tb-search {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 28px;
    width: 230px;
    max-width: 26vw;
    padding: 0 8px;
    background: var(--paper);
    border: 0.5px solid var(--line-2);
    border-radius: 8px;
    color: var(--ink-2);
    transition: border-color 0.12s, box-shadow 0.12s;
    flex-shrink: 0;
  }

  .tb-search.on {
    border-color: var(--accent-line);
    box-shadow: 0 0 0 3px var(--accent-soft);
  }

  .tb-search input {
    flex: 1;
    min-width: 0;
    border: none;
    background: none;
    outline: none;
    font: 500 12.5px var(--ui);
    color: var(--ink);
  }

  .tb-search input::placeholder {
    color: var(--ink-3);
    font-weight: 400;
  }

  .tb-count {
    font: 500 11px var(--mono);
    color: var(--ink-3);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .tb-navbtns { display: flex; gap: 1px; }

  /* ── Icon buttons ── */
  .icon-btn {
    width: 28px;
    height: 28px;
    border: none;
    background: none;
    padding: 0;
    border-radius: 7px;
    cursor: default;
    color: var(--ink-2);
    display: grid;
    place-items: center;
    transition: background 0.12s, color 0.12s;
    flex-shrink: 0;
  }

  .icon-btn:hover { background: var(--surface-2); color: var(--ink); }
  .icon-btn:disabled { opacity: 0.4; cursor: default; }
  .icon-btn.sm { width: 20px; height: 20px; border-radius: 5px; }

  .tb-toggle { margin-left: 2px; color: var(--ink-3); }
  .tb-toggle.on { color: var(--ink-2); }

  /* ── Body ── */
  .body { flex: 1; display: flex; min-height: 0; }

  /* ── Sidebar ── */
  .sidebar {
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    background: var(--surface);
    border-right: 0.5px solid var(--line);
    overflow: hidden;
    transition: width 0.26s cubic-bezier(.3,.7,.4,1);
  }

  .sidebar.collapsed { border-right-color: transparent; }

  .sb-inner {
    height: 100%;
    display: flex;
    flex-direction: column;
    flex: 0 0 auto;
    overflow: hidden;
  }

  .sb-tabs {
    display: flex;
    gap: 2px;
    padding: 10px 10px 8px;
    flex-shrink: 0;
  }

  .sb-tab {
    flex: 1;
    height: 26px;
    border: none;
    border-radius: 7px;
    background: none;
    cursor: default;
    color: var(--ink-2);
    font: 600 11.5px var(--ui);
    letter-spacing: 0.01em;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    transition: background 0.12s, color 0.12s;
  }

  .sb-tab:hover { background: var(--surface-2); color: var(--ink); }

  .sb-tab.on {
    background: var(--surface-hi);
    color: var(--ink);
    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  }

  :global([data-theme="dark"]) .sb-tab.on {
    box-shadow: inset 0 0 0 0.5px var(--line-2);
  }

  /* ── Resize handle ── */
  .sb-resize {
    flex: 0 0 1px;
    width: 1px;
    cursor: col-resize;
    position: relative;
    z-index: 5;
  }

  .sb-resize::after {
    content: "";
    position: absolute;
    inset: 0 -3px;
    transition: background 0.15s;
  }

  .sb-resize:hover::after,
  .sb-resize.drag::after { background: var(--accent-line); }

  /* ── Reader ── */
  .reader {
    flex: 1;
    min-width: 0;
    position: relative;
    display: flex;
    flex-direction: column;
  }

  /* ── Watch badge ── */
  .open-error {
    position: absolute;
    bottom: 14px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 7;
    display: flex;
    align-items: center;
    gap: 10px;
    max-width: min(560px, 80%);
    padding: 9px 9px 9px 14px;
    background: var(--surface-hi);
    border: 0.5px solid var(--line-2);
    border-left: 3px solid #c0392b;
    border-radius: 10px;
    color: var(--ink);
    font: 500 12.5px var(--ui);
    box-shadow: 0 4px 16px rgba(var(--shadow-rgb) / 0.18);
  }

  .open-error-x {
    flex: 0 0 auto;
    width: 22px;
    height: 22px;
    display: grid;
    place-items: center;
    border: none;
    background: none;
    border-radius: 5px;
    color: var(--ink-3);
    cursor: default;
    transition: background 0.12s, color 0.12s;
  }

  .open-error-x:hover { background: var(--surface-2); color: var(--ink); }

  .watch-badge {
    position: absolute;
    bottom: 14px;
    right: 16px;
    z-index: 6;
    display: flex;
    align-items: center;
    gap: 7px;
    height: 28px;
    padding: 0 11px 0 9px;
    background: var(--surface-hi);
    border: 0.5px solid var(--line-2);
    border-radius: 999px;
    color: var(--ink-2);
    font: 500 11.5px var(--ui);
    box-shadow: 0 2px 10px rgba(var(--shadow-rgb) / 0.12);
    pointer-events: none;
  }

  .watch-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #61c454;
    animation: pulse 2s ease-out infinite;
  }

  @keyframes pulse {
    0%   { box-shadow: 0 0 0 0 rgba(97,196,84,0.6); }
    70%  { box-shadow: 0 0 0 6px transparent; }
    100% { box-shadow: 0 0 0 0 transparent; }
  }

  /* ── Loading ── */
  .loading-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: var(--ink-3);
    font-size: 13px;
  }

  .loading-state p { margin: 0; }

  .spinner {
    width: 22px;
    height: 22px;
    border: 2px solid var(--line-2);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── Empty state ── */
  .empty-state {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 48px;
  }

  .empty-content {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .empty-logo {
    width: 56px;
    height: 56px;
    border-radius: 14px;
    background: var(--accent);
    color: #fff;
    font: 700 28px var(--ui);
    display: grid;
    place-items: center;
    letter-spacing: -0.02em;
    margin-bottom: 8px;
  }

  .empty-title {
    font: 700 22px var(--ui);
    color: var(--ink);
    letter-spacing: -0.02em;
    margin: 0;
  }

  .empty-desc { font-size: 14px; color: var(--ink-3); margin: 0; }

  .empty-actions {
    display: flex;
    gap: 10px;
    margin-top: 8px;
  }

  .empty-btn {
    padding: 8px 20px;
    background: var(--accent);
    color: var(--accent-ink, #fff);
    border: 0.5px solid transparent;
    border-radius: 9px;
    font: 600 13px var(--ui);
    cursor: default;
    transition: opacity 0.12s, background 0.12s;
  }

  .empty-btn:hover { opacity: 0.88; }

  .empty-btn.ghost {
    background: var(--surface-hi);
    color: var(--ink);
    border-color: var(--line-2);
  }

  .empty-btn.ghost:hover { opacity: 1; background: var(--surface-2); }

  .empty-hint { font-size: 12px; color: var(--ink-3); margin: 0; }

  .empty-hint kbd,
  .empty-hint code {
    font: 600 11px var(--mono);
    background: var(--surface);
    border: 0.5px solid var(--line-2);
    border-radius: 5px;
    padding: 1px 5px;
    color: var(--ink-2);
  }

  /* ── Resizing ── */
  .resizing { user-select: none; cursor: col-resize; }

  /* ── Print ── */
  @media print {
    .titlebar, .sidebar, .sb-resize, .watch-badge { display: none !important; }
    .app-root, .body { height: auto; }
    .reader { overflow: visible; }
    :global(.markdown-viewer) { overflow: visible; padding: 0; }
    :global(.markdown-body) { max-width: none !important; }
  }
</style>
