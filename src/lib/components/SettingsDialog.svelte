<script>
  import { invoke } from '@tauri-apps/api/core';
  import { settings, updateSetting } from '../stores/settings.svelte.js';
  import { parseVscodeTheme, vscodeThemeToVars } from '../utils/vscodeTheme.js';
  import { THEME_PRESETS } from '../themes/presets.js';

  let { onclose } = $props();

  let cliStatus = $state('');
  let cliError = $state('');
  let themeError = $state('');
  let dialogEl;

  // Built-in palettes plus the bundled VS Code presets feed one dropdown.
  const BUILT_IN = [
    { id: 'light', label: 'Light' },
    { id: 'dark', label: 'Dark' },
    { id: 'system', label: 'System' },
  ];

  // An imported theme isn't one of the bundled presets, so it needs its own
  // entry in the dropdown to stay selectable/visible.
  let importedActive = $derived(
    !!settings.vscodeTheme &&
      !THEME_PRESETS.some((p) => p.name === settings.vscodeTheme.name),
  );

  let currentThemeId = $derived.by(() => {
    const vt = settings.vscodeTheme;
    if (vt) {
      const preset = THEME_PRESETS.find((p) => p.name === vt.name);
      return preset ? `preset:${preset.name}` : 'imported';
    }
    return settings.theme; // 'light' | 'dark' | 'system'
  });

  /** @param {any} preset */
  function applyPreset(preset) {
    themeError = '';
    const mark = vscodeThemeToVars(preset);
    if (mark) updateSetting('vscodeTheme', mark);
  }

  /** @param {string} id */
  function selectTheme(id) {
    themeError = '';
    if (id === 'light' || id === 'dark' || id === 'system') {
      updateSetting('vscodeTheme', null);
      updateSetting('theme', id);
    } else if (id.startsWith('preset:')) {
      const preset = THEME_PRESETS.find((p) => p.name === id.slice('preset:'.length));
      if (preset) applyPreset(preset);
    }
    // 'imported' is already the active theme — selecting it is a no-op.
  }

  async function importThemeFile() {
    themeError = '';
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const { readTextFile } = await import('@tauri-apps/plugin-fs');
      const selected = await open({
        multiple: false,
        filters: [{ name: 'VS Code theme', extensions: ['json', 'jsonc'] }],
      });
      if (!selected) return;
      const path = typeof selected === 'string' ? selected : /** @type {any} */ (selected).path;
      const text = await readTextFile(path);
      const mark = parseVscodeTheme(text);
      if (!mark) {
        themeError = 'That file is not a recognizable VS Code theme.';
        return;
      }
      updateSetting('vscodeTheme', mark);
    } catch (err) {
      themeError = String(err);
    }
  }

  function handleBackdropClick(e) {
    if (e.target === e.currentTarget) onclose();
  }

  $effect(() => {
    if (!dialogEl) return;
    dialogEl.focus();
  });

  async function installCli() {
    cliStatus = ''; cliError = '';
    try {
      const result = await invoke('install_cli');
      cliStatus = String(result);
    } catch (err) { cliError = String(err); }
  }

  async function uninstallCli() {
    cliStatus = ''; cliError = '';
    try {
      const result = await invoke('uninstall_cli');
      cliStatus = result === 'Not installed' ? 'CLI not found' : `Removed from ${result}`;
    } catch (err) { cliError = String(err); }
  }

  const widths = [
    { label: 'Narrow', value: 560 },
    { label: 'Default', value: 680 },
    { label: 'Wide',    value: 820 },
    { label: 'Full',    value: 9999 },
  ];
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="overlay" onclick={handleBackdropClick}>
  <div
    class="modal"
    role="dialog"
    aria-modal="true"
    aria-label="Settings"
    bind:this={dialogEl}
    tabindex="-1"
    onclick={(e) => e.stopPropagation()}
  >
    <div class="set-head">
      <h2>Settings</h2>
      <button class="icon-btn" onclick={onclose} aria-label="Close settings">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18"/>
        </svg>
      </button>
    </div>

    <div class="set-body">
      <!-- Editor theme (window palette + VS Code themes) -->
      <div class="set-row">
        <div class="set-lt">
          <div class="set-label">Editor theme</div>
          <div class="set-desc">
            {#if themeError}
              <span class="cli-err">{themeError}</span>
            {:else if importedActive}
              Using <strong>{settings.vscodeTheme.name}</strong> — imported from a VS Code theme.
            {:else}
              The window palette — a built-in look or any VS Code theme.
            {/if}
          </div>
        </div>
        <div class="theme-row">
          <div class="select-wrap">
            <select
              class="theme-select"
              aria-label="Editor theme"
              value={currentThemeId}
              onchange={(e) => selectTheme(e.currentTarget.value)}
            >
              <optgroup label="Built-in">
                {#each BUILT_IN as b}
                  <option value={b.id}>{b.label}</option>
                {/each}
              </optgroup>
              <optgroup label="VS Code themes">
                {#each THEME_PRESETS as preset}
                  <option value={"preset:" + preset.name}>{preset.name}</option>
                {/each}
                {#if importedActive}
                  <option value="imported">{settings.vscodeTheme.name}</option>
                {/if}
              </optgroup>
            </select>
            <svg class="select-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
          </div>
          <button class="btn" onclick={importThemeFile}>Import…</button>
        </div>
      </div>

      <!-- Reading font -->
      <div class="set-row">
        <div class="set-lt">
          <div class="set-label">Reading font</div>
          <div class="set-desc">Typeface for body text.</div>
        </div>
        <div class="segmented">
          {#each [['serif','Serif'],['sans','Sans'],['mono','Mono']] as [v, label]}
            <button class="seg" class:on={settings.readFont === v} onclick={() => updateSetting('readFont', v)}>{label}</button>
          {/each}
        </div>
      </div>

      <!-- Font size -->
      <div class="set-row">
        <div class="set-lt">
          <div class="set-label">Font size</div>
          <div class="set-desc">Body text size.</div>
        </div>
        <div class="slider-row">
          <input
            type="range"
            min="14" max="22" step="1"
            value={settings.fontSize}
            oninput={(e) => updateSetting('fontSize', Number(e.target.value))}
            aria-label="Font size"
          />
          <span class="slider-val">{settings.fontSize}px</span>
        </div>
      </div>

      <!-- Content width -->
      <div class="set-row">
        <div class="set-lt">
          <div class="set-label">Content width</div>
          <div class="set-desc">How wide the reading column gets.</div>
        </div>
        <div class="segmented full">
          {#each widths as w}
            <button class="seg" class:on={settings.contentWidth === w.value} onclick={() => updateSetting('contentWidth', w.value)}>
              {w.label}
            </button>
          {/each}
        </div>
      </div>

      <!-- Copy button -->
      <div class="set-row">
        <div class="set-lt">
          <div class="set-label">Copy button</div>
          <div class="set-desc">Show a copy button on code blocks.</div>
        </div>
        <div class="segmented">
          {#each [[true, 'On'], [false, 'Off']] as [v, label]}
            <button class="seg" class:on={settings.showCopyButton === v} onclick={() => updateSetting('showCopyButton', v)}>{label}</button>
          {/each}
        </div>
      </div>

      <!-- Frontmatter -->
      <div class="set-row">
        <div class="set-lt">
          <div class="set-label">Frontmatter</div>
          <div class="set-desc">Show YAML metadata at the top of documents.</div>
        </div>
        <div class="segmented">
          {#each [[true, 'On'], [false, 'Off']] as [v, label]}
            <button class="seg" class:on={settings.showFrontmatter === v} onclick={() => updateSetting('showFrontmatter', v)}>{label}</button>
          {/each}
        </div>
      </div>

      <!-- Editing experience -->
      <div class="set-row">
        <div class="set-lt">
          <div class="set-label">Editing experience</div>
          <div class="set-desc">
            Live renders Markdown in place (revealing syntax on the cursor's line);
            Source shows raw Markdown.
          </div>
        </div>
        <div class="segmented">
          {#each [['live', 'Live'], ['source', 'Source']] as [v, label]}
            <button class="seg" class:on={settings.editorMode === v} onclick={() => updateSetting('editorMode', v)}>{label}</button>
          {/each}
        </div>
      </div>

      <!-- Default view -->
      <div class="set-row">
        <div class="set-lt">
          <div class="set-label">Open documents in</div>
          <div class="set-desc">Which view a document opens in.</div>
        </div>
        <div class="segmented">
          {#each [['read', 'Reading'], ['edit', 'Editing']] as [v, label]}
            <button class="seg" class:on={settings.defaultMode === v} onclick={() => updateSetting('defaultMode', v)}>{label}</button>
          {/each}
        </div>
      </div>

      <!-- Sidebar on launch -->
      <div class="set-row">
        <div class="set-lt">
          <div class="set-label">Sidebar on launch</div>
          <div class="set-desc">Open the sidebar automatically when the app starts.</div>
        </div>
        <div class="segmented">
          {#each [[true, 'Open'], [false, 'Collapsed']] as [v, label]}
            <button class="seg" class:on={settings.sidebarOnStart === v} onclick={() => updateSetting('sidebarOnStart', v)}>{label}</button>
          {/each}
        </div>
      </div>

      <!-- Custom CSS -->
      <div class="set-row col">
        <div class="set-lt">
          <div class="set-label">Custom CSS</div>
          <div class="set-desc">Applied to the rendered markdown. Live preview as you type.</div>
        </div>
        <textarea
          class="set-css"
          spellcheck="false"
          placeholder=".markdown-body h1 &#123; letter-spacing: -0.04em; &#125;"
          bind:value={settings.customCSS}
          oninput={() => updateSetting('customCSS', settings.customCSS)}
        ></textarea>
      </div>

      <!-- CLI -->
      <div class="set-row">
        <div class="set-lt">
          <div class="set-label">Command-line tool</div>
          <div class="set-desc">
            {#if cliStatus}
              <span class="cli-ok">{cliStatus}</span>
            {:else if cliError}
              <span class="cli-err">{cliError}</span>
            {:else}
              Install <code>mark</code> to open files from your terminal.
            {/if}
          </div>
        </div>
        <div class="cli-btns">
          <button class="btn accent" onclick={installCli}>Install CLI</button>
          <button class="btn danger" onclick={uninstallCli}>Uninstall</button>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 200;
    background: rgba(0,0,0,0.32);
    -webkit-backdrop-filter: blur(2px);
    backdrop-filter: blur(2px);
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fade 0.14s ease;
  }

  @keyframes fade { from { opacity: 0; } }

  .modal {
    background: var(--surface-hi, #fff);
    border: 0.5px solid var(--line-2, #d8d2c5);
    border-radius: 14px;
    width: 580px;
    max-width: 92vw;
    max-height: 84vh;
    box-shadow: 0 30px 80px -12px rgba(var(--shadow-rgb, 30 25 18) / 0.45);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    outline: none;
    animation: pop 0.16s cubic-bezier(.2,.8,.3,1);
  }

  @keyframes pop { from { opacity: 0; transform: translateY(-8px) scale(0.985); } }

  .set-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 17px 20px;
    border-bottom: 0.5px solid var(--line, #e6e1d7);
    flex-shrink: 0;
  }

  .set-head h2 {
    margin: 0;
    font: 650 17px var(--ui, system-ui);
    letter-spacing: -0.01em;
    color: var(--ink, #272320);
  }

  .icon-btn {
    width: 28px; height: 28px;
    border: none; background: none; padding: 0;
    border-radius: 7px; cursor: default;
    color: var(--ink-2, #5d574e);
    display: grid; place-items: center;
    transition: background 0.12s, color 0.12s;
  }

  .icon-btn:hover { background: var(--surface-2, #e9e6dd); color: var(--ink, #272320); }

  .set-body {
    padding: 6px 20px 20px;
    overflow-y: auto;
    flex: 1;
  }

  .set-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    padding: 15px 0;
    border-bottom: 0.5px solid var(--line, #e6e1d7);
  }

  .set-row:last-child { border-bottom: none; }
  .set-row.col { flex-direction: column; align-items: stretch; gap: 9px; }

  .set-lt { min-width: 0; flex: 1; }

  .set-label {
    font: 600 13.5px var(--ui, system-ui);
    color: var(--ink, #272320);
  }

  .set-desc {
    font: 400 12px var(--ui, system-ui);
    color: var(--ink-3, #938c80);
    margin-top: 2px;
    line-height: 1.45;
  }

  .set-desc code {
    font: 600 11.5px var(--mono, monospace);
    background: var(--code-bg, #f4f2ec);
    border: 0.5px solid var(--line, #e6e1d7);
    border-radius: 4px;
    padding: 1px 5px;
    color: var(--ink, #272320);
  }

  .cli-ok { color: #5d7a3f; font-weight: 500; }
  .cli-err { color: #c0392b; font-weight: 500; }

  /* Segmented control */
  .segmented {
    display: flex;
    background: var(--surface, #f3f1eb);
    border-radius: 9px;
    padding: 3px;
    gap: 2px;
    flex: 0 0 auto;
  }

  .segmented.full { flex: 1; }

  .seg {
    border: none;
    background: none;
    cursor: default;
    border-radius: 7px;
    padding: 6px 12px;
    font: 600 12px var(--ui, system-ui);
    color: var(--ink-2, #5d574e);
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    white-space: nowrap;
    transition: background 0.12s, color 0.12s;
  }

  .seg.on {
    background: var(--surface-hi, #fff);
    color: var(--ink, #272320);
    box-shadow: 0 1px 2px rgba(0,0,0,0.08);
  }

  :global([data-theme="dark"]) .seg.on {
    box-shadow: inset 0 0 0 0.5px var(--line-2, #3d3830);
  }

  /* Slider */
  .slider-row {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 0 0 auto;
  }

  .slider-row input[type="range"] {
    width: 130px;
    accent-color: var(--accent, #c2683f);
  }

  .slider-val {
    font: 600 12px var(--mono, monospace);
    color: var(--ink-2, #5d574e);
    width: 36px;
    text-align: right;
  }

  /* CSS textarea */
  .set-css {
    width: 100%;
    min-height: 80px;
    resize: vertical;
    background: var(--code-bg, #f4f2ec);
    border: 0.5px solid var(--line-2, #d8d2c5);
    border-radius: 9px;
    padding: 10px 12px;
    font: 12.5px/1.6 var(--mono, monospace);
    color: var(--code-ink, #43403a);
    outline: none;
  }

  .set-css:focus {
    border-color: var(--accent-line, rgba(194,104,63,.38));
    box-shadow: 0 0 0 3px var(--accent-soft, rgba(194,104,63,.16));
  }

  /* Theme dropdown + import */
  .theme-row {
    display: flex;
    gap: 8px;
    align-items: center;
    flex: 0 0 auto;
  }

  .select-wrap {
    position: relative;
    display: flex;
    align-items: center;
  }

  .theme-select {
    appearance: none;
    -webkit-appearance: none;
    min-width: 156px;
    padding: 7px 30px 7px 12px;
    background: var(--surface-hi, #fff);
    border: 0.5px solid var(--line-2, #d8d2c5);
    border-radius: 8px;
    font: 600 12.5px var(--ui, system-ui);
    color: var(--ink, #272320);
    cursor: default;
  }

  .theme-select:focus {
    outline: none;
    border-color: var(--accent-line, rgba(194,104,63,.38));
    box-shadow: 0 0 0 3px var(--accent-soft, rgba(194,104,63,.16));
  }

  .select-chev {
    position: absolute;
    right: 9px;
    color: var(--ink-3, #938c80);
    pointer-events: none;
  }

  /* CLI buttons */
  .cli-btns { display: flex; gap: 8px; flex-shrink: 0; }

  .btn {
    border: 0.5px solid var(--line-2, #d8d2c5);
    background: var(--surface-hi, #fff);
    cursor: default;
    border-radius: 8px;
    padding: 8px 14px;
    font: 600 12.5px var(--ui, system-ui);
    color: var(--ink, #272320);
    display: inline-flex;
    align-items: center;
    gap: 6px;
    transition: background 0.12s;
    white-space: nowrap;
  }

  .btn:hover { background: var(--surface-2, #e9e6dd); }

  .btn.accent {
    background: var(--accent, #c2683f);
    color: #fff;
    border-color: transparent;
  }

  .btn.accent:hover {
    background: color-mix(in oklch, var(--accent, #c2683f) 88%, #000);
  }

  .btn.danger { color: #c0392b; }
  .btn.danger:hover { background: color-mix(in oklch, #c0392b 10%, var(--surface-hi, #fff)); }
</style>
