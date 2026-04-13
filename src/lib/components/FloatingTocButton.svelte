<script>
  let { active = false, onclick } = $props();
</script>

<button
  class="fab"
  class:active
  onclick={onclick}
  title="Toggle Table of Contents"
  aria-label={active ? 'Hide table of contents' : 'Show table of contents'}
  aria-pressed={active}
>
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    {#if active}
      <path fill="currentColor" d="M1 2.75A.75.75 0 0 1 1.75 2h12.5a.75.75 0 0 1 0 1.5H1.75A.75.75 0 0 1 1 2.75Zm0 5A.75.75 0 0 1 1.75 7H6.5a.75.75 0 0 1 0 1.5H1.75A.75.75 0 0 1 1 7.75Zm0 5A.75.75 0 0 1 1.75 12H6.5a.75.75 0 0 1 0 1.5H1.75a.75.75 0 0 1-.75-.75Z"/>
    {:else}
      <path fill="currentColor" d="M1 2.75A.75.75 0 0 1 1.75 2h12.5a.75.75 0 0 1 0 1.5H1.75A.75.75 0 0 1 1 2.75Zm0 5A.75.75 0 0 1 1.75 7h12.5a.75.75 0 0 1 0 1.5H1.75A.75.75 0 0 1 1 7.75Zm0 5a.75.75 0 0 1 .75-.75h12.5a.75.75 0 0 1 0 1.5H1.75a.75.75 0 0 1-.75-.75Z"/>
    {/if}
  </svg>
</button>

<style>
  .fab {
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 50;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: none;
    background: var(--text, #1f2328);
    color: var(--bg, #ffffff);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.08);
  }

  .fab:hover {
    transform: scale(1.05);
    opacity: 0.9;
  }

  .fab.active {
    background: var(--accent, #0969da);
    color: #ffffff;
  }

  .fab.active:hover {
    opacity: 0.9;
  }
</style>
