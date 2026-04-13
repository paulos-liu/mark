<script>
  let { active = false, onclick } = $props();
</script>

<button class="fab" class:active onclick={onclick} title="Toggle Table of Contents">
  <svg viewBox="0 0 16 16" width="16" height="16">
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
    background: rgba(0, 0, 0, 0.7);
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(0, 0, 0, 0.08);
  }

  .fab:hover {
    background: rgba(0, 0, 0, 0.85);
    transform: scale(1.05);
  }

  .fab.active {
    background: rgba(9, 105, 218, 0.85);
  }

  .fab.active:hover {
    background: rgba(9, 105, 218, 1);
  }

  @media (prefers-color-scheme: dark) {
    .fab {
      background: rgba(255, 255, 255, 0.2);
    }

    .fab:hover {
      background: rgba(255, 255, 255, 0.3);
    }

    .fab.active {
      background: rgba(56, 139, 253, 0.6);
    }

    .fab.active:hover {
      background: rgba(56, 139, 253, 0.8);
    }
  }
</style>
