<script>
  import { invoke } from '@tauri-apps/api/core';
  import { settings, updateSetting } from '../stores/settings.svelte.js';

  let { onclose } = $props();

  let cliStatus = $state('');
  let cliError = $state('');
  let dialogEl;

  function handleBackdropClick(e) {
    if (e.target === e.currentTarget) onclose();
  }

  function handleKeydown(e) {
    if (e.key === 'Escape') onclose();
  }

  // Trap focus inside dialog and auto-focus on mount
  $effect(() => {
    if (!dialogEl) return;
    dialogEl.focus();
  });

  async function installCli() {
    cliStatus = '';
    cliError = '';
    try {
      const path = await invoke('install_cli');
      cliStatus = `Installed to ${path}`;
    } catch (err) {
      cliError = String(err);
    }
  }

  async function uninstallCli() {
    cliStatus = '';
    cliError = '';
    try {
      const result = await invoke('uninstall_cli');
      cliStatus = result === 'Not installed' ? 'CLI not found' : `Removed from ${result}`;
    } catch (err) {
      cliError = String(err);
    }
  }

  const fontSizes = [
    { label: 'Small', value: 14 },
    { label: 'Default', value: 16 },
    { label: 'Large', value: 18 },
    { label: 'X-Large', value: 20 },
  ];

  const widths = [
    { label: 'Narrow', value: 680 },
    { label: 'Default', value: 860 },
    { label: 'Wide', value: 1080 },
    { label: 'Full', value: 9999 },
  ];
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="backdrop" onclick={handleBackdropClick}>
  <div
    class="dialog"
    role="dialog"
    aria-modal="true"
    aria-label="Settings"
    bind:this={dialogEl}
    tabindex="-1"
  >
    <div class="dialog-header">
      <h3 id="settings-dialog-title">Settings</h3>
      <button class="close-btn" onclick={onclose} aria-label="Close settings">
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path fill="currentColor" d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"/>
        </svg>
      </button>
    </div>

    <div class="dialog-body">
      <div class="setting-group" role="group" aria-labelledby="theme-label">
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label class="setting-label" id="theme-label">Theme</label>
        <div class="segmented" role="radiogroup" aria-labelledby="theme-label">
          {#each ['system', 'light', 'dark'] as t}
            <button
              class:active={settings.theme === t}
              onclick={() => updateSetting('theme', t)}
              role="radio"
              aria-checked={settings.theme === t}
            >
              {#if t === 'system'}
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M7.5 1.75a.75.75 0 0 1 .75-.75 6.5 6.5 0 0 1 0 13 .75.75 0 0 1 0-1.5 5 5 0 0 0 0-10 .75.75 0 0 1-.75-.75ZM8.25 2.5v10a5 5 0 0 0 0-10Z"/></svg>
              {:else if t === 'light'}
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M8 12a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm0-1.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm5.657-8.157a.75.75 0 0 1 0 1.061l-1.061 1.06a.75.75 0 0 1-1.06-1.06l1.06-1.06a.75.75 0 0 1 1.06 0ZM8 0a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0V.75A.75.75 0 0 1 8 0ZM3.464 2.343a.75.75 0 0 1 0 1.061l-1.06 1.06a.75.75 0 0 1-1.061-1.06l1.06-1.06a.75.75 0 0 1 1.06 0ZM16 8a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 16 8ZM2.25 8.75a.75.75 0 0 1 0-1.5H.75a.75.75 0 0 1 0 1.5h1.5Zm11.407 4.907a.75.75 0 0 1-1.061 0l-1.06-1.06a.75.75 0 0 1 1.06-1.061l1.06 1.06a.75.75 0 0 1 0 1.061ZM3.464 13.657a.75.75 0 0 1-1.061 0l-1.06-1.06a.75.75 0 0 1 1.06-1.061l1.06 1.06a.75.75 0 0 1 0 1.06ZM8 16a.75.75 0 0 1-.75-.75v-1.5a.75.75 0 0 1 1.5 0v1.5A.75.75 0 0 1 8 16Z"/></svg>
              {:else}
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M9.598 1.591a.749.749 0 0 1 .785-.175 7.001 7.001 0 1 1-8.967 8.967.75.75 0 0 1 .961-.96 5.5 5.5 0 0 0 7.22-7.832Z"/></svg>
              {/if}
              <span>{t.charAt(0).toUpperCase() + t.slice(1)}</span>
            </button>
          {/each}
        </div>
      </div>

      <div class="setting-group" role="group" aria-labelledby="fontsize-label">
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label class="setting-label" id="fontsize-label">Font Size</label>
        <div class="segmented" role="radiogroup" aria-labelledby="fontsize-label">
          {#each fontSizes as fs}
            <button
              class:active={settings.fontSize === fs.value}
              onclick={() => updateSetting('fontSize', fs.value)}
              role="radio"
              aria-checked={settings.fontSize === fs.value}
            >
              {fs.label}
            </button>
          {/each}
        </div>
      </div>

      <div class="setting-group" role="group" aria-labelledby="width-label">
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label class="setting-label" id="width-label">Content Width</label>
        <div class="segmented" role="radiogroup" aria-labelledby="width-label">
          {#each widths as w}
            <button
              class:active={settings.contentWidth === w.value}
              onclick={() => updateSetting('contentWidth', w.value)}
              role="radio"
              aria-checked={settings.contentWidth === w.value}
            >
              {w.label}
            </button>
          {/each}
        </div>
      </div>

      <div class="setting-group">
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label class="setting-label" id="cli-label">Command Line</label>
        <p class="cli-desc">Use <code>mark file.md</code> to open files from the terminal.</p>
        <div class="cli-actions" aria-labelledby="cli-label">
          <button class="cli-btn install" onclick={installCli}>Install CLI</button>
          <button class="cli-btn uninstall" onclick={uninstallCli}>Uninstall</button>
        </div>
        {#if cliStatus}
          <p class="cli-msg success" role="status">{cliStatus}</p>
        {/if}
        {#if cliError}
          <p class="cli-msg error" role="alert">{cliError}</p>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 200;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(2px);
  }

  .dialog {
    background: var(--bg, #fff);
    border: 1px solid var(--border, #d1d9e0);
    border-radius: 12px;
    width: 380px;
    max-width: 90vw;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.2);
    overflow: hidden;
    outline: none;
  }

  .dialog-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px 12px;
    border-bottom: 1px solid var(--border, #d1d9e0);
  }

  .dialog-header h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: var(--text);
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    background: none;
    border-radius: 6px;
    cursor: pointer;
    color: var(--text-muted);
  }

  .close-btn:hover {
    background: var(--toc-hover);
    color: var(--text);
  }

  .dialog-body {
    padding: 16px 20px 20px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .setting-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .setting-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .segmented {
    display: flex;
    gap: 1px;
    background: var(--border);
    border-radius: 8px;
    overflow: hidden;
  }

  .segmented button {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    padding: 7px 8px;
    border: none;
    background: var(--input-bg);
    font-size: 12px;
    font-weight: 500;
    color: var(--text-muted);
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s ease;
  }

  .segmented button:hover:not(.active) {
    background: var(--toc-hover);
    color: var(--text);
  }

  .segmented button.active {
    background: var(--accent, #0969da);
    color: white;
  }

  .cli-desc {
    font-size: 12px;
    color: var(--text-muted);
    margin: 0;
    line-height: 1.4;
  }

  .cli-desc code {
    font-size: 11px;
    padding: 1px 4px;
    background: var(--input-bg);
    border-radius: 3px;
    font-family: 'SF Mono', SFMono-Regular, Consolas, monospace;
  }

  .cli-actions {
    display: flex;
    gap: 8px;
  }

  .cli-btn {
    padding: 6px 14px;
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s ease;
  }

  .cli-btn.install {
    background: var(--accent, #0969da);
    color: white;
    border-color: var(--accent, #0969da);
  }

  .cli-btn.install:hover {
    opacity: 0.9;
  }

  .cli-btn.uninstall {
    background: var(--input-bg);
    color: var(--text-muted);
  }

  .cli-btn.uninstall:hover {
    color: var(--text);
    background: var(--toc-hover);
  }

  .cli-msg {
    font-size: 12px;
    margin: 0;
    line-height: 1.4;
    white-space: pre-wrap;
    word-break: break-all;
  }

  .cli-msg.success {
    color: #2da44e;
  }

  .cli-msg.error {
    color: #cf222e;
  }
</style>
